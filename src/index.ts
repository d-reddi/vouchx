import express from 'express';
import type { Devvit } from '@devvit/public-api';
import { context, createServer, getServerPort, realtime, reddit, redis, scheduler, settings } from '@devvit/web/server';

import {
  assertCanReview,
  blockUserForModerator,
  buildSubmitVerificationForm,
  cancelReopenedVerification,
  deleteCurrentUserVerificationData,
  deleteVerificationDataFormDefinition,
  denyVerification,
  errorText,
  getModeratorAccessSnapshot,
  getCurrentSubredditNameCompat,
  loadHubDashboard,
  loadModDashboard,
  onSaveFlairTemplateValues,
  onSaveModmailTemplatesValues,
  onSaveThemeValues,
  approveVerification,
  removeApprovedVerificationByModerator,
  reopenDeniedVerification,
  sanitizeSubredditId,
  searchApprovedRecords,
  searchAuditEntries,
  searchHistoryRecords,
  setPendingClaimState,
  submitVerification,
  toHubState,
  toModPanelState,
  unblockUserForModerator,
  withdrawCurrentUserPendingVerification,
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
  } as unknown as Devvit.Context;
}

function getStatus(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 400;
}

function sendError(res: express.Response, error: unknown): void {
  const message = errorText(error);
  res.status(getStatus(error)).json({ error: message });
}

function toSettingsValidationResponse(error?: string): SettingsValidationResponse {
  return error ? { success: false, error } : { success: true };
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

async function requireModerator(appContext: Devvit.Context): Promise<{ moderator: string; subredditName: string }> {
  const moderator = await appContext.reddit.getCurrentUsername();
  if (!moderator) {
    throw httpError(403, 'You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(appContext);
  const access = await getModeratorAccessSnapshot(appContext, subredditName, moderator);
  if (!access.isModerator) {
    throw httpError(403, 'Only moderators can create verification posts.');
  }

  return { moderator, subredditName };
}

async function requireReviewAccess(appContext: Devvit.Context): Promise<{ moderator: string; subredditName: string }> {
  const { moderator, subredditName } = await requireModerator(appContext);
  try {
    await assertCanReview(appContext, subredditName, moderator);
  } catch {
    throw httpError(403, 'Only moderators with Manage Users permission can review verifications.');
  }
  return { moderator, subredditName };
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
  if (!dashboard.canReview) {
    throw httpError(403, 'Only moderators with Manage Users permission can use the moderator panel.');
  }
  return {
    state: toModPanelState(dashboard),
    realtimeChannel: modRealtimeChannel(appContext),
  };
}

function normalizeRealtimeChannelPart(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

function modRealtimeChannel(appContext: Devvit.Context): string {
  const subredditId = sanitizeSubredditId(appContext.subredditId);
  if (subredditId) {
    return `vouchx_mod_refresh_${normalizeRealtimeChannelPart(subredditId)}`;
  }
  const subredditName = String(appContext.subredditName ?? '').trim().toLowerCase();
  return `vouchx_mod_refresh_name_${normalizeRealtimeChannelPart(subredditName || 'unknown')}`;
}

function hubRealtimeChannel(appContext: Devvit.Context): string {
  const subredditId = sanitizeSubredditId(appContext.subredditId);
  if (subredditId) {
    return `vouchx_hub_refresh_${normalizeRealtimeChannelPart(subredditId)}`;
  }
  const subredditName = String(appContext.subredditName ?? '').trim().toLowerCase();
  return `vouchx_hub_refresh_name_${normalizeRealtimeChannelPart(subredditName || 'unknown')}`;
}

async function sendRealtimeRefreshSignal(channel: string): Promise<void> {
  try {
    await realtime.send(channel, REFRESH_SIGNAL);
  } catch (error) {
    console.log(`Realtime refresh send failed: ${errorText(error)}`);
  }
}

async function sendRefreshSignals(appContext: Devvit.Context): Promise<void> {
  await Promise.allSettled([
    sendRealtimeRefreshSignal(modRealtimeChannel(appContext)),
    sendRealtimeRefreshSignal(hubRealtimeChannel(appContext)),
  ]);
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
    res.json(await buildHubPayload(currentContext()));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/internal/settings/validate/mod-menu-audit-purge-days', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<number>>;
  res.json(toSettingsValidationResponse(validateAuditPurgeDays(body.value)));
});

app.post('/internal/settings/validate/verifications-disabled-message', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<string>>;
  res.json(toSettingsValidationResponse(validateVerificationsDisabledMessage(body.value)));
});

app.post('/internal/settings/validate/deny-reason-label', (req, res) => {
  const body = (req.body ?? {}) as Partial<SettingsValidationRequest<string>>;
  res.json(toSettingsValidationResponse(validateDenyReasonLabel(body.value)));
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
    res.json({
      postUrl: post.url,
      toast: { text: 'Created NSFW verification post.' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/mod/state', async (_req, res) => {
  try {
    res.json(await buildModPayload(currentContext()));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/approve', async (req, res) => {
  try {
    const verificationId = String(req.body?.verificationId ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    const appContext = currentContext();
    const result = await approveVerification(appContext, verificationId);
    await sendRefreshSignals(appContext);
    const approvalFailed = result.flair.status === 'failed';
    const success = !approvalFailed && result.modmail.status !== 'failed' && result.modNote.status !== 'failed';
    const details = [
      `flair ${result.flair.status}${result.flair.reason ? ` (${result.flair.reason})` : ''}`,
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    res.json({
      ...(await buildModPayload(appContext)),
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
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    if (!reason) {
      throw httpError(400, 'Select a valid denial reason.');
    }
    const appContext = currentContext();
    const result = await denyVerification(appContext, verificationId, reason, moderatorNotes);
    await sendRefreshSignals(appContext);
    const blockText = result.userBlocked
      ? ` User reached ${result.denialCount ?? 3} denials and is now blocked.`
      : '';
    const success = result.modmail.status !== 'failed' && result.modNote.status !== 'failed';
    const details = [
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    const payload = await buildModPayload(appContext);
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
    const moderator = await appContext.reddit.getCurrentUsername();
    const subredditName = await getCurrentSubredditNameCompat(appContext);
    if (!moderator) {
      throw httpError(403, 'You must be logged in as a moderator.');
    }
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
    const moderator = await appContext.reddit.getCurrentUsername();
    const subredditName = await getCurrentSubredditNameCompat(appContext);
    if (!moderator) {
      throw httpError(403, 'You must be logged in as a moderator.');
    }
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
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: { text: 'Saved verification settings.', tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/settings/templates', async (req, res) => {
  try {
    const appContext = currentContext();
    await onSaveModmailTemplatesValues(req.body ?? {}, appContext);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: { text: 'Saved modmail templates.', tone: 'success' },
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/mod/settings/theme', async (req, res) => {
  try {
    const appContext = currentContext();
    await onSaveThemeValues(req.body ?? {}, appContext);
    await sendRefreshSignals(appContext);
    res.json({
      ...(await buildModPayload(appContext)),
      toast: { text: 'Saved theme settings.', tone: 'success' },
    });
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
