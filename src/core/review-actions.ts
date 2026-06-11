import type { Devvit } from '@devvit/public-api';
import type {
  ActionResult,
  BatchReviewAction,
  BatchReviewItemResult,
  BatchReviewItemStatus,
  BatchReviewResult,
  BatchReviewToast,
  BlockedUserEntry,
  DenyReason,
  FlairApplyResult,
  FlairStepResult,
  ManualBlockOutcome,
  ModNoteStepResult,
  ModmailStepResult,
  NormalizedBatchReviewIds,
  PendingAccountDetailsSnapshot,
  PendingPanelItem,
  RedisContext,
  ReviewActionKind,
  RuntimeConfig,
  ValidationCheckResult,
  VerificationRecord,
} from './types.ts';
import {
  getStoredDenialCount,
  incrementDenialCount,
  isUserBlocked,
  setBlockedUser,
  setManualBlockedUserEntry,
  unblockUserForModerator,
} from './blocking.ts';
import { BATCH_REVIEW_CONCURRENCY, HISTORY_RETENTION_DAYS, MAX_BATCH_REVIEW_ITEMS, VERIFIED_RECORD_RETENTION_DAYS } from './constants.ts';
import { toPendingPanelItem } from './dashboard.ts';
import { configuredApprovalTemplateIds, isLikelyFlairTemplateId, normalizeTemplateId } from './flair.ts';
import {
  approvedIndexKey,
  auditDateIndexKey,
  auditEntryKey,
  historyByModeratorIndexKey,
  historyByUserIndexKey,
  historyDateIndexKey,
  makeVerificationId,
  modmailThreadByUserEntryKey,
  pendingIndexKey,
  reopenedAuditByReopenedKey,
  reopenedChildByDeniedKey,
  reopenedStateByDeniedKey,
  userLatestKey,
  userPendingKey,
  verificationRecordKey,
} from './keys.ts';
import { assertClaimAllowsAction, withVerificationActionLock } from './locks.ts';
import { assertCanReview } from './moderator-access.ts';
import {
  addApprovalModNote,
  addDenialModNote,
  addModeratorRemovalModNote,
  addShadowbanAutoDenyModNote,
  sendApprovalModmail,
  sendDenialModmail,
  sendModeratorRemovalModmail,
  sendShadowbanAutoDenyModmail,
} from './modmail.ts';
import {
  errorText,
  getCurrentSubredditNameCompat,
  looksLikeDeletedOrSuspendedError,
  maskUsernameForLog,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernameLookupFields,
  usernamesEqual,
} from './normalize.ts';
import {
  addApprovedPrefixIndexEntry,
  appendAuditLog,
  clearUserPendingPointersIfMatch,
  deleteUserLatestPointers,
  deleteUserPendingPointers,
  findLatestExistingRecordIdForUser,
  getHistoryRecordAnchorMs,
  getRecord,
  removeApprovedPrefixIndexEntry,
  setRecord,
  setUserLatestPointer,
  setUserPendingPointer,
} from './records.ts';
import {
  applyValidationSchedule,
  pruneHistoryOlderThanDays,
  removeValidationTrackingForRecordIds,
  upsertValidationTracking,
  validateVerificationUserState,
} from './retention.ts';
import {
  getConfiguredDenyReason,
  getDenyReasonDisplayLabel,
  getRuntimeConfig,
  normalizePhotoInput,
} from './settings.ts';
import { collectPendingAccountDetailsSnapshot, lookupCurrentSubredditBanStatus } from './submission.ts';
import { removeUserFlairWithFallbacks } from './purge.ts';

export async function preflightReviewTargetAccount(
  context: Pick<Devvit.Context, 'reddit'>,
  record: VerificationRecord
): Promise<ValidationCheckResult> {
  return await validateVerificationUserState(context, record);
}

export function computeDecisionTurnaroundMs(
  submittedAt: string,
  reviewedAt: string | null | undefined
): number | undefined {
  const submittedMs = new Date(String(submittedAt || '')).getTime();
  const reviewedMs = new Date(String(reviewedAt || '')).getTime();
  if (!Number.isFinite(submittedMs) || !Number.isFinite(reviewedMs) || submittedMs <= 0 || reviewedMs <= 0) {
    return undefined;
  }
  return Math.max(0, reviewedMs - submittedMs);
}

export function buildValidationRetryActionResult(reason: string): ActionResult {
  return {
    outcome: 'validation_retry',
    applied: false,
    outcomeReason: reason,
    flair: { status: 'skipped', reason: 'User validation could not be confirmed.' },
    modmail: { status: 'skipped', reason: 'User validation could not be confirmed.' },
    modNote: { status: 'skipped', reason: 'User validation could not be confirmed.' },
  };
}

export function buildBannedApprovalConfirmationActionResult(username: string): ActionResult {
  return {
    outcome: 'banned_confirmation_required',
    applied: false,
    username,
    flair: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
    modmail: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
    modNote: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
  };
}

export async function removeReviewTargetForInvalidAccount(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  moderator: string,
  actionKind: ReviewActionKind,
  validationReason: string
): Promise<ActionResult> {
  const now = new Date().toISOString();
  const normalizedUsername = normalizeUsername(record.username);
  const updatedRecord: VerificationRecord = {
    ...record,
    status: 'removed',
    moderator,
    reviewedAt: now,
    claimedBy: null,
    claimedAt: null,
    reviewFlag: null,
    removedAt: now,
    removedBy: moderator,
    lastValidatedAt: null,
    nextValidationAt: null,
    hardExpireAt: null,
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
    lastFlairReconcileAt: null,
  };

  await setRecord(context, subredditId, updatedRecord);
  const historyAnchorMs = getHistoryRecordAnchorMs(updatedRecord);
  await context.redis.zRem(pendingIndexKey(subredditId), [record.id]);
  await context.redis.zRem(approvedIndexKey(subredditId), [record.id]);
  await removeApprovedPrefixIndexEntry(context, subredditId, record.id, record.username);
  await context.redis.zAdd(historyDateIndexKey(subredditId), {
    member: record.id,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizedUsername), {
    member: record.id,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
    member: record.id,
    score: historyAnchorMs,
  });
  await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);

  await clearUserPendingPointersIfMatch(context, subredditId, normalizedUsername, record.userId, record.id);
  await setUserLatestPointer(context, subredditId, normalizedUsername, record.userId, record.id);

  const cleanupKeys = new Set<string>([reopenedAuditByReopenedKey(subredditId, record.id)]);
  const parentVerificationId = record.parentVerificationId?.trim() ?? '';
  if (parentVerificationId) {
    cleanupKeys.add(reopenedChildByDeniedKey(subredditId, parentVerificationId));
    cleanupKeys.add(reopenedStateByDeniedKey(subredditId, parentVerificationId));
  }
  const modmailThreadKeys = Array.from(
    new Set(usernameLookupFields(record.username).map((field) => modmailThreadByUserEntryKey(subredditId, field)))
  );
  modmailThreadKeys.forEach((key) => cleanupKeys.add(key));
  if (cleanupKeys.size > 0) {
    await context.redis.del(...Array.from(cleanupKeys));
  }

  try {
    const reviewLabel = actionKind === 'approval' ? 'approval' : 'denial';
    await appendAuditLog(context, {
      subredditId,
      subredditName: sanitizeSubredditName(record.subredditName),
      username: record.username,
      actor: moderator,
      action: 'removed_by_mod',
      verificationId: record.id,
      notes: `Skipped ${reviewLabel} because the user account no longer exists or is suspended (${validationReason}). No review side effects were sent.`,
    });
  } catch (error) {
    console.log(`Audit log write failed (invalid-account cleanup): ${errorText(error)}`);
  }

  return {
    outcome: 'invalid_account_removed',
    applied: false,
    outcomeReason: validationReason,
    flair: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
    modmail: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
    modNote: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
  };
}

export async function approveVerification(
  context: Devvit.Context,
  verificationId: string,
  confirmBannedApproval = false,
  selectedFlairTemplateId?: string
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'approved') {
      return {
        outcome: 'completed',
        applied: false,
        username: record.username,
        flair: { status: 'skipped', reason: 'already approved' },
        modmail: { status: 'skipped', reason: 'already approved' },
        modNote: { status: 'skipped', reason: 'already approved' },
      };
    }

    if (record.status !== 'pending') {
      throw new Error('Verification is no longer pending.');
    }
    assertClaimAllowsAction(record, moderator);
    const parentDeniedId = record.parentVerificationId?.trim() ?? '';

    const validation = await preflightReviewTargetAccount(context, record);
    if (validation.outcome === 'deleted_or_suspended') {
      return await removeReviewTargetForInvalidAccount(
        context,
        subredditId,
        record,
        moderator,
        'approval',
        validation.reason
      );
    }
    if (validation.outcome === 'retry') {
      return buildValidationRetryActionResult(validation.reason);
    }

    let banStatus: PendingAccountDetailsSnapshot['banStatus'];
    try {
      banStatus = await lookupCurrentSubredditBanStatus(context, subredditName, record.username);
    } catch (error) {
      return buildValidationRetryActionResult(`User ban status could not be confirmed. ${errorText(error)}`);
    }
    if (banStatus === 'unknown') {
      return buildValidationRetryActionResult('User ban status could not be confirmed.');
    }
    if (banStatus === 'banned') {
      if (!confirmBannedApproval) {
        return buildBannedApprovalConfirmationActionResult(record.username);
      }
      const normalizedUsername = normalizeUsernameStrict(record.username);
      const redditClient = context.reddit as Devvit.Context['reddit'] & {
        unbanUser?: (username: string, subredditName: string) => Promise<void>;
      };
      if (!normalizedUsername || typeof redditClient.unbanUser !== 'function') {
        throw new Error('Unable to unban the user before approval.');
      }
      try {
        await redditClient.unbanUser(normalizedUsername, sanitizeSubredditName(record.subredditName));
      } catch (error) {
        throw new Error(`Unable to unban u/${normalizedUsername}. ${errorText(error)}`);
      }
    }

    const config = await getRuntimeConfig(context, subredditId);
    const configuredTemplateIds = configuredApprovalTemplateIds(config);
    const selectedTemplateId = normalizeTemplateId(selectedFlairTemplateId ?? '');
    const templateIdForApproval =
      config.multipleApprovalFlairsEnabled && selectedTemplateId && configuredTemplateIds.includes(selectedTemplateId)
        ? selectedTemplateId
        : normalizeTemplateId(config.flairTemplateId);
    const flairResult = await applyApprovalFlairWithFallbacks(context, record, config, templateIdForApproval);
    const flair: FlairStepResult = flairResult.applied
      ? { status: 'success' }
      : { status: 'failed', reason: flairResult.error ?? 'unknown error' };
    if (!flairResult.applied) {
      if (looksLikeDeletedOrSuspendedError((flairResult.error ?? '').toLowerCase())) {
        return await removeReviewTargetForInvalidAccount(
          context,
          subredditId,
          record,
          moderator,
          'approval',
          flairResult.error ?? 'user no longer exists or is suspended'
        );
      }
      return {
        outcome: 'completed',
        applied: false,
        username: record.username,
        flair,
        modmail: { status: 'skipped', reason: 'flair not applied' },
        modNote: { status: 'skipped', reason: 'flair not applied' },
      };
    }

    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'approved',
      moderator,
      reviewedAt: new Date().toISOString(),
      denyReason: null,
      denyNotes: null,
      claimedBy: null,
      claimedAt: null,
      reviewFlag: null,
      parentVerificationId: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: new Date().toISOString(),
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastTtlBumpAt: Date.now(),
      retentionDays: VERIFIED_RECORD_RETENTION_DAYS,
      lastAppliedFlairTemplateId: normalizeTemplateId(flairResult.appliedTemplateId ?? templateIdForApproval),
      lastFlairReconcileAt: null,
    };
    const validationScheduledRecord = applyValidationSchedule(reviewedRecord, Date.now());

    await setRecord(context, subredditId, validationScheduledRecord);
    await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
    const approvedAtMs = new Date(reviewedRecord.reviewedAt ?? reviewedRecord.submittedAt).getTime() || Date.now();
    const historyAnchorMs = getHistoryRecordAnchorMs(validationScheduledRecord, approvedAtMs);
    await context.redis.zAdd(approvedIndexKey(subredditId), {
      member: verificationId,
      score: approvedAtMs,
    });
    await addApprovedPrefixIndexEntry(context, subredditId, verificationId, validationScheduledRecord.username, approvedAtMs);
    await context.redis.zAdd(historyDateIndexKey(subredditId), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(record.username)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await deleteUserPendingPointers(context, subredditId, record.username, record.userId);
    await setUserLatestPointer(context, subredditId, record.username, record.userId, verificationId);
    await upsertValidationTracking(context, subredditId, validationScheduledRecord);
    if (parentDeniedId) {
      await removeSupersededDeniedRecord(context, subredditId, parentDeniedId, record.username);
      try {
        await unblockUserForModerator(context, subredditId, subredditName, record.username, moderator);
      } catch (error) {
        console.log(`Auto-unblock on reopened approval failed: ${errorText(error)}`);
      }
    }

    await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);

    const [modmail, modNote] = await Promise.all([
      sendApprovalModmail(context, subredditId, validationScheduledRecord),
      (async (): Promise<ModNoteStepResult> => {
        try {
          await addApprovalModNote(context, validationScheduledRecord, moderator);
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', reason: errorText(error) };
        }
      })(),
    ]);

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(validationScheduledRecord.subredditName),
        username: validationScheduledRecord.username,
        actor: moderator,
        action: 'approved',
        verificationId: validationScheduledRecord.id,
        turnaroundMs: computeDecisionTurnaroundMs(
          validationScheduledRecord.submittedAt,
          validationScheduledRecord.reviewedAt
        ),
        notes: [
          flair.status === 'success' ? 'Flair applied.' : `Flair failed: ${flair.reason ?? 'unknown error'}`,
          modmail.status === 'failed'
            ? `Modmail failed: ${modmail.reason ?? 'unknown error'}`
            : modmail.status === 'replied'
              ? 'Replied in existing modmail thread.'
              : modmail.status === 'created'
                ? 'Created new modmail thread.'
                : 'Modmail skipped.',
          modNote.status === 'success' ? 'Mod note added.' : `Mod note failed: ${modNote.reason ?? 'unknown error'}`,
        ].join(' '),
      });
    } catch (error) {
      console.log(`Audit log write failed (approved): ${errorText(error)}`);
    }

    return {
      outcome: 'completed',
      applied: true,
      username: validationScheduledRecord.username,
      flair,
      modmail,
      modNote,
    };
  });
}

export async function removeSupersededDeniedRecord(
  context: RedisContext,
  subredditId: string,
  deniedId: string,
  fallbackUsername: string
): Promise<void> {
  const normalizedDeniedId = deniedId.trim();
  if (!normalizedDeniedId) {
    return;
  }

  const deniedRecord = await getRecord(context, subredditId, normalizedDeniedId);
  const normalizedUsername = normalizeUsername(deniedRecord?.username ?? fallbackUsername);
  const normalizedModerator = normalizeUsername(deniedRecord?.moderator ?? '');

  await context.redis.zRem(pendingIndexKey(subredditId), [normalizedDeniedId]);
  await context.redis.zRem(approvedIndexKey(subredditId), [normalizedDeniedId]);
  await removeApprovedPrefixIndexEntry(context, subredditId, normalizedDeniedId, deniedRecord?.username ?? fallbackUsername);
  await context.redis.zRem(historyDateIndexKey(subredditId), [normalizedDeniedId]);
  if (normalizedUsername) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), [normalizedDeniedId]);
  }
  if (normalizedModerator) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), [normalizedDeniedId]);
  }
  await removeValidationTrackingForRecordIds(context, subredditId, [normalizedDeniedId]);
  await context.redis.del(verificationRecordKey(subredditId, normalizedDeniedId));
  await context.redis.del(reopenedChildByDeniedKey(subredditId, normalizedDeniedId));
  await context.redis.del(reopenedStateByDeniedKey(subredditId, normalizedDeniedId));
}

export async function applyApprovalFlairWithFallbacks(
  context: Devvit.Context,
  record: VerificationRecord,
  config: RuntimeConfig,
  preferredTemplateId?: string
): Promise<FlairApplyResult> {
  const rawSubreddit = record.subredditName.trim();
  const sanitizedSubreddit = sanitizeSubredditName(record.subredditName);
  const subredditAttempts = Array.from(
    new Set(
      [sanitizedSubreddit, rawSubreddit, rawSubreddit.replace(/^\/?r\//i, '')].map((value) => value.trim()).filter(Boolean)
    )
  );
  const rawUsername = record.username.trim();
  const rawUsernameNoPrefix = rawUsername.replace(/^u\//i, '');
  const normalizedUsername = normalizeUsername(record.username).replace(/^u\//i, '');
  const strictUsername = normalizeUsernameStrict(record.username);
  const usernameAttempts = Array.from(
    new Set([
      rawUsernameNoPrefix,
      rawUsername,
      normalizedUsername,
      strictUsername,
      `u/${rawUsernameNoPrefix}`,
      normalizedUsername ? `u/${normalizedUsername}` : '',
      strictUsername ? `u/${strictUsername}` : '',
    ])
  ).filter((value) => value.trim());
  const configuredTemplateId = normalizeTemplateId(preferredTemplateId ?? config.flairTemplateId);
  if (!configuredTemplateId) {
    return { applied: false, error: 'Missing flair template ID.' };
  }
  if (!isLikelyFlairTemplateId(configuredTemplateId)) {
    return { applied: false, error: 'Configured flair template ID format is invalid.' };
  }

  const attempts: Array<{ flairTemplateId: string }> = [{ flairTemplateId: configuredTemplateId }];

  let lastError: string | undefined;
  const errorLines: string[] = [];
  for (const subredditAttempt of subredditAttempts) {
    for (const usernameAttempt of usernameAttempts) {
      for (const attempt of attempts) {
        try {
          await context.reddit.setUserFlair({
            subredditName: subredditAttempt,
            username: usernameAttempt,
            flairTemplateId: attempt.flairTemplateId,
          });
          return { applied: true, appliedTemplateId: normalizeTemplateId(attempt.flairTemplateId) };
        } catch (error) {
          lastError = errorText(error);
          errorLines.push(`${subredditAttempt}/${usernameAttempt}/template-only=${lastError}`);
        }
      }
    }
  }

  if (errorLines.length > 0) {
    console.log(
      `Approve flair apply failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(record.username)}: ${errorLines.join(' | ')}`
    );
  }
  return { applied: false, error: lastError };
}

export async function denyVerification(
  context: Devvit.Context,
  verificationId: string,
  reason: DenyReason,
  moderatorNotes?: string,
  options?: { blockUser?: boolean }
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const config = await getRuntimeConfig(context, subredditId);
    const configuredReason = getConfiguredDenyReason(config, reason);
    if (!configuredReason?.enabled) {
      throw new Error('Selected denial reason is not enabled for this subreddit.');
    }

    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'denied') {
      return {
        outcome: 'completed',
        applied: false,
        flair: { status: 'skipped', reason: 'not applicable' },
        modmail: { status: 'skipped', reason: 'already denied' },
        modNote: { status: 'skipped', reason: 'already denied' },
      };
    }

    if (record.status !== 'pending') {
      throw new Error('Verification is no longer pending.');
    }
    assertClaimAllowsAction(record, moderator);

    const validation = await preflightReviewTargetAccount(context, record);
    if (validation.outcome === 'deleted_or_suspended') {
      return await removeReviewTargetForInvalidAccount(
        context,
        subredditId,
        record,
        moderator,
        'denial',
        validation.reason
      );
    }
    if (validation.outcome === 'retry') {
      return buildValidationRetryActionResult(validation.reason);
    }

    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'denied',
      moderator,
      reviewedAt: new Date().toISOString(),
      denyReason: reason,
      denyNotes: moderatorNotes ?? null,
      claimedBy: null,
      claimedAt: null,
      reviewFlag: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };

    const denyReasonLabel = getDenyReasonDisplayLabel(config, reason);
    return await finalizeDeniedVerification(context, subredditId, subredditName, reviewedRecord, config, {
      actor: moderator,
      denyReasonLabel,
      auditReasonNote: denyReasonLabel,
      moderatorNotes,
      blockUser: options?.blockUser,
      sendModmail: () => sendDenialModmail(context, subredditId, reviewedRecord, config),
      addModNote: () => addDenialModNote(context, reviewedRecord, moderator, config),
    });
  });
}

export async function finalizeDeniedVerification(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  reviewedRecord: VerificationRecord,
  config: RuntimeConfig,
  params: {
    actor: string;
    denyReasonLabel: string;
    auditReasonNote: string;
    moderatorNotes?: string;
    blockUser?: boolean;
    countTowardBlock?: boolean;
    sendModmail: () => Promise<ModmailStepResult>;
    addModNote: () => Promise<void>;
  }
): Promise<ActionResult> {
  const { actor, denyReasonLabel, auditReasonNote, moderatorNotes } = params;
  // Moderator denials count toward the auto-block threshold; automated denials (e.g. shadowban)
  // deliberately do not, so a Reddit-level shadowban does not silently push a user toward a block.
  const countTowardBlock = params.countTowardBlock !== false;
  const verificationId = reviewedRecord.id;

  await setRecord(context, subredditId, reviewedRecord);
  const historyAnchorMs = getHistoryRecordAnchorMs(reviewedRecord);
  await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
  await context.redis.zRem(approvedIndexKey(subredditId), [verificationId]);
  await removeApprovedPrefixIndexEntry(context, subredditId, verificationId, reviewedRecord.username);
  await context.redis.zAdd(historyDateIndexKey(subredditId), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(reviewedRecord.username)), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(actor)), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await deleteUserPendingPointers(context, subredditId, reviewedRecord.username, reviewedRecord.userId);
  await setUserLatestPointer(context, subredditId, reviewedRecord.username, reviewedRecord.userId, verificationId);
  await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

  await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);

  const [modmail, modNote] = await Promise.all([
    params.sendModmail(),
    (async (): Promise<ModNoteStepResult> => {
      try {
        await params.addModNote();
        return { status: 'success' };
      } catch (error) {
        return { status: 'failed', reason: errorText(error) };
      }
    })(),
  ]);

  const denialCount = countTowardBlock
    ? await incrementDenialCount(context, subredditId, reviewedRecord.username)
    : await getStoredDenialCount(context, subredditId, reviewedRecord.username);
  let userBlocked = false;
  let manualBlockOutcome: ManualBlockOutcome | undefined;
  if (countTowardBlock && config.maxDenialsBeforeBlock > 0 && denialCount >= config.maxDenialsBeforeBlock) {
    const blockedEntry: BlockedUserEntry = {
      username: normalizeUsernameForLookup(reviewedRecord.username),
      blockedAt: new Date().toISOString(),
      blockedBy: normalizeUsernameStrict(actor) || actor,
      deniedCount: denialCount,
      reason: `Reached ${denialCount} denials`,
      scope: 'subreddit',
    };
    const wasAlreadyBlocked = await isUserBlocked(context, subredditId, reviewedRecord.username);
    await setBlockedUser(context, subredditId, blockedEntry);
    userBlocked = true;
    if (!wasAlreadyBlocked) {
      try {
        await appendAuditLog(context, {
          subredditId,
          subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
          username: reviewedRecord.username,
          actor,
          action: 'blocked',
          verificationId: reviewedRecord.id,
          notes: blockedEntry.reason,
        });
      } catch (error) {
        console.log(`Audit log write failed (blocked): ${errorText(error)}`);
      }
    }
  }
  if (countTowardBlock && params.blockUser && !userBlocked) {
    try {
      const blockResult = await setManualBlockedUserEntry(
        context,
        subredditId,
        subredditName,
        normalizeUsernameStrict(reviewedRecord.username),
        actor,
        denialCount,
        false,
        `Blocked during denial: ${denyReasonLabel}`
      );
      manualBlockOutcome = {
        status: blockResult.alreadyBlocked ? 'already_blocked' : 'blocked',
        username: blockResult.entry.username,
      };
    } catch (error) {
      manualBlockOutcome = {
        status: 'failed',
        reason: errorText(error),
      };
    }
  }

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
      username: reviewedRecord.username,
      actor,
      action: 'denied',
      verificationId: reviewedRecord.id,
      turnaroundMs: computeDecisionTurnaroundMs(reviewedRecord.submittedAt, reviewedRecord.reviewedAt),
      // null = automated denial (e.g. shadowban auto-deny); feeds the stats reason breakdown.
      denyReason: reviewedRecord.denyReason ?? null,
      notes: `${auditReasonNote}${moderatorNotes ? ` | ${moderatorNotes}` : ''}${
        userBlocked ? ` | Auto-blocked after ${denialCount} denials` : ''
      }${
        manualBlockOutcome?.status === 'blocked'
          ? ' | Blocked by moderator during denial.'
          : manualBlockOutcome?.status === 'already_blocked'
            ? ' | User was already blocked.'
            : manualBlockOutcome?.status === 'failed'
              ? ` | Block request failed: ${manualBlockOutcome.reason ?? 'unknown error'}`
              : ''
      }`,
    });
  } catch (error) {
    console.log(`Audit log write failed (denied): ${errorText(error)}`);
  }

  return {
    outcome: 'completed',
    applied: true,
    username: reviewedRecord.username,
    denyReasonLabel,
    flair: { status: 'skipped', reason: 'not applicable' },
    modmail,
    modNote,
    userBlocked,
    denialCount,
    manualBlockOutcome,
  };
}

export const AUTO_DENY_SYSTEM_ACTOR = 'VouchX (auto)';

export const SHADOWBAN_APPEAL_URL = 'https://www.reddit.com/appeals';

export async function autoDenyShadowbannedSubmission(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  verificationId: string,
  config: RuntimeConfig
): Promise<ActionResult | null> {
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record || record.status !== 'pending') {
      return null;
    }
    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'denied',
      moderator: AUTO_DENY_SYSTEM_ACTOR,
      reviewedAt: new Date().toISOString(),
      denyReason: null,
      denyNotes: 'Account is shadowbanned',
      claimedBy: null,
      claimedAt: null,
      reviewFlag: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };
    return await finalizeDeniedVerification(context, subredditId, subredditName, reviewedRecord, config, {
      actor: AUTO_DENY_SYSTEM_ACTOR,
      denyReasonLabel: 'Shadowbanned account',
      auditReasonNote: 'Auto-denied — account is shadowbanned',
      moderatorNotes: undefined,
      blockUser: false,
      countTowardBlock: false,
      sendModmail: () => sendShadowbanAutoDenyModmail(context, subredditId, reviewedRecord, config),
      addModNote: () => addShadowbanAutoDenyModNote(context, reviewedRecord),
    });
  });
}

export function normalizeBatchReviewVerificationIds(
  values: unknown,
  maxItems = MAX_BATCH_REVIEW_ITEMS
): NormalizedBatchReviewIds {
  const rawValues = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  let duplicateOrEmptyCount = 0;

  for (const value of rawValues) {
    const id = String(value ?? '').trim();
    if (!id || seen.has(id)) {
      duplicateOrEmptyCount += 1;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  const limit = Math.max(0, Math.floor(maxItems));
  return {
    ids: ids.slice(0, limit),
    duplicateOrEmptyCount,
    truncatedCount: Math.max(0, ids.length - limit),
  };
}

export function emptyBatchReviewCounts(): Record<BatchReviewItemStatus, number> {
  return {
    completed: 0,
    failed: 0,
    validation_retry: 0,
    invalid_account_removed: 0,
    banned_confirmation_required: 0,
  };
}

export function classifyBatchReviewItem(action: BatchReviewAction, verificationId: string, result: ActionResult): BatchReviewItemResult {
  if (result.outcome === 'validation_retry') {
    return {
      verificationId,
      status: 'validation_retry',
      terminal: false,
      username: result.username,
      message: result.outcomeReason,
    };
  }
  if (result.outcome === 'banned_confirmation_required') {
    return {
      verificationId,
      status: 'banned_confirmation_required',
      terminal: false,
      username: result.username,
      message: 'Approval requires individual banned-user confirmation.',
    };
  }
  if (result.outcome === 'invalid_account_removed') {
    return {
      verificationId,
      status: 'invalid_account_removed',
      terminal: true,
      username: result.username,
      message: result.outcomeReason,
    };
  }

  const failedApproval =
    action === 'approve' &&
    (!result.applied || result.flair.status === 'failed' || result.modmail.status === 'failed' || result.modNote.status === 'failed');
  const failedDenial = action === 'deny' && (result.modmail.status === 'failed' || result.modNote.status === 'failed');
  if (failedApproval || failedDenial) {
    return {
      verificationId,
      status: 'failed',
      terminal: result.applied,
      username: result.username,
      message:
        result.flair.reason ??
        result.modmail.reason ??
        result.modNote.reason ??
        (action === 'approve' ? 'Approval did not complete.' : 'Denial completed with issues.'),
    };
  }

  return {
    verificationId,
    status: 'completed',
    terminal: true,
    username: result.username,
  };
}

export async function batchReviewVerifications(
  context: Devvit.Context,
  input: {
    action: BatchReviewAction;
    verificationIds: unknown;
    selectedFlairTemplateId?: string;
    reason?: DenyReason | null;
    moderatorNotes?: string;
  }
): Promise<BatchReviewResult> {
  const normalized = normalizeBatchReviewVerificationIds(input.verificationIds);
  if (normalized.ids.length === 0) {
    throw new Error('Select at least one verification to review.');
  }
  if (input.action !== 'approve' && input.action !== 'deny') {
    throw new Error('Select a valid batch action.');
  }
  if (input.action === 'deny' && !input.reason) {
    throw new Error('Select a valid denial reason.');
  }

  const counts = emptyBatchReviewCounts();
  const items: BatchReviewItemResult[] = new Array(normalized.ids.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= normalized.ids.length) {
        return;
      }

      const verificationId = normalized.ids[index]!;
      try {
        const result =
          input.action === 'approve'
            ? await approveVerification(context, verificationId, false, input.selectedFlairTemplateId)
            : await denyVerification(context, verificationId, input.reason!, input.moderatorNotes ?? '');
        items[index] = classifyBatchReviewItem(input.action, verificationId, result);
      } catch (error) {
        items[index] = {
          verificationId,
          status: 'failed',
          terminal: false,
          message: errorText(error),
        };
      }
    }
  }

  const workerCount = Math.min(BATCH_REVIEW_CONCURRENCY, normalized.ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const completedItems = items.filter(Boolean);
  for (const item of completedItems) {
    counts[item.status] += 1;
  }

  return {
    action: input.action,
    requestedCount: Array.isArray(input.verificationIds) ? input.verificationIds.length : 0,
    acceptedCount: normalized.ids.length,
    duplicateOrEmptyCount: normalized.duplicateOrEmptyCount,
    truncatedCount: normalized.truncatedCount,
    terminalVerificationIds: completedItems.filter((item) => item.terminal).map((item) => item.verificationId),
    counts,
    items: completedItems,
  };
}

export function pluralizeBatchCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildBatchReviewToast(result: BatchReviewResult): BatchReviewToast {
  const parts: string[] = [];
  const actionLabel = result.action === 'approve' ? 'Approved' : 'Denied';
  if (result.counts.completed > 0) {
    parts.push(`${actionLabel} ${result.counts.completed}`);
  }
  if (result.counts.invalid_account_removed > 0) {
    parts.push(`${pluralizeBatchCount(result.counts.invalid_account_removed, 'invalid account')} removed`);
  }
  if (result.counts.banned_confirmation_required > 0) {
    parts.push(
      `${result.counts.banned_confirmation_required} ${
        result.counts.banned_confirmation_required === 1 ? 'needs' : 'need'
      } individual banned-user confirmation`
    );
  }
  if (result.counts.validation_retry > 0) {
    parts.push(`${result.counts.validation_retry} need retry`);
  }
  if (result.counts.failed > 0) {
    parts.push(`${result.counts.failed} failed`);
  }
  const skipped = result.duplicateOrEmptyCount + result.truncatedCount;
  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }

  const text = parts.length > 0 ? parts.join('; ') + '.' : 'No selected verifications were changed.';
  const tone = result.counts.failed > 0 || result.counts.validation_retry > 0 ? 'error' : result.counts.completed > 0 ? 'success' : 'info';
  return { text, tone };
}

export async function reopenDeniedVerification(
  context: Devvit.Context,
  verificationId: string
): Promise<{ reopenedId: string; username: string; pendingItem: PendingPanelItem; deniedId: string }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const deniedRecord = await getRecord(context, subredditId, verificationId);
    if (!deniedRecord) {
      throw new Error('Verification not found.');
    }
    if (deniedRecord.status !== 'denied') {
      throw new Error('Only denied verifications can be reopened.');
    }

    const primaryPhoto = normalizePhotoInput(deniedRecord.photoOneUrl);
    if (!primaryPhoto) {
      throw new Error('Cannot reopen this denied case because its photos are unavailable. Ask the user to resubmit.');
    }

    const normalizedUsername = normalizeUsername(deniedRecord.username);
    const existingPendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
    if (existingPendingId) {
      const existingPendingRecord = await getRecord(context, subredditId, existingPendingId);
      if (existingPendingRecord?.status === 'pending') {
        throw new Error(`u/${deniedRecord.username} already has a pending verification.`);
      }
      await deleteUserPendingPointers(context, subredditId, normalizedUsername, deniedRecord.userId);
    }

    const now = new Date();
    const reopenedAt = now.toISOString();
    const accountDetails = await collectPendingAccountDetailsSnapshot(
      context,
      subredditId,
      subredditName,
      deniedRecord.username,
      reopenedAt
    );
    const reopenedId = makeVerificationId(now);
    const reopenedRecord: VerificationRecord = {
      ...deniedRecord,
      id: reopenedId,
      status: 'pending',
      moderator: null,
      reviewedAt: null,
      denyReason: null,
      denyNotes: null,
      claimedBy: null,
      claimedAt: null,
      reviewFlag: null,
      submittedAt: reopenedAt,
      parentVerificationId: deniedRecord.id,
      accountDetails,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };

    await setRecord(context, subredditId, reopenedRecord);
    await context.redis.zAdd(pendingIndexKey(subredditId), { member: reopenedId, score: now.getTime() });
    await context.redis.zAdd(historyDateIndexKey(subredditId), { member: reopenedId, score: now.getTime() });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizedUsername), { member: reopenedId, score: now.getTime() });
    await setUserPendingPointer(context, subredditId, normalizedUsername, reopenedRecord.userId, reopenedId);
    await setUserLatestPointer(context, subredditId, normalizedUsername, reopenedRecord.userId, reopenedId);
    await context.redis.set(reopenedChildByDeniedKey(subredditId, deniedRecord.id), reopenedId);
    await context.redis.set(reopenedStateByDeniedKey(subredditId, deniedRecord.id), 'open');

    try {
      const auditId = await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(reopenedRecord.subredditName),
        username: reopenedRecord.username,
        actor: moderator,
        action: 'reopened',
        verificationId: reopenedId,
        notes: 'Moved denied case back to pending re-review.',
      });
      await context.redis.set(reopenedAuditByReopenedKey(subredditId, reopenedId), auditId);
    } catch (error) {
      console.log(`Audit log write failed (reopened): ${errorText(error)}`);
    }

    const config = await getRuntimeConfig(context, subredditId);
    return {
      reopenedId,
      username: reopenedRecord.username,
      pendingItem: toPendingPanelItem(reopenedRecord, config),
      deniedId: deniedRecord.id,
    };
  });
}

export async function cancelReopenedVerification(
  context: Devvit.Context,
  verificationId: string
): Promise<{ username: string; deniedId: string }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const reopenedRecord = await getRecord(context, subredditId, verificationId);
    if (!reopenedRecord) {
      throw new Error('Verification not found.');
    }
    if (reopenedRecord.status !== 'pending' || !reopenedRecord.parentVerificationId?.trim()) {
      throw new Error('Only pending re-review cases can be canceled.');
    }
    assertClaimAllowsAction(reopenedRecord, moderator);

    const normalizedUsername = normalizeUsername(reopenedRecord.username);
    const parentVerificationId = reopenedRecord.parentVerificationId.trim();
    const parentRecord = await getRecord(context, subredditId, parentVerificationId);

    await context.redis.del(verificationRecordKey(subredditId, verificationId));
    await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
    await context.redis.zRem(historyDateIndexKey(subredditId), [verificationId]);
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), [verificationId]);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    await clearUserPendingPointersIfMatch(context, subredditId, normalizedUsername, reopenedRecord.userId, verificationId);

    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId === verificationId) {
      if (
        parentRecord &&
        usernamesEqual(parentRecord.username, reopenedRecord.username) &&
        parentRecord.id === parentVerificationId
      ) {
        await setUserLatestPointer(context, subredditId, normalizedUsername, parentRecord.userId, parentVerificationId);
      } else {
        const fallbackLatestId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
        if (fallbackLatestId) {
          const fallbackLatestRecord = await getRecord(context, subredditId, fallbackLatestId);
          if (fallbackLatestRecord) {
            await setUserLatestPointer(
              context,
              subredditId,
              normalizedUsername,
              fallbackLatestRecord.userId,
              fallbackLatestId
            );
          } else {
            await deleteUserLatestPointers(context, subredditId, normalizedUsername, reopenedRecord.userId);
          }
        } else {
          await deleteUserLatestPointers(context, subredditId, normalizedUsername, reopenedRecord.userId);
        }
      }
    }

    const reopenedLinkKey = reopenedChildByDeniedKey(subredditId, parentVerificationId);
    const mappedChildId = await context.redis.get(reopenedLinkKey);
    if (!mappedChildId || mappedChildId === verificationId) {
      await context.redis.del(reopenedLinkKey);
    }
    await context.redis.set(reopenedStateByDeniedKey(subredditId, parentVerificationId), 'cancelled');

    const reopenedAuditKey = reopenedAuditByReopenedKey(subredditId, verificationId);
    const reopenedAuditId = await context.redis.get(reopenedAuditKey);
    if (reopenedAuditId) {
      await context.redis.zRem(auditDateIndexKey(subredditId), [reopenedAuditId]);
      await context.redis.del(auditEntryKey(subredditId, reopenedAuditId));
      await context.redis.del(reopenedAuditKey);
    }

    return { username: reopenedRecord.username, deniedId: parentVerificationId };
  });
}

export async function removeApprovedVerificationByModerator(
  context: Devvit.Context,
  verificationId: string,
  removalReason: string
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const currentSubreddit = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, currentSubreddit, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'removed') {
      return {
        outcome: 'completed',
        applied: false,
        flair: { status: 'skipped', reason: 'already removed' },
        modmail: { status: 'skipped', reason: 'already removed' },
        modNote: { status: 'skipped', reason: 'not applicable' },
      };
    }

    if (record.status !== 'approved') {
      throw new Error('Only approved verifications can be removed.');
    }

    const normalizedReason = removalReason.trim();
    if (!normalizedReason) {
      throw new Error('Removal reason is required.');
    }

    const flairRemoved = await removeUserFlairWithFallbacks(context, sanitizeSubredditName(record.subredditName), record.username);
    const flair: FlairStepResult = flairRemoved
      ? { status: 'success' }
      : { status: 'failed', reason: 'Unable to remove flair through fallback methods.' };

    const now = new Date().toISOString();
    const updatedRecord: VerificationRecord = {
      ...record,
      status: 'removed',
      removedAt: now,
      removedBy: moderator,
    };

    await setRecord(context, subredditId, updatedRecord);
    const historyAnchorMs = getHistoryRecordAnchorMs(updatedRecord);
    await context.redis.zRem(approvedIndexKey(subredditId), [verificationId]);
    await removeApprovedPrefixIndexEntry(context, subredditId, verificationId, record.username);
    await context.redis.zAdd(historyDateIndexKey(subredditId), { member: verificationId, score: historyAnchorMs });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(record.username)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await setUserLatestPointer(context, subredditId, record.username, record.userId, verificationId);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    const [modmail, modNote] = await Promise.all([
      sendModeratorRemovalModmail(context, subredditId, updatedRecord, normalizedReason),
      (async (): Promise<ModNoteStepResult> => {
        try {
          await addModeratorRemovalModNote(context, updatedRecord, moderator, normalizedReason);
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', reason: errorText(error) };
        }
      })(),
    ]);

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(record.subredditName),
        username: record.username,
        actor: moderator,
        action: 'removed_by_mod',
        verificationId,
        notes: `${flairRemoved ? 'Flair removed.' : 'Flair removal failed.'} Reason: ${normalizedReason}${
          modmail.status === 'failed'
            ? ` | Removal modmail failed: ${modmail.reason ?? 'unknown error'}`
            : modmail.status === 'replied'
              ? ' | Removal modmail replied in existing thread.'
              : modmail.status === 'created'
                ? ' | Removal modmail created.'
                : ' | Removal modmail skipped.'
        }`,
      });
    } catch (error) {
      console.log(`Audit log write failed (removed_by_mod): ${errorText(error)}`);
    }

    return {
      outcome: 'completed',
      applied: true,
      flair,
      modmail,
      modNote,
    };
  });
}
