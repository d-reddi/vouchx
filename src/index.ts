import express from 'express';
import type { Devvit } from '@devvit/public-api';
import { context, createServer, getServerPort, reddit, redis, scheduler, settings } from '@devvit/web/server';

import {
  blockUserForModerator,
  buildSubmitVerificationForm,
  cancelReopenedVerification,
  deleteCurrentUserVerificationData,
  deleteVerificationDataFormDefinition,
  denyVerification,
  errorText,
  getCurrentSubredditNameCompat,
  loadDashboard,
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
  trackSubreddit,
  toHubState,
  toModPanelState,
  unblockUserForModerator,
  withdrawCurrentUserPendingVerification,
  type DenyReason,
  type SubmitVerificationValues,
} from './core.js';

type ToastPayload = {
  text: string;
  tone: 'success' | 'error' | 'info';
};

type HttpError = Error & {
  status?: number;
};

const app = express();
app.use(express.json({ limit: '20mb' }));

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

async function buildHubPayload(appContext: Devvit.Context) {
  const dashboard = await loadDashboard(appContext);
  return {
    state: toHubState(dashboard),
    forms: {
      submit: buildSubmitVerificationForm({ requiredPhotoCount: dashboard.config.requiredPhotoCount }),
      removeVerification: deleteVerificationDataFormDefinition,
    },
    modPanelPath: `./mod-panel.html?subredditId=${encodeURIComponent(sanitizeSubredditId(appContext.subredditId))}`,
  };
}

async function buildModPayload(appContext: Devvit.Context) {
  const dashboard = await loadDashboard(appContext);
  if (!dashboard.canReview) {
    throw httpError(403, 'Only moderators with Manage Users permission can use the moderator panel.');
  }
  return {
    state: toModPanelState(dashboard),
  };
}

function asDenyReason(value: unknown): DenyReason | null {
  const normalized = String(value ?? '').trim();
  switch (normalized) {
    case 'photoshop':
    case 'unclear_image':
    case 'did_not_follow_instructions':
    case 'other':
      return normalized;
    default:
      return null;
  }
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

app.post('/api/hub/submit', async (req, res) => {
  try {
    const appContext = currentContext();
    const result = await submitVerification(req.body as SubmitVerificationValues, appContext);
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
    const subreddit = await reddit.getCurrentSubreddit();
    const subredditName = subreddit.name;
    const title = String(req.body?.postTitle ?? '').trim() || 'Photo Verification Hub';
    await trackSubreddit(appContext, subredditName);
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
    const reason = asDenyReason(req.body?.reason);
    const moderatorNotes = String(req.body?.moderatorNotes ?? '').trim();
    if (!verificationId) {
      throw httpError(400, 'Missing verification ID.');
    }
    if (!reason) {
      throw httpError(400, 'Select a valid denial reason.');
    }
    if (reason === 'other' && !moderatorNotes) {
      throw httpError(400, 'Moderator notes are required when denial reason is Other.');
    }
    const appContext = currentContext();
    const result = await denyVerification(appContext, verificationId, reason, moderatorNotes);
    const blockText = result.userBlocked
      ? ` User reached ${result.denialCount ?? 3} denials and is now blocked.`
      : '';
    const success = result.modmail.status !== 'failed' && result.modNote.status !== 'failed';
    const details = [
      `modmail ${result.modmail.status}${result.modmail.reason ? ` (${result.modmail.reason})` : ''}`,
      `mod note ${result.modNote.status}${result.modNote.reason ? ` (${result.modNote.reason})` : ''}`,
    ];
    res.json({
      ...(await buildModPayload(appContext)),
      toast: {
        text: `${success ? 'Denied' : 'Denied with issues'} (${reason.replace(/_/g, ' ')}): ${details.join('; ')}.${blockText}`,
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

server.listen(getServerPort(), () => {
  console.log(`Server running on port ${getServerPort()}`);
});
