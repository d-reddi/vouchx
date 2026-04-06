import express from 'express';
import type { Devvit } from '@devvit/public-api';
import { context, createServer, getServerPort, realtime, reddit, redis, scheduler, settings } from '@devvit/web/server';

import {
  assertCanReview,
  blockUserForModerator,
  buildModeratorUpdateNotice,
  buildSubmitVerificationForm,
  cancelReopenedVerification,
  deleteCurrentUserVerificationData,
  deleteVerificationDataFormDefinition,
  dismissModeratorUpdateNotice,
  denyVerification,
  ensureUserValidationSchedule,
  errorText,
  getModeratorAccessSnapshot,
  getModeratorMembershipError,
  getCurrentSubredditNameCompat,
  loadHubDashboard,
  loadModDashboard,
  loadApprovalFlairOptionsForSettings,
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
  setPendingClaimState,
  submitVerification,
  moderatorPermissionLookupNeedsRetry,
  toHubState,
  toModPanelState,
  unblockUserForModerator,
  withdrawCurrentUserPendingVerification,
  validateFlairTemplateIdForSubreddit,
  validateMaxDenialsBeforeBlockSetting,
  parseDenyReason,
  type SubmitVerificationValues,
} from './core.js';

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

const app = express();
app.use(express.json({ limit: '20mb' }));
const REFRESH_SIGNAL = Object.freeze({ type: 'refresh' });
let unhandledRejectionGuardInstalled = false;
type RouteModeratorAccess = Awaited<ReturnType<typeof getModeratorAccessSnapshot>>;

function shouldIgnoreDevvitLogStreamAuthRejection(reason: unknown): boolean {
  const message = errorText(reason).toLowerCase();
  return (
    message.includes('unauthenticated') &&
    message.includes('failed to authenticate plugin request') &&
    message.includes('upstream request missing or timed out')
  );
}

function installUnhandledRejectionGuard(): void {
  if (unhandledRejectionGuardInstalled || typeof process === 'undefined' || typeof process.on !== 'function') {
    return;
  }
  process.on('unhandledRejection', (reason) => {
    if (shouldIgnoreDevvitLogStreamAuthRejection(reason)) {
      return;
    }
    const propagatedError = reason instanceof Error ? reason : new Error(errorText(reason));
    setImmediate(() => {
      throw propagatedError;
    });
  });
  unhandledRejectionGuardInstalled = true;
}

installUnhandledRejectionGuard();

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function currentContext(): Devvit.Context {
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
  } as unknown as Devvit.Context;
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
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return 'Enter a whole number of days (0 or greater).';
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

async function requireModeratorIdentity(appContext: Devvit.Context): Promise<{ moderator: string; subredditName: string }> {
  const moderator = await appContext.reddit.getCurrentUsername();
  if (!moderator) {
    throw httpError(403, 'You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(appContext);
  return { moderator, subredditName };
}

async function requireRouteModeratorAccess(
  appContext: Devvit.Context
): Promise<{ moderator: string; subredditName: string; access: RouteModeratorAccess }> {
  const { moderator, subredditName } = await requireModeratorIdentity(appContext);
  const access = await getModeratorAccessSnapshot(appContext, subredditName, moderator);
  return { moderator, subredditName, access };
}

async function requireModerator(appContext: Devvit.Context): Promise<{ moderator: string; subredditName: string }> {
  const { moderator, subredditName, access } = await requireRouteModeratorAccess(appContext);
  const accessError = getModeratorMembershipError(access, 'Only moderators can create verification posts.');
  if (accessError) {
    throw accessError;
  }
  return { moderator, subredditName };
}

async function requireReviewAccess(appContext: Devvit.Context): Promise<{ moderator: string; subredditName: string }> {
  const { moderator, subredditName, access } = await requireRouteModeratorAccess(appContext);
  await assertCanReview(appContext, subredditName, moderator, access);
  await cachePositiveModeratorUiState(appContext);
  return { moderator, subredditName };
}

async function ensureValidationScheduleForStateLoad(appContext: Devvit.Context): Promise<void> {
  const subredditName = String(appContext.subredditName ?? '').trim() || (await getCurrentSubredditNameCompat(appContext));
  await ensureUserValidationSchedule(
    appContext,
    sanitizeSubredditId(appContext.subredditId),
    subredditName
  );
}

async function buildHubPayload(appContext: Devvit.Context) {
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

async function buildModPayload(appContext: Devvit.Context) {
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

function normalizeRealtimeChannelPart(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

function realtimeChannelsForContext(appContext: Devvit.Context, prefix: string): string[] {
  const channels = new Set<string>();
  const subredditId = sanitizeSubredditId(appContext.subredditId);
  if (subredditId) {
    channels.add(`${prefix}_${normalizeRealtimeChannelPart(subredditId)}`);
  }
  const subredditName = String(appContext.subredditName ?? '').trim().toLowerCase();
  channels.add(`${prefix}_name_${normalizeRealtimeChannelPart(subredditName || 'unknown')}`);
  return Array.from(channels);
}

function modRealtimeChannel(appContext: Devvit.Context): string {
  return realtimeChannelsForContext(appContext, 'vouchx_mod_refresh')[0];
}

function hubRealtimeChannel(appContext: Devvit.Context): string {
  return realtimeChannelsForContext(appContext, 'vouchx_hub_refresh')[0];
}

async function sendRealtimeRefreshSignal(channel: string): Promise<void> {
  try {
    await realtime.send(channel, REFRESH_SIGNAL);
  } catch (error) {
    console.log(`Realtime refresh send failed: ${errorText(error)}`);
  }
}

async function sendRefreshSignals(appContext: Devvit.Context): Promise<void> {
  const channels = [
    ...realtimeChannelsForContext(appContext, 'vouchx_mod_refresh'),
    ...realtimeChannelsForContext(appContext, 'vouchx_hub_refresh'),
  ];
  await Promise.allSettled(channels.map((channel) => sendRealtimeRefreshSignal(channel)));
}

function sendFastModRefreshResponse(
  res: express.Response,
  appContext: Devvit.Context,
  toast: ToastPayload
): void {
  void sendRefreshSignals(appContext);
  res.json({
    realtimeChannel: modRealtimeChannel(appContext),
    refreshRequested: true,
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

app.post('/api/admin/create-post', async (req, res) => {
  try {
    const appContext = currentContext();
    const { subredditName } = await requireModerator(appContext);
    const title = String(req.body?.postTitle ?? '').trim() || 'Photo Verification Hub';
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
    res.json({
      postUrl: post.url,
      toast: { text: toastText },
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
    res.json({
      ...payload,
      toast: {
        text: `${approvalFailed ? 'Approval failed' : success ? 'Approved' : 'Approved with issues'}: ${details.join('; ')}`,
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
    const result = await denyVerification(appContext, verificationId, reason, moderatorNotes);
    let requestedBlockOutcome:
      | { status: 'blocked' | 'already_blocked'; username: string }
      | { status: 'failed'; reason: string }
      | null = null;
    if (blockUser && result.applied && !result.userBlocked) {
      if (!result.username) {
        requestedBlockOutcome = { status: 'failed', reason: 'Denied user could not be resolved for blocking.' };
      } else {
        try {
          const { moderator, subredditName } = await requireModeratorIdentity(appContext);
          const blockResult = await blockUserForModerator(
            appContext,
            sanitizeSubredditId(appContext.subredditId),
            subredditName,
            result.username,
            moderator
          );
          requestedBlockOutcome = {
            status: blockResult.alreadyBlocked ? 'already_blocked' : 'blocked',
            username: blockResult.entry.username,
          };
        } catch (error) {
          requestedBlockOutcome = { status: 'failed', reason: errorText(error) };
        }
      }
    }
    if (result.outcome !== 'validation_retry') {
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
    let blockText = result.userBlocked ? ` User reached ${result.denialCount ?? 3} denials and is now blocked.` : '';
    let blockFailed = false;
    if (requestedBlockOutcome) {
      if (requestedBlockOutcome.status === 'failed') {
        if (result.userBlocked) {
          blockText = ` User reached ${result.denialCount ?? 3} denials and is now blocked.`;
        } else {
          blockText = ` Block failed (${requestedBlockOutcome.reason}).`;
          blockFailed = true;
        }
      } else if (requestedBlockOutcome.status === 'blocked' || result.userBlocked) {
        blockText = ` Blocked u/${requestedBlockOutcome.username} from submitting verification.`;
      } else {
        blockText = ` u/${requestedBlockOutcome.username} is already blocked.`;
      }
    }
    const success = result.modmail.status !== 'failed' && result.modNote.status !== 'failed' && !blockFailed;
    const details = [
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    const denyReasonLabel =
      payload.state.config.denyReasons.find((item) => item.id === reason)?.label?.trim() ||
      reason.replace(/_/g, ' ');
    res.json({
      ...payload,
      toast: {
        text: `${success ? 'Denied' : 'Denied with issues'} (${denyReasonLabel}): ${details.join('; ')}.${blockText}`,
        tone: success ? 'success' : 'error',
      },
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
        text: `Canceled re-review for u/${canceled.username}.`,
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
      moderator
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
