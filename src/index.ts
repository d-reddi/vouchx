import express from 'express';
import type { Context } from '@devvit/public-api';
import { context, createServer, getServerPort, realtime, reddit, redis, scheduler, settings } from '@devvit/web/server';
import type { Form } from '@devvit/shared-types/shared/form.js';

import {
  assertCanReview,
  archivePendingVerificationModmailReply,
  batchReviewVerifications,
  blockUserForModerator,
  BROADCAST_HOST_SUBREDDIT,
  buildBatchReviewToast,
  buildModeratorUpdateNotice,
  buildSubmitVerificationForm,
  cancelReopenedVerification,
  DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS,
  deleteCurrentUserVerificationData,
  deleteVerificationDataFormDefinition,
  dismissModeratorUpdateNotice,
  denyVerification,
  ensureBroadcastPollSchedule,
  ensureUserValidationSchedule,
  getDeveloperBroadcastState,
  isBroadcastDeveloper,
  isBroadcastHostSubreddit,
  publishBroadcast,
  revokeBroadcast,
  runBroadcastPoll,
  sendBroadcastTest,
  markModeratorFeatureEducationCompleted,
  markModeratorOnboardingCompleted,
  moderatorRemoveHubPostTargetKey,
  MOD_MENU_FORM_TARGET_TTL_MS,
  errorText,
  getModeratorAccessSnapshot,
  getModeratorMembershipError,
  getCurrentSubredditNameCompat,
  loadHubDashboard,
  loadModDashboard,
  loadApprovalFlairOptionsForSettings,
  onModeratorPurgeUserData,
  onSaveFlairTemplateValues,
  onSaveModmailTemplatesValues,
  onSaveThemeValues,
  approveVerification,
  cachePositiveModeratorUiState,
  removeApprovedVerificationByModerator,
  reopenDeniedVerification,
  sanitizeSubredditId,
  getModeratorStats,
  getHubModeratorUiState,
  searchApprovedRecords,
  searchAuditEntries,
  searchHistoryRecords,
  addPendingFlagNote,
  setPendingClaimState,
  setPendingFlagState,
  reconcileApprovedUsersForRetention,
  submitVerification,
  moderatorPermissionLookupNeedsRetry,
  sanitizeSubredditName,
  toHubState,
  toModPanelState,
  unblockUserForModerator,
  withdrawCurrentUserPendingVerification,
  validateFlairTemplateIdForSubreddit,
  validateMaxDenialsBeforeBlockSetting,
  parseDenyReason,
  type AuditRetentionJobData,
  type PendingModmailReplyEvent,
  type PurgeUserDataFormValues,
  type SubmitVerificationValues,
} from './core.js';
import {
  installDevvitUnhandledRejectionGuard,
  shouldIgnoreDevvitLogStreamAuthRejection,
} from './runtime-guards.js';

type ToastPayload = {
  text: string;
  tone: 'success' | 'error' | 'info';
};

type SettingsValidationRequest<ValueType> = {
  value: ValueType | undefined;
  isEditing: boolean;
};

type SettingsValidationResponse = {
  success: boolean;
  error?: string;
};

type HttpError = Error & {
  status?: number;
};

type MenuItemRequest = {
  targetId?: string;
};

type TriggerLifecycleRequest = {
  subreddit?: {
    id?: string;
    name?: string;
  };
};

type TaskRequest<Data> = {
  data?: Data;
};

type UiToast = string | {
  text: string;
  appearance?: 'neutral' | 'success';
};

type UiResponse = {
  showToast?: UiToast;
  showForm?: {
    name: string;
    form: Form;
  };
  navigateTo?: string | {
    url: string;
    permalink?: string;
  };
};

type CreateVerificationHubValues = {
  postTitle?: string;
};

type RemoveVerificationPostValues = {
  confirmationText?: string;
};

const createVerificationHubForm: Form = {
  title: 'Create verification hub post',
  description: 'Creates the verification hub post, marks it NSFW, and pins it to the subreddit.',
  fields: [
    {
      type: 'string',
      name: 'postTitle',
      label: 'Post title',
      required: true,
      defaultValue: 'Photo Verification Hub',
    },
  ],
  acceptLabel: 'Create and pin NSFW verification post',
  cancelLabel: 'Cancel',
};

const purgeAuditLogForm: Form = {
  title: 'Purge Audit Log',
  description:
    'Removes audit log entries using your install setting for this subreddit. Set purge days to 0 to purge all entries.',
  fields: [
    {
      type: 'string',
      name: 'confirmationText',
      label: 'Type "confirm" to purge the audit log.',
      required: true,
    },
  ],
  acceptLabel: 'Purge Audit Log',
  cancelLabel: 'Cancel',
};

const app = express();
app.use(express.json({ limit: '20mb' }));
const REFRESH_SIGNAL = Object.freeze({ type: 'refresh' });
type RouteModeratorAccess = Awaited<ReturnType<typeof getModeratorAccessSnapshot>>;

installDevvitUnhandledRejectionGuard();

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function currentContext(): Context {
  return {
    reddit,
    redis,
    scheduler,
    settings,
    subredditId: context.subredditId ?? '',
    subredditName: context.subredditName ?? '',
    userId: context.userId ?? '',
    postId: context.postId ?? '',
    appVersion: context.appVersion ?? '',
  } as unknown as Context;
}

function getStatus(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 400;
}

function sendError(res: express.Response, error: unknown): void {
  const message = sanitizeClientErrorMessage(error);
  res.status(getStatus(error)).json({ error: message });
}

function showForm(name: string, form: Form): UiResponse {
  return {
    showForm: {
      name,
      form,
    },
  };
}

function toast(text: string, appearance: 'neutral' | 'success' = 'neutral'): UiResponse {
  return {
    showToast: {
      text,
      appearance,
    },
  };
}

function normalizePostThingId(value: unknown): `t3_${string}` | '' {
  const normalized = String(value ?? '').trim();
  return /^t3_[a-z0-9]+$/i.test(normalized) ? (normalized as `t3_${string}`) : '';
}

function buildRemoveVerificationHubPostForm(): Form {
  return {
    title: 'Remove verification hub post',
    description: 'Permanently removes this app-created verification hub post from the community.',
    fields: [
      {
        type: 'string',
        name: 'confirmationText',
        label: 'Type "remove" to confirm',
        required: true,
      },
    ],
    acceptLabel: 'Remove this post',
    cancelLabel: 'Cancel',
  };
}

async function clearRemoveHubPostTarget(appContext: Context, targetKey: string): Promise<void> {
  try {
    await appContext.redis.del(targetKey);
  } catch (error) {
    // The target is short-lived. Cleanup failure must not turn a successful Reddit
    // removal into a false failure response for the moderator.
    console.log(`Verification hub post target cleanup failed: ${errorText(error)}`);
  }
}

function looksLikeRawRedditHtmlErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('<body') ||
    normalized.includes('<style') ||
    normalized.includes('oauth.reddit.com') ||
    (normalized.includes('http status 403') && normalized.includes('forbidden'))
  );
}

function sanitizeClientErrorMessage(error: unknown, fallbackMessage = 'Request failed. Please retry.'): string {
  const message = errorText(error).replace(/\s+/g, ' ').trim();
  if (!message) {
    return fallbackMessage;
  }
  if (looksLikeRawRedditHtmlErrorMessage(message) || shouldIgnoreDevvitLogStreamAuthRejection(error)) {
    return fallbackMessage;
  }
  return message;
}

function toSettingsValidationResponse(error?: string): SettingsValidationResponse {
  return error ? { success: false, error } : { success: true };
}

function parseBooleanFlag(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }
  return false;
}

function validateAuditPurgeDays(value: unknown): string | undefined {
  if (value === undefined) {
    return;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS ||
    !Number.isInteger(value)
  ) {
    return `Enter a whole number of days (${DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS} or greater).`;
  }
}

function validateVerificationsDisabledMessage(value: unknown): string | undefined {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length > 200) {
    return 'Keep the disabled message at 200 characters or fewer.';
  }
}

function validateDenyReasonLabel(value: unknown): string | undefined {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length > 48) {
    return 'Keep the reason label at 48 characters or fewer.';
  }
}

async function requireModeratorIdentity(appContext: Context): Promise<{ moderator: string; subredditName: string }> {
  const moderator = await appContext.reddit.getCurrentUsername();
  if (!moderator) {
    throw httpError(403, 'You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(appContext);
  return { moderator, subredditName };
}

async function requireRouteModeratorAccess(
  appContext: Context
): Promise<{ moderator: string; subredditName: string; access: RouteModeratorAccess }> {
  const { moderator, subredditName } = await requireModeratorIdentity(appContext);
  const access = await getModeratorAccessSnapshot(appContext, subredditName, moderator);
  return { moderator, subredditName, access };
}

async function requireModerator(appContext: Context): Promise<{ moderator: string; subredditName: string }> {
  const { moderator, subredditName, access } = await requireRouteModeratorAccess(appContext);
  const accessError = getModeratorMembershipError(access, 'Only moderators can create verification posts.');
  if (accessError) {
    throw accessError;
  }
  return { moderator, subredditName };
}

async function requireDeveloper(appContext: Context): Promise<{ developer: string; subredditName: string }> {
  const { moderator, subredditName } = await requireModeratorIdentity(appContext);
  if (!(await isBroadcastDeveloper(appContext, moderator))) {
    throw httpError(403, 'This tool is restricted to VouchX developers.');
  }
  return { developer: moderator, subredditName };
}

async function requireReviewAccess(appContext: Context): Promise<{ moderator: string; subredditName: string }> {
  const { moderator, subredditName, access } = await requireRouteModeratorAccess(appContext);
  await assertCanReview(appContext, subredditName, moderator, access);
  await cachePositiveModeratorUiState(appContext);
  return { moderator, subredditName };
}

async function ensureValidationScheduleForStateLoad(appContext: Context): Promise<void> {
  const subredditName = String(appContext.subredditName ?? '').trim() || (await getCurrentSubredditNameCompat(appContext));
  const subredditId = sanitizeSubredditId(appContext.subredditId);
  await ensureUserValidationSchedule(appContext, subredditId, subredditName);
  await ensureBroadcastPollSchedule(appContext, subredditId, subredditName);
}

async function buildHubPayload(appContext: Context) {
  const dashboard = await loadHubDashboard(appContext);
  return {
    state: toHubState(dashboard),
    forms: {
      submit: buildSubmitVerificationForm({ requiredPhotoCount: dashboard.config.requiredPhotoCount }),
      removeVerification: deleteVerificationDataFormDefinition,
    },
    modPanelPath: `./mod-panel.html?subredditId=${encodeURIComponent(sanitizeSubredditId(appContext.subredditId))}`,
    realtimeChannel: hubRealtimeChannel(appContext),
  };
}

async function buildModPayload(appContext: Context) {
  const dashboard = await loadModDashboard(appContext);
  if (!dashboard.viewerUsername) {
    throw httpError(403, 'You must be logged in as a moderator.');
  }
  const membershipError = getModeratorMembershipError(
    dashboard.moderatorAccess,
    'Only moderators can use the moderator panel.'
  );
  if (membershipError) {
    throw membershipError;
  }
  if (moderatorPermissionLookupNeedsRetry(dashboard.moderatorAccess)) {
    throw httpError(503, 'Unable to verify moderator permissions right now. Please retry.');
  }
  if (!dashboard.canReview) {
    throw httpError(403, 'Only moderators with Manage Users permission can use the moderator panel.');
  }
  await cachePositiveModeratorUiState(appContext);
  const updateNotice = dashboard.viewerUsername ? await buildModeratorUpdateNotice(appContext, dashboard.viewerUsername) : null;
  return {
    state: {
      ...toModPanelState(dashboard),
      updateNotice,
    },
    realtimeChannel: modRealtimeChannel(appContext),
  };
}

async function createVerificationHubPost(
  appContext: Context,
  postTitle: string
): Promise<{ postUrl: string; toastText: string }> {
  const { subredditName } = await requireModerator(appContext);
  const title = postTitle.trim() || 'Photo Verification Hub';
  const post = await reddit.submitCustomPost({
    subredditName,
    title,
    entry: 'default',
    nsfw: true,
    textFallback: {
      text: 'Photo Verification Hub: users submit verification photos for moderator review.',
    },
  });
  let toastText = 'Created and pinned NSFW verification post.';
  try {
    await post.sticky(1);
  } catch (stickyError) {
    console.log(
      `[create-post] Created verification post ${post.id} in r/${subredditName}, but failed to pin it: ${errorText(stickyError)}`
    );
    toastText = "Created NSFW verification post, but couldn't pin it. Please pin it manually.";
  }

  return {
    postUrl: post.url,
    toastText,
  };
}

async function ensureValidationScheduleFromLifecycleEvent(event: TriggerLifecycleRequest): Promise<void> {
  const subredditId = sanitizeSubredditId(event.subreddit?.id ?? '');
  const subredditName = sanitizeSubredditName(event.subreddit?.name ?? '');
  if (!subredditId || !subredditName) {
    return;
  }

  const appContext = currentContext();
  await ensureUserValidationSchedule(appContext, subredditId, subredditName);
  await ensureBroadcastPollSchedule(appContext, subredditId, subredditName);
}

function normalizeRealtimeChannelPart(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

function realtimeChannelsForContext(appContext: Context, prefix: string): string[] {
  const channels = new Set<string>();
  const subredditId = sanitizeSubredditId(appContext.subredditId);
  if (subredditId) {
    channels.add(`${prefix}_${normalizeRealtimeChannelPart(subredditId)}`);
  }
  const subredditName = String(appContext.subredditName ?? '').trim().toLowerCase();
  channels.add(`${prefix}_name_${normalizeRealtimeChannelPart(subredditName || 'unknown')}`);
  return Array.from(channels);
}

function modRealtimeChannel(appContext: Context): string {
  return realtimeChannelsForContext(appContext, 'vouchx_mod_refresh')[0];
}

function hubRealtimeChannel(appContext: Context): string {
  return realtimeChannelsForContext(appContext, 'vouchx_hub_refresh')[0];
}

async function sendRealtimeRefreshSignal(channel: string): Promise<void> {
  try {
    await realtime.send(channel, REFRESH_SIGNAL);
  } catch (error) {
    console.log(`Realtime refresh send failed: ${errorText(error)}`);
  }
}

async function sendRefreshSignals(appContext: Context): Promise<void> {
  const channels = [
    ...realtimeChannelsForContext(appContext, 'vouchx_mod_refresh'),
    ...realtimeChannelsForContext(appContext, 'vouchx_hub_refresh'),
  ];
  await Promise.allSettled(channels.map((channel) => sendRealtimeRefreshSignal(channel)));
}

function sendFastModRefreshResponse(
  res: express.Response,
  appContext: Context,
  toast: ToastPayload,
  extras?: Record<string, unknown>
): void {
  void sendRefreshSignals(appContext);
  res.json({
    realtimeChannel: modRealtimeChannel(appContext),
    refreshRequested: true,
    ...(extras ?? {}),
    toast,
  });
}

function submitToast(result: Awaited<ReturnType<typeof submitVerification>>): ToastPayload {
  const pendingModmailSent =
    result.pendingModmail.status === 'created' ||
    result.pendingModmail.status === 'replied' ||
    result.pendingModmail.status === 'skipped';
  if (pendingModmailSent) {
    return {
      text: 'Verification submitted. A moderator will review it soon.',
      tone: 'success',
    };
  }
  return {
    text: `Verification submitted. A moderator will review it soon, but the pending status modmail could not be sent (${result.pendingModmail.reason ?? 'unknown error'}).`,
    tone: 'error',
  };
}

app.get('/api/hub/state', async (_req, res) => {
  try {
    const appContext = currentContext();
    await ensureValidationScheduleForStateLoad(appContext);
    res.json(await buildHubPayload(appContext));
  } catch (error) {
    res.status(getStatus(error)).json({
      error: sanitizeClientErrorMessage(error, 'Unable to load verification state right now. Please retry.'),
    });
  }
});

app.get('/api/hub/moderator-ui', async (_req, res) => {
  try {
    const appContext = currentContext();
    res.json(await getHubModeratorUiState(appContext));
  } catch (error) {
    res.status(getStatus(error)).json({
      error: sanitizeClientErrorMessage(error, 'Unable to verify moderator access right now. Please retry.'),
    });
  }
});

app.post('/internal/settings/validate/mod-menu-audit-purge-days', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<number>>;
  res.json(toSettingsValidationResponse(validateAuditPurgeDays(body.value)));
});

app.post('/internal/settings/validate/max-denials-before-block', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<number>>;
  res.json(toSettingsValidationResponse(validateMaxDenialsBeforeBlockSetting(body.value)));
});

app.post('/internal/settings/validate/verifications-disabled-message', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<string>>;
  res.json(toSettingsValidationResponse(validateVerificationsDisabledMessage(body.value)));
});

app.post('/internal/settings/validate/deny-reason-label', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<string>>;
  res.json(toSettingsValidationResponse(validateDenyReasonLabel(body.value)));
});

app.post('/internal/on-modmail', async (req, res) => {
  try {
    await archivePendingVerificationModmailReply(currentContext(), (req.body ?? {}) as PendingModmailReplyEvent);
  } catch (error) {
    void error;
  }
  res.json({ status: 'ok' });
});

app.post('/internal/on-app-install', async (req, res) => {
  try {
    await ensureValidationScheduleFromLifecycleEvent((req.body ?? {}) as TriggerLifecycleRequest);
  } catch {
    // Lifecycle triggers should not fail the install if background scheduling is temporarily unavailable.
  }
  res.json({});
});

app.post('/internal/on-app-upgrade', async (req, res) => {
  try {
    await ensureValidationScheduleFromLifecycleEvent((req.body ?? {}) as TriggerLifecycleRequest);
  } catch {
    // Lifecycle triggers should not fail the upgrade if background scheduling is temporarily unavailable.
  }
  res.json({});
});

app.post('/internal/scheduler/user-validation-reconcile', async (req, res) => {
  const body = (req.body ?? {}) as TaskRequest<Partial<AuditRetentionJobData>>;
  const subredditId = sanitizeSubredditId(body.data?.subredditId ?? '');
  const subredditName = sanitizeSubredditName(body.data?.subredditName ?? '');
  if (subredditId && subredditName) {
    try {
      const summary = await reconcileApprovedUsersForRetention(currentContext(), subredditId, subredditName);
      if (!summary.skipped) {
        console.log(
          `[user-validation] r/${subredditName}: approved_processed=${summary.processed} approved_validated=${summary.validated} approved_purged=${summary.purged} approved_retries=${summary.retried} non_approved_processed=${summary.nonApprovedProcessed} non_approved_validated=${summary.nonApprovedValidated} non_approved_purged=${summary.nonApprovedPurged} non_approved_retries=${summary.nonApprovedRetried} audit_purged=${summary.auditPurged} stale_index_entries_purged=${summary.staleIndexEntriesPurged}`
        );
      }
    } catch (error) {
      console.log(`[user-validation] Failed reconciliation for r/${subredditName}: ${errorText(error)}`);
    }
  }
  res.json({});
});

app.post('/internal/scheduler/broadcast-poll', async (req, res) => {
  const body = (req.body ?? {}) as { data?: { subredditId?: string; subredditName?: string } };
  const subredditId = sanitizeSubredditId(body.data?.subredditId ?? '');
  const subredditName = sanitizeSubredditName(body.data?.subredditName ?? '');
  if (subredditId && subredditName) {
    try {
      const summary = await runBroadcastPoll(currentContext(), subredditId, subredditName);
      if (!summary.skipped && (summary.delivered > 0 || summary.failed > 0)) {
        console.log(
          `[broadcast] r/${subredditName}: delivered=${summary.delivered} already=${summary.alreadyDelivered} version_skipped=${summary.skippedByVersion} opted_out=${summary.skippedOptedOut} expired=${summary.skippedExpired} revoked=${summary.skippedRevoked} failed=${summary.failed}`
        );
      }
    } catch (error) {
      console.log(`[broadcast] Failed poll for r/${subredditName}: ${errorText(error)}`);
    }
  }
  res.json({});
});

app.post('/internal/menu/create-verification-hub', (_req, res) => {
  res.json(showForm('createVerificationHub', createVerificationHubForm));
});

app.post('/internal/menu/purge-audit-log', (_req, res) => {
  res.json(showForm('purgeAuditLog', purgeAuditLogForm));
});

app.post('/internal/menu/remove-verification-hub-post', async (req, res) => {
  try {
    const menuRequest = (req.body ?? {}) as Partial<MenuItemRequest>;
    const targetId = normalizePostThingId(menuRequest.targetId);
    const appContext = currentContext();
    const subredditId = sanitizeSubredditId(appContext.subredditId);
    if (!targetId || !subredditId) {
      res.json(toast('Open this action from the verification hub post you want to remove.'));
      return;
    }
    const { moderator } = await requireModerator(appContext);
    await appContext.redis.set(
      moderatorRemoveHubPostTargetKey(subredditId, moderator),
      targetId,
      { expiration: new Date(Date.now() + MOD_MENU_FORM_TARGET_TTL_MS) }
    );
    res.json(showForm('removeVerificationHubPost', buildRemoveVerificationHubPostForm()));
  } catch (error) {
    console.log(`Verification hub post removal form failed: ${errorText(error)}`);
    res.json(toast('Unable to open the removal confirmation. Please retry.'));
  }
});

app.post('/internal/form/create-verification-hub-submit', async (req, res) => {
  try {
    const values = (req.body ?? {}) as CreateVerificationHubValues;
    const result = await createVerificationHubPost(currentContext(), values.postTitle ?? 'Photo Verification Hub');
    res.json({
      showToast: {
        text: result.toastText,
        appearance: 'success',
      },
      navigateTo: result.postUrl,
    } satisfies UiResponse);
  } catch (error) {
    res.json(toast(`Failed to create the verification post: ${errorText(error)}`));
  }
});

app.post('/internal/form/purge-audit-log-submit', async (req, res) => {
  let toastPayload: UiToast | undefined;
  const appContext = {
    ...currentContext(),
    ui: {
      showToast(payload: UiToast) {
        toastPayload = payload;
      },
    },
  };

  await onModeratorPurgeUserData(
    {
      values: (req.body ?? {}) as PurgeUserDataFormValues,
    } as never,
    appContext as never
  );

  res.json({
    showToast: toastPayload ?? 'Purge audit log action completed.',
  } satisfies UiResponse);
});

app.post('/internal/form/remove-verification-hub-post-submit', async (req, res) => {
  const values = (req.body ?? {}) as RemoveVerificationPostValues;
  if (String(values.confirmationText ?? '').trim().toLowerCase() !== 'remove') {
    res.json(toast('Removal cancelled. Type "remove" to confirm.'));
    return;
  }

  try {
    const appContext = currentContext();
    const { moderator } = await requireModerator(appContext);
    const currentSubredditId = sanitizeSubredditId(appContext.subredditId);
    const targetKey = currentSubredditId
      ? moderatorRemoveHubPostTargetKey(currentSubredditId, moderator)
      : '';
    const postId = targetKey ? normalizePostThingId(await appContext.redis.get(targetKey)) : '';
    if (!postId) {
      res.json(toast('The removal confirmation expired. Reopen it from the verification hub post.'));
      return;
    }
    const post = await appContext.reddit.getPostById(postId);
    if (currentSubredditId && sanitizeSubredditId(post.subredditId) !== currentSubredditId) {
      throw new Error('That post does not belong to this subreddit.');
    }
    if (post.removed) {
      await clearRemoveHubPostTarget(appContext, targetKey);
      res.json(toast('The verification hub post was already removed.', 'success'));
      return;
    }
    await appContext.reddit.remove(postId, false);
    await clearRemoveHubPostTarget(appContext, targetKey);
    res.json(toast('Removed the verification hub post.', 'success'));
  } catch (error) {
    console.log(`Verification hub post removal failed: ${errorText(error)}`);
    res.json(toast('Failed to remove the verification hub post. Please retry.'));
  }
});

app.post('/api/mod/settings/flair/validate', async (req, res) => {
  try {
    const appContext = currentContext();
    const { subredditName } = await requireReviewAccess(appContext);
    const body = (req.body ?? {}) as Partial<SettingsValidationRequest<string>>;
    const validation = await validateFlairTemplateIdForSubreddit(appContext, subredditName, body.value);
    res.json(toSettingsValidationResponse(validation.isValid ? undefined : validation.message));
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/mod/settings/flair/options', async (_req, res) => {
  try {
    const appContext = currentContext();
    res.json({
      options: await loadApprovalFlairOptionsForSettings(appContext),
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/hub/submit', async (req, res) => {
  try {
    const appContext = currentContext();
    const result = await submitVerification(req.body as SubmitVerificationValues, appContext);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildHubPayload(appContext)),
      toast: submitToast(result),
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/hub/withdraw', async (_req, res) => {
  try {
    const appContext = currentContext();
    await withdrawCurrentUserPendingVerification(appContext);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildHubPayload(appContext)),
      toast: { text: 'Pending verification withdrawn.', tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/hub/delete', async (req, res) => {
  try {
    if (!req.body?.confirmDelete) {
      throw httpError(400, 'Removal cancelled. Enable the confirmation toggle to continue.');
    }
    const appContext = currentContext();
    const result = await deleteCurrentUserVerificationData(appContext);
    await sendRefreshSignals(appContext);
    const text =
      result.flairRemovalFailedFor.length > 0
        ? `Data removed, but flair removal failed for: ${result.flairRemovalFailedFor.map((name: string) => `r/${name}`).join(', ')}`
        : 'Verification removed. Flair and stored verification data were removed.';
    res.json({
      ...(await buildHubPayload(appContext)),
      toast: {
        text,
        tone: result.flairRemovalFailedFor.length > 0 ? 'error' : 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/mod/state', async (_req, res) => {
  try {
    const appContext = currentContext();
    await ensureValidationScheduleForStateLoad(appContext);
    res.json(await buildModPayload(appContext));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/approve', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    const confirmBannedApproval = parseBooleanFlag(req.body?.confirmBannedApproval);
    const selectedFlairTemplateId = String(req.body?.selectedFlairTemplateId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const result = await approveVerification(appContext, verificationId, confirmBannedApproval, selectedFlairTemplateId);
    if (result.outcome !== 'validation_retry' && result.outcome !== 'banned_confirmation_required') {
      await sendRefreshSignals(appContext);
    }
    const payload = await buildModPayload(appContext);
    if (result.outcome === 'validation_retry') {
      res.json({
        ...payload,
        toast: {
          text: "Couldn't confirm the user account right now. Please retry.",
          tone: 'error',
        },
      });
      return;
    }
    if (result.outcome === 'banned_confirmation_required') {
      res.json({
        ...payload,
        approvalConfirm: {
          kind: 'banned-unban',
          verificationId,
          username: result.username ?? '',
          selectedFlairTemplateId,
        },
      });
      return;
    }
    if (result.outcome === 'invalid_account_removed') {
      res.json({
        ...payload,
        toast: {
          text: 'User no longer exists or is suspended. Verification removed from review.',
          tone: 'info',
        },
      });
      return;
    }
    const approvalFailed = result.flair.status === 'failed';
    const success = !approvalFailed && result.modmail.status !== 'failed' && result.modNote.status !== 'failed';
    const details = [
      `flair ${result.flair.status}${result.flair.reason ? ` (${result.flair.reason})` : ''}`,
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    const approvalUsername = result.username ? `u/${result.username}` : 'request';
    res.json({
      ...payload,
      toast: {
        text: success
          ? `Approved ${approvalUsername}.`
          : `${approvalFailed ? 'Approval failed' : 'Approved with issues'}: ${details.join('; ')}`,
        tone: success ? 'success' : 'error',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/deny', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    const reason = parseDenyReason(String(req.body?.reason ?? '').trim());
    const moderatorNotes = String(req.body?.moderatorNotes ?? '').trim();
    const blockUser = parseBooleanFlag(req.body?.blockUser);
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    if (!reason) {
      throw httpError(400, 'Select a valid denial reason.');
    }
    const appContext = currentContext();
    const result = await denyVerification(appContext, verificationId, reason, moderatorNotes, {
      blockUser,
    });
    if (result.outcome === 'validation_retry') {
      res.json({
        realtimeChannel: modRealtimeChannel(appContext),
        toast: {
          text: "Couldn't confirm the user account right now. Please retry.",
          tone: 'error',
        },
      });
      return;
    }
    if (result.outcome === 'invalid_account_removed') {
      sendFastModRefreshResponse(res, appContext, {
        text: 'User no longer exists or is suspended. Verification removed from review.',
        tone: 'info',
      }, {
        mutation: {
          type: 'removePending',
          verificationId,
        },
      });
      return;
    }
    let blockText = result.userBlocked ? ` User reached ${result.denialCount ?? 3} denials and is now blocked.` : '';
    let blockFailed = false;
    if (result.manualBlockOutcome) {
      if (result.manualBlockOutcome.status === 'failed') {
        if (result.userBlocked) {
          blockText = ` User reached ${result.denialCount ?? 3} denials and is now blocked.`;
        } else {
          blockText = ` Block failed (${result.manualBlockOutcome.reason}).`;
          blockFailed = true;
        }
      } else if (result.manualBlockOutcome.status === 'blocked' || result.userBlocked) {
        blockText = ` Blocked u/${result.manualBlockOutcome.username} from submitting verification.`;
      } else {
        blockText = ` u/${result.manualBlockOutcome.username} is already blocked.`;
      }
    }
    const success = result.modmail.status !== 'failed' && result.modNote.status !== 'failed' && !blockFailed;
    const details = [
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    const deniedUsername = result.username ? `u/${result.username}` : 'request';
    const successBlockText =
      result.manualBlockOutcome?.status === 'blocked' || result.userBlocked
        ? ' and blocked'
        : result.manualBlockOutcome?.status === 'already_blocked'
          ? '; user already blocked'
          : '';
    sendFastModRefreshResponse(res, appContext, {
      text: success
        ? `Denied ${deniedUsername}${successBlockText}.`
        : `Denied with issues (${result.denyReasonLabel || reason.replace(/_/g, ' ')}): ${details.join('; ')}.${blockText}`,
      tone: success ? 'success' : 'error',
    }, {
      mutation: {
        type: 'removePending',
        verificationId,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/batch-review', async (req, res) => {
  try {
    const action = String(req.body?.action ?? '').trim();
    const appContext = currentContext();
    if (action !== 'approve' && action !== 'deny') {
      throw httpError(400, 'Select a valid batch action.');
    }
    const reason = action === 'deny' ? parseDenyReason(String(req.body?.reason ?? '').trim()) : null;
    if (action === 'deny' && !reason) {
      throw httpError(400, 'Select a valid denial reason.');
    }
    const result = await batchReviewVerifications(appContext, {
      action,
      verificationIds: req.body?.verificationIds,
      selectedFlairTemplateId: String(req.body?.selectedFlairTemplateId ?? '').trim(),
      reason,
      moderatorNotes: String(req.body?.moderatorNotes ?? '').trim(),
    });
    const mutation =
      result.terminalVerificationIds.length > 0
        ? {
            type: 'removePendingMany',
            verificationIds: result.terminalVerificationIds,
          }
        : undefined;
    sendFastModRefreshResponse(res, appContext, buildBatchReviewToast(result), {
      batchReview: result,
      ...(mutation ? { mutation } : {}),
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/claim', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const result = await setPendingClaimState(appContext, verificationId, true);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: result.changed ? `Locked u/${result.item.username} for review.` : `u/${result.item.username} is already locked by you.`,
        tone: result.changed ? 'success' : 'info',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/unclaim', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const result = await setPendingClaimState(appContext, verificationId, false);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: result.changed ? `Unlocked u/${result.item.username}'s verification.` : `u/${result.item.username} is already unlocked.`,
        tone: result.changed ? 'success' : 'info',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/flag', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const flagged = parseBooleanFlag(req.body?.flagged);
    const note = String(req.body?.note ?? '').trim();
    const appContext = currentContext();
    const result = await setPendingFlagState(appContext, verificationId, flagged, note);
    sendFastModRefreshResponse(
      res,
      appContext,
      {
        text: flagged
          ? result.changed
            ? `Sent u/${result.username} to peer review.`
            : `u/${result.username} is already in peer review.`
          : result.changed
            ? `Cleared peer review for u/${result.username}.`
            : `u/${result.username} is not in peer review.`,
        tone: result.changed ? 'success' : 'info',
      },
      {
        mutation: {
          type: 'updatePending',
          item: result.item,
        },
      }
    );
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/flag-note', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    const note = String(req.body?.note ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    if (!note) {
      throw httpError(400, 'Enter a note before posting.');
    }
    const appContext = currentContext();
    const result = await addPendingFlagNote(appContext, verificationId, note);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: `Note added for u/${result.username}.`,
        tone: 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/reopen', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const reopened = await reopenDeniedVerification(appContext, verificationId);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: `Reopened denied case for u/${reopened.username}.`,
        tone: 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/cancel-reopen', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const canceled = await cancelReopenedVerification(appContext, verificationId);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: `Kept denial for u/${canceled.username}.`,
        tone: 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/remove', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    const reason = String(req.body?.reason ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    if (!reason) {
      throw httpError(400, 'Removal reason is required.');
    }
    const appContext = currentContext();
    const result = await removeApprovedVerificationByModerator(appContext, verificationId, reason);
    await sendRefreshSignals(appContext);
    const tone = result.flair.status === 'failed' || result.modmail.status === 'failed' ? 'error' : 'success';
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: `Verification removed${
          tone === 'error' ? ' with issues' : ''
        }: ${[
          result.flair.status === 'failed' ? `flair failed (${result.flair.reason ?? 'unknown error'})` : 'flair removed',
          result.modmail.status === 'failed'
            ? `modmail failed (${result.modmail.reason ?? 'unknown error'})`
            : result.modmail.status === 'replied'
              ? 'modmail replied to existing thread'
              : result.modmail.status === 'created'
                ? 'modmail created'
                : 'modmail skipped',
        ].join('; ')}`,
        tone,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/block', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const reason = String(req.body?.reason ?? '').trim();
    if (!username) {
      throw httpError(400, 'Missing username for block.');
    }
    const appContext = currentContext();
    const { moderator, subredditName } = await requireModeratorIdentity(appContext);
    const result = await blockUserForModerator(
      appContext,
      sanitizeSubredditId(appContext.subredditId),
      subredditName,
      username,
      moderator,
      reason
    );
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: result.alreadyBlocked
          ? `u/${result.entry.username} is already blocked.`
          : `Blocked u/${result.entry.username} from submitting verification.`,
        tone: result.alreadyBlocked ? 'info' : 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/unblock', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      throw httpError(400, 'Missing username for unblock.');
    }
    const appContext = currentContext();
    const { moderator, subredditName } = await requireModeratorIdentity(appContext);
    const unblocked = await unblockUserForModerator(
      appContext,
      sanitizeSubredditId(appContext.subredditId),
      subredditName,
      username,
      moderator
    );
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: unblocked ? `Removed block for u/${username}.` : `u/${username} was not blocked.`,
        tone: unblocked ? 'success' : 'info',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/dev/broadcast/state', async (_req, res) => {
  try {
    const appContext = currentContext();
    const { subredditName } = await requireDeveloper(appContext);
    const state = await getDeveloperBroadcastState(appContext, subredditName);
    res.json({ state });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/dev/broadcast', async (req, res) => {
  try {
    const appContext = currentContext();
    const { developer, subredditName } = await requireDeveloper(appContext);
    if (!isBroadcastHostSubreddit(subredditName)) {
      throw httpError(403, `Broadcasts can only be composed from r/${BROADCAST_HOST_SUBREDDIT}.`);
    }
    const payload = (req.body ?? {}) as { subject?: string; body?: string; type?: string; maxVersion?: string | null };
    const result = await publishBroadcast(appContext, {
      authoredBy: developer,
      input: {
        subject: String(payload.subject ?? ''),
        body: String(payload.body ?? ''),
        type: payload.type === 'notification' ? 'notification' : 'announcement',
        maxVersion: payload.maxVersion == null ? null : String(payload.maxVersion),
      },
    });
    if (!result.ok) {
      throw httpError(400, result.error);
    }
    const state = await getDeveloperBroadcastState(appContext, subredditName);
    res.json({
      state,
      toast: {
        text: result.entry.maxVersion
          ? `Broadcast published for installations below v${result.entry.maxVersion}. Each delivers within the hour.`
          : 'Broadcast published for all installations. Each delivers within the hour.',
        tone: 'success',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/dev/broadcast/test', async (req, res) => {
  try {
    const appContext = currentContext();
    const { subredditName } = await requireDeveloper(appContext);
    if (!isBroadcastHostSubreddit(subredditName)) {
      throw httpError(403, `Test sends are only available from r/${BROADCAST_HOST_SUBREDDIT}.`);
    }
    const payload = (req.body ?? {}) as { subject?: string; body?: string; type?: string; maxVersion?: string | null };
    const result = await sendBroadcastTest(appContext, {
      subredditId: sanitizeSubredditId(appContext.subredditId),
      subredditName,
      input: {
        subject: String(payload.subject ?? ''),
        body: String(payload.body ?? ''),
        type: payload.type === 'notification' ? 'notification' : 'announcement',
        maxVersion: payload.maxVersion == null ? null : String(payload.maxVersion),
      },
    });
    if (result.status === 'failed') {
      throw httpError(400, result.reason ?? 'Could not send the test notification.');
    }
    res.json({
      toast: { text: `Sent a test mod notification to r/${subredditName}'s modmail.`, tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/dev/broadcast/revoke', async (req, res) => {
  try {
    const appContext = currentContext();
    const { subredditName } = await requireDeveloper(appContext);
    if (!isBroadcastHostSubreddit(subredditName)) {
      throw httpError(403, `Broadcasts can only be managed from r/${BROADCAST_HOST_SUBREDDIT}.`);
    }
    const broadcastId = String(req.body?.id ?? '').trim();
    if (!broadcastId) {
      throw httpError(400, 'Missing broadcast id.');
    }
    const result = await revokeBroadcast(appContext, broadcastId);
    if (!result.ok) {
      throw httpError(400, result.error);
    }
    const state = await getDeveloperBroadcastState(appContext, subredditName);
    res.json({
      state,
      toast: { text: 'Broadcast revoked. Installations that have not yet delivered it will skip it.', tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/settings/flair', async (req, res) => {
  try {
    const appContext = currentContext();
    await onSaveFlairTemplateValues(req.body ?? {}, appContext);
    sendFastModRefreshResponse(res, appContext, {
      text: 'Saved verification settings.',
      tone: 'success',
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/settings/templates', async (req, res) => {
  try {
    const appContext = currentContext();
    await onSaveModmailTemplatesValues(req.body ?? {}, appContext);
    sendFastModRefreshResponse(res, appContext, {
      text: 'Saved modmail templates.',
      tone: 'success',
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/settings/theme', async (req, res) => {
  try {
    const appContext = currentContext();
    await onSaveThemeValues(req.body ?? {}, appContext);
    sendFastModRefreshResponse(res, appContext, {
      text: 'Saved theme settings.',
      tone: 'success',
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/update-notice/dismiss', async (req, res) => {
  try {
    const targetVersion = String(req.body?.targetVersion ?? '').trim();
    if (!targetVersion) {
      throw httpError(400, 'Missing target version.');
    }
    const appContext = currentContext();
    const { moderator } = await requireReviewAccess(appContext);
    await dismissModeratorUpdateNotice(appContext, moderator, targetVersion);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: { text: `We'll remind you about ${targetVersion} again in 7 days.`, tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/onboarding/complete', async (_req, res) => {
  try {
    const appContext = currentContext();
    const { moderator } = await requireReviewAccess(appContext);
    await markModeratorOnboardingCompleted(appContext, moderator);
    res.json(await buildModPayload(appContext));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/feature-education/complete', async (req, res) => {
  try {
    const rawPackIds: unknown[] = Array.isArray(req.body?.packIds) ? req.body.packIds : [];
    const packIds = rawPackIds.map((item) => String(item ?? '').trim()).filter(Boolean);
    if (packIds.length === 0) {
      throw httpError(400, 'Missing feature education pack.');
    }
    const appContext = currentContext();
    const { moderator } = await requireReviewAccess(appContext);
    await markModeratorFeatureEducationCompleted(appContext, moderator, packIds);
    res.json(await buildModPayload(appContext));
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/mod/stats', async (req, res) => {
  try {
    const appContext = currentContext();
    await requireReviewAccess(appContext);
    const requestedRange = String(req.query?.range ?? '').trim().toLowerCase();
    const range = requestedRange === 'monthly' ? 'monthly' : 'weekly';
    res.json(await getModeratorStats(appContext, sanitizeSubredditId(appContext.subredditId), range));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/search/history', async (req, res) => {
  try {
    const appContext = currentContext();
    await requireReviewAccess(appContext);
    res.json(
      await searchHistoryRecords(appContext, sanitizeSubredditId(appContext.subredditId), {
        status: String(req.body?.status ?? '').trim(),
        username: String(req.body?.username ?? '').trim(),
        fromDate: String(req.body?.fromDate ?? '').trim(),
        toDate: String(req.body?.toDate ?? '').trim(),
        offset: Number(req.body?.offset ?? 0),
        limit: Number(req.body?.limit ?? 25),
      })
    );
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/search/approved', async (req, res) => {
  try {
    const appContext = currentContext();
    await requireReviewAccess(appContext);
    res.json(
      await searchApprovedRecords(appContext, sanitizeSubredditId(appContext.subredditId), {
        username: String(req.body?.username ?? '').trim(),
        fromDate: String(req.body?.fromDate ?? '').trim(),
        toDate: String(req.body?.toDate ?? '').trim(),
        offset: Number(req.body?.offset ?? 0),
        limit: Number(req.body?.limit ?? 25),
      })
    );
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/search/audit', async (req, res) => {
  try {
    const appContext = currentContext();
    await requireReviewAccess(appContext);
    res.json(
      await searchAuditEntries(appContext, sanitizeSubredditId(appContext.subredditId), {
        username: String(req.body?.username ?? '').trim(),
        actor: String(req.body?.actor ?? '').trim(),
        action: String(req.body?.action ?? '').trim(),
        fromDate: String(req.body?.fromDate ?? '').trim(),
        toDate: String(req.body?.toDate ?? '').trim(),
        offset: Number(req.body?.offset ?? 0),
        limit: Number(req.body?.limit ?? 25),
      })
    );
  } catch (error) {
    sendError(res, error);
  }
});

const server = createServer(app);

server.listen(getServerPort());
