import {
  SUBREDDIT_KEY_PREFIX,
} from './constants.ts';
import {
  normalizeModmailConversationId,
  normalizeUserId,
  normalizeUsername,
  parseVersion,
  sanitizeSubredditId,
} from './normalize.ts';

export function makeVerificationId(date: Date): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${date.getTime()}-${random}`;
}

export function subredditScopePrefix(subredditId: string): string {
  return `${SUBREDDIT_KEY_PREFIX}:${sanitizeSubredditId(subredditId)}`;
}

export function verificationRecordKey(subredditId: string, id: string): string {
  return `${subredditScopePrefix(subredditId)}:verification:${id}`;
}

export function pendingIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:pending`;
}

export function approvedIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:approved`;
}

export function approvedPrefixIndexKey(subredditId: string, prefix3: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:approved:prefix3:v1:${normalizeUsername(prefix3).slice(0, 3)}`;
}

export function historyDateIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:date`;
}

export function historyByUserIndexKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:user:${normalizeUsername(normalizedUsername)}`;
}

export function historyByModeratorIndexKey(subredditId: string, normalizedModerator: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:mod:${normalizeUsername(normalizedModerator)}`;
}

export function userPendingKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:user:${normalizeUsername(normalizedUsername)}:pending`;
}

export function userLatestKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:user:${normalizeUsername(normalizedUsername)}:latest`;
}

export function blockedUsersKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:blocked`;
}

export function denialCountKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:denials`;
}

export function auditDateIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:audit:date`;
}

export function auditEntryKey(subredditId: string, id: string): string {
  return `${subredditScopePrefix(subredditId)}:audit:${id}`;
}

export function subredditConfigKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:config`;
}

export function validationDueIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:validation:due`;
}

export function validationHardExpireIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:validation:hard-expire`;
}

export function validationRunLockKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:lock`;
}

export function validationScheduleLockKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:schedule-lock`;
}

export function validationSchedulePresentKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:schedule-present`;
}

export function verificationActionLockKey(subredditId: string, verificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:verification-action-lock:${verificationId.trim()}`;
}

export function validationBackfillCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:backfill-cursor`;
}

export function validationNonApprovedCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:non-approved-cursor`;
}

export function validationNonApprovedFailureCountKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:non-approved-failures`;
}

export function staleRecordIndexSweepCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:cleanup:stale-record-index-cursor`;
}

export function storageCalibrationKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:storage:calibration`;
}

export function modmailThreadByUserKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:thread-by-user`;
}

export function modmailThreadByUserEntryKey(subredditId: string, normalizedUsername: string): string {
  return `${modmailThreadByUserKey(subredditId)}:${normalizeUsername(normalizedUsername)}`;
}

export function pendingModmailConversationKey(subredditId: string, conversationId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:pending-conversation:${normalizeModmailConversationId(conversationId)}`;
}

export function reopenedChildByDeniedKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-by-denied:${deniedVerificationId.trim()}`;
}

export function reopenedStateByDeniedKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-state-by-denied:${deniedVerificationId.trim()}`;
}

export function reopenedAuditByReopenedKey(subredditId: string, reopenedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-audit-by-reopened:${reopenedVerificationId.trim()}`;
}

export function modmailDedupeKey(subredditId: string, eventId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:dedupe:${eventId}`;
}

export function modmailLockKey(subredditId: string, eventId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:lock:${eventId}`;
}

export function moderatorPermissionCacheKey(subredditId: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:permissions:${normalizeUsername(username)}`;
}

export function moderatorLookupLogCooldownKey(subredditId: string, scope: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:lookup-log:${scope}:${normalizeUsername(username) || 'unknown'}`;
}

export function moderatorUiPositiveCacheKey(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator-ui:positive:${normalizeUserId(userId) || 'unknown'}`;
}

export function moderatorUiUnavailableBackoffKey(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator-ui:unavailable:${normalizeUserId(userId) || 'unknown'}`;
}

export function moderatorRemoveHubPostTargetKey(subredditId: string, moderator: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator-ui:remove-hub-post:${normalizeUsername(moderator) || 'unknown'}`;
}

export function recentViewerFlairRemovalSuppressionKey(subredditId: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:viewer-flair-removal-suppress:${normalizeUsername(username) || 'unknown'}`;
}

export function updateNoticeDismissalKey(subredditId: string, moderator: string, targetVersion: string): string {
  const normalizedVersion = parseVersion(targetVersion)?.normalized ?? targetVersion.trim().toLowerCase();
  return `${subredditScopePrefix(subredditId)}:moderator:update-dismissed:${normalizeUsername(
    moderator
  )}:${normalizedVersion}`;
}

export function moderatorOnboardingCompletedKey(subredditId: string, moderator: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:onboarded:${normalizeUsername(moderator)}`;
}

export function moderatorFeatureEducationCompletedKey(subredditId: string, moderator: string, packId: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:feature-education:${normalizeUsername(
    moderator
  )}:${packId.trim().toLowerCase()}`;
}

export function userPendingKeyById(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:user-id:${normalizeUserId(userId)}:pending`;
}

export function userLatestKeyById(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:user-id:${normalizeUserId(userId)}:latest`;
}
