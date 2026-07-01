import type { Devvit, FormOnSubmitEvent } from '@devvit/public-api';
import type {
  DeleteCurrentUserDataResult,
  PurgeUserDataFormValues,
  PurgeUserDataResult,
  RedditRedisContext,
  RedisContext,
  VerificationRecord,
  WithdrawPendingVerificationResult,
} from './types.ts';
import { SELF_DELETE_INDEX_SCAN_LIMIT, VIEWER_FLAIR_REMOVAL_SUPPRESSION_TTL_MS } from './constants.ts';
import { extractTemplateId, normalizeTemplateId } from './flair.ts';
import {
  approvedIndexKey,
  auditDateIndexKey,
  auditEntryKey,
  blockedUsersKey,
  denialCountKey,
  historyByModeratorIndexKey,
  historyByUserIndexKey,
  historyDateIndexKey,
  modmailThreadByUserEntryKey,
  pendingIndexKey,
  recentViewerFlairRemovalSuppressionKey,
  reopenedAuditByReopenedKey,
  reopenedChildByDeniedKey,
  reopenedStateByDeniedKey,
  userLatestKey,
  userLatestKeyById,
  userPendingKey,
  userPendingKeyById,
  verificationRecordKey,
} from './keys.ts';
import { assertCanReview } from './moderator-access.ts';
import { addPendingWithdrawalModNote, addSelfRemovalModNote } from './modmail.ts';
import {
  errorText,
  getCurrentSubredditNameCompat,
  maskUsernameForLog,
  normalizeUsername,
  normalizeUsernameKey,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernamesEqual,
} from './normalize.ts';
import {
  appendAuditLog,
  deleteUserLatestPointers,
  deleteUserPendingPointers,
  getRecord,
  getRecordUserId,
  mGetStringValuesInChunks,
  parseAuditEntry,
  parseRecord,
  removeApprovedPrefixIndexEntries,
} from './records.ts';
import { getModMenuAuditPurgeMinAgeDays, purgeAuditLogOlderThanDays, removeValidationTrackingForRecordIds } from './retention.ts';

export async function onModeratorPurgeUserData(
  event: FormOnSubmitEvent<PurgeUserDataFormValues>,
  context: Devvit.Context
): Promise<void> {
  try {
    const moderator = await context.reddit.getCurrentUsername();
    if (!moderator) {
      throw new Error('You must be logged in as a moderator.');
    }

    const subredditName = await getCurrentSubredditNameCompat(context);
    const subredditId = sanitizeSubredditId(context.subredditId);
    await assertCanReview(context, subredditName, moderator);

    const confirmationText = event.values.confirmationText?.trim().toLowerCase();
    if (confirmationText !== 'confirm') {
      context.ui.showToast('You must type "confirm" to complete purge.');
      return;
    }

    const purgeMinAgeDays = await getModMenuAuditPurgeMinAgeDays(context);
    const deletedAuditCount = await purgeAuditLogOlderThanDays(context, subredditId, purgeMinAgeDays);

    const emptyStateDescription =
      purgeMinAgeDays <= 0 ? 'No audit log entries found' : `No audit log entries older than ${purgeMinAgeDays} days found`;
    const auditPurgeNotes =
      deletedAuditCount > 0
        ? purgeMinAgeDays <= 0
          ? `Purged ${deletedAuditCount} audit log entr${deletedAuditCount === 1 ? 'y' : 'ies'} for r/${subredditName}.`
          : `Purged ${deletedAuditCount} audit log entr${deletedAuditCount === 1 ? 'y' : 'ies'} older than ${purgeMinAgeDays} days for r/${subredditName}.`
        : `${emptyStateDescription} for r/${subredditName}.`;

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName,
        username: moderator,
        actor: moderator,
        action: 'audit_purged',
        notes: auditPurgeNotes,
      });
    } catch (error) {
      console.log(`Audit log write failed (audit_purged): ${errorText(error)}`);
    }

    context.ui.showToast({
      text: auditPurgeNotes,
      appearance: 'success',
    });
  } catch (error) {
    context.ui.showToast(`Failed to purge audit log: ${errorText(error)}`);
  }
}

export async function withdrawCurrentUserPendingVerification(
  context: Devvit.Context
): Promise<WithdrawPendingVerificationResult> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be logged in to withdraw a pending request.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const normalizedUsername = normalizeUsername(username);
  const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
  if (!pendingId) {
    throw new Error('No pending verification request found.');
  }

  const record = await getRecord(context, subredditId, pendingId);
  if (!record || !usernamesEqual(record.username, normalizedUsername) || record.status !== 'pending') {
    await deleteUserPendingPointers(context, subredditId, normalizedUsername, context.userId);
    throw new Error('No pending verification request found.');
  }

  const withdrawnAt = new Date(Date.now()).toISOString();
  const currentSubredditName = await getCurrentSubredditNameCompat(context);

  await purgeUserVerificationData(
    context,
    subredditId,
    currentSubredditName || sanitizeSubredditName(record.subredditName),
    record.username,
    {
      removeFlair: true,
      removeAuditEntries: true,
      clearModerationRecords: false,
    }
  );

  try {
    await addPendingWithdrawalModNote(context, record, withdrawnAt);
  } catch (error) {
    console.log(
      `Pending withdrawal mod note write failed for r/${sanitizeSubredditName(record.subredditName)} u/${maskUsernameForLog(record.username)}: ${errorText(error)}`
    );
  }

  return { username: record.username };
}

export async function deleteCurrentUserVerificationData(
  context: Devvit.Context
): Promise<DeleteCurrentUserDataResult> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be logged in to delete your data.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditHint = await getCurrentSubredditNameCompat(context);
  const result = await purgeUserVerificationData(context, subredditId, subredditHint, username, {
    removeFlair: true,
    removeAuditEntries: true,
    clearModerationRecords: false,
  });

  if (result.deletedCount > 0 || result.flairRemovedFrom.includes(subredditHint)) {
    try {
      await addSelfRemovalModNote(context, subredditHint, username);
    } catch (error) {
      console.log(
        `Self-removal mod note write failed for r/${subredditHint} u/${maskUsernameForLog(username)}: ${errorText(error)}`
      );
    }
  }

  await suppressViewerVerifiedStateAfterSelfRemoval(context, subredditId, username);

  return {
    username,
    deletedCount: result.deletedCount,
    flairRemovedFrom: result.flairRemovedFrom,
    flairRemovalFailedFor: result.flairRemovalFailedFor,
  };
}

export async function suppressViewerVerifiedStateAfterSelfRemoval(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  username: string
): Promise<void> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedSubredditId || !normalizedUsername) {
    return;
  }

  try {
    await context.redis.set(
      recentViewerFlairRemovalSuppressionKey(normalizedSubredditId, normalizedUsername),
      '1',
      {
        expiration: new Date(Date.now() + VIEWER_FLAIR_REMOVAL_SUPPRESSION_TTL_MS),
      }
    );
  } catch {
    // Best-effort suppression only.
  }
}

export async function shouldSuppressViewerVerifiedState(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  username: string,
  userLatest: VerificationRecord | null
): Promise<boolean> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedSubredditId || !normalizedUsername || userLatest?.status === 'approved') {
    return false;
  }

  try {
    return Boolean(
      await context.redis.get(recentViewerFlairRemovalSuppressionKey(normalizedSubredditId, normalizedUsername))
    );
  } catch {
    return false;
  }
}

export async function purgeUserVerificationData(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string,
  username: string,
  options: {
    removeFlair: boolean;
    removeAuditEntries: boolean;
    clearModerationRecords: boolean;
  }
): Promise<PurgeUserDataResult> {
  const normalizedUsername = normalizeUsernameKey(username);
  if (!normalizedUsername) {
    throw new Error('A valid username is required.');
  }

  const candidateRecordIds = new Set<string>();
  const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
  const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
  if (pendingId) {
    candidateRecordIds.add(pendingId);
  }
  if (latestId) {
    candidateRecordIds.add(latestId);
  }

  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
  });
  for (const entry of historyEntries) {
    candidateRecordIds.add(entry.member);
  }
  const fallbackIndexRecordIds = await findRecordIdsForUserFromModerationIndexes(context, subredditId, normalizedUsername);
  for (const recordId of fallbackIndexRecordIds) {
    candidateRecordIds.add(recordId);
  }

  const candidateIds = Array.from(candidateRecordIds);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const recordsToDelete: string[] = [];
  const recordsById = new Map<string, VerificationRecord>();
  const userIdsToClear = new Set<string>();
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || !usernamesEqual(parsed.username, normalizedUsername)) {
      continue;
    }
    recordsToDelete.push(recordId);
    recordsById.set(recordId, parsed);
    if (getRecordUserId(parsed)) {
      userIdsToClear.add(getRecordUserId(parsed));
    }
  }

  if (recordsToDelete.length > 0) {
    await context.redis.zRem(pendingIndexKey(subredditId), recordsToDelete);
    await context.redis.zRem(approvedIndexKey(subredditId), recordsToDelete);
    await removeApprovedPrefixIndexEntries(
      context,
      subredditId,
      recordsToDelete
        .map((recordId) => {
          const record = recordsById.get(recordId);
          if (!record || record.status !== 'approved') {
            return null;
          }
          return { recordId, username: record.username };
        })
        .filter((entry): entry is { recordId: string; username: string } => entry !== null)
    );
    await context.redis.zRem(historyDateIndexKey(subredditId), recordsToDelete);
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), recordsToDelete);
    await removeValidationTrackingForRecordIds(context, subredditId, recordsToDelete);
    for (const recordId of recordsToDelete) {
      const record = recordsById.get(recordId);
      if (record?.moderator) {
        await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizeUsername(record.moderator)), [recordId]);
      }
    }
    await context.redis.del(...recordsToDelete.map((recordId) => verificationRecordKey(subredditId, recordId)));
  }

  const reopenMetaKeysToDelete = new Set<string>();
  for (const record of recordsById.values()) {
    reopenMetaKeysToDelete.add(reopenedAuditByReopenedKey(subredditId, record.id));
    if (record.status === 'denied') {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, record.id));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, record.id));
    }
    if (record.parentVerificationId?.trim()) {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, record.parentVerificationId.trim()));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, record.parentVerificationId.trim()));
    }
  }
  if (reopenMetaKeysToDelete.size > 0) {
    await context.redis.del(...Array.from(reopenMetaKeysToDelete));
  }

  await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
  await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
  for (const userId of userIdsToClear) {
    await context.redis.del(userPendingKeyById(subredditId, userId), userLatestKeyById(subredditId, userId));
  }
  await context.redis.del(modmailThreadByUserEntryKey(subredditId, normalizedUsername));

  const legacyUserKeys = Array.from(new Set([normalizedUsername, `u/${normalizedUsername}`]));
  const removedBlockCount = options.clearModerationRecords
    ? await context.redis.hDel(blockedUsersKey(subredditId), legacyUserKeys)
    : 0;
  const removedDenialCount = options.clearModerationRecords
    ? await context.redis.hDel(denialCountKey(subredditId), legacyUserKeys)
    : 0;

  let purgedAuditCount = 0;
  if (options.removeAuditEntries) {
    const auditMembers = await context.redis.zRange(auditDateIndexKey(subredditId), 0, -1, { by: 'rank' });
    if (auditMembers.length > 0) {
      const auditIds = auditMembers.map((entry) => entry.member);
      const auditPayloads = await mGetStringValuesInChunks(
        context,
        auditIds.map((auditId) => auditEntryKey(subredditId, auditId))
      );
      const staleAuditIds = new Set<string>();
      const auditIdsToDelete = new Set<string>();
      const recordIdSet = new Set(recordsToDelete);

      for (let index = 0; index < auditPayloads.length; index++) {
        const payload = auditPayloads[index];
        const auditId = auditIds[index];
        if (!payload) {
          staleAuditIds.add(auditId);
          continue;
        }
        const parsed = parseAuditEntry(payload);
        if (!parsed) {
          staleAuditIds.add(auditId);
          continue;
        }
        if (
          usernamesEqual(parsed.username, normalizedUsername) ||
          usernamesEqual(parsed.actor, normalizedUsername) ||
          (parsed.verificationId ? recordIdSet.has(parsed.verificationId) : false)
        ) {
          auditIdsToDelete.add(auditId);
        }
      }

      const staleIds = Array.from(staleAuditIds);
      if (staleIds.length > 0) {
        await context.redis.zRem(auditDateIndexKey(subredditId), staleIds);
      }

      const deleteIds = Array.from(auditIdsToDelete);
      if (deleteIds.length > 0) {
        await context.redis.zRem(auditDateIndexKey(subredditId), deleteIds);
        await context.redis.del(...deleteIds.map((auditId) => auditEntryKey(subredditId, auditId)));
        purgedAuditCount = deleteIds.length;
      }
    }
  }

  const flairRemovedFrom: string[] = [];
  const flairRemovalFailedFor: string[] = [];
  if (options.removeFlair) {
    const removed = await removeUserFlairWithFallbacks(context, subredditName, username);
    if (removed) {
      flairRemovedFrom.push(subredditName);
    } else {
      flairRemovalFailedFor.push(subredditName);
    }
  }

  return {
    deletedCount: recordsToDelete.length,
    flairRemovedFrom,
    flairRemovalFailedFor,
    purgedAuditCount,
    removedBlockCount,
    removedDenialCount,
    touchedSubreddits: [subredditName],
  };
}

export async function findRecordIdsForUserFromModerationIndexes(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<string[]> {
  const candidateIds = new Set<string>();
  const indexTargets: Array<{ key: string; reverse: boolean }> = [
    { key: pendingIndexKey(subredditId), reverse: true },
    { key: approvedIndexKey(subredditId), reverse: true },
  ];

  for (const target of indexTargets) {
    const members = await context.redis.zRange(target.key, 0, SELF_DELETE_INDEX_SCAN_LIMIT - 1, {
      by: 'rank',
      reverse: target.reverse,
    });
    if (members.length === 0) {
      continue;
    }
    for (const member of members) {
      candidateIds.add(member.member);
    }
  }

  const ids = Array.from(candidateIds);
  if (ids.length === 0) {
    return [];
  }

  const payloads = await mGetStringValuesInChunks(
    context,
    ids.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const matches: string[] = [];
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed) {
      continue;
    }
    if (usernamesEqual(parsed.username, normalizedUsername)) {
      matches.push(ids[index]);
    }
  }

  return matches;
}

export async function removeUserFlairWithFallbacks(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditName: string,
  username: string
): Promise<boolean> {
  const rawSubreddit = subredditName.trim();
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const subredditAttempts = Array.from(
    new Set(
      [sanitizedSubreddit, rawSubreddit, rawSubreddit.replace(/^\/?r\//i, '')].map((value) => value.trim()).filter(Boolean)
    )
  );
  const rawUsername = username.trim();
  const rawUsernameNoPrefix = rawUsername.replace(/^u\//i, '');
  const normalizedUsername = normalizeUsername(username).replace(/^u\//i, '');
  const strictUsername = normalizeUsernameStrict(username);
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
  const errors: string[] = [];
  const verificationUsername = strictUsername || normalizedUsername || rawUsernameNoPrefix;
  const maxFallbackAttempts = 8;
  let fallbackAttempts = 0;

  for (const subredditAttempt of subredditAttempts) {
    for (const usernameAttempt of usernameAttempts) {
      if (fallbackAttempts >= maxFallbackAttempts) {
        break;
      }
      fallbackAttempts += 1;
      try {
        await context.reddit.removeUserFlair(subredditAttempt, usernameAttempt);
        if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
          return true;
        }
      } catch (removeError) {
        try {
          await context.reddit.setUserFlair({
            subredditName: subredditAttempt,
            username: usernameAttempt,
            flairTemplateId: '',
            text: '',
            cssClass: '',
          });
          if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
            return true;
          }
        } catch (setError) {
          try {
            await context.reddit.setUserFlairBatch(subredditAttempt, [{ username: usernameAttempt, text: '', cssClass: '' }]);
            if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
              return true;
            }
          } catch (batchError) {
            errors.push(
              `${subredditAttempt}/${usernameAttempt}: remove=${errorText(removeError)} set=${errorText(setError)} batch=${errorText(batchError)}`
            );
          }
        }
      }
    }
    if (fallbackAttempts >= maxFallbackAttempts) {
      break;
    }
  }

  console.log(`Flair removal failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errors.join(' | ')}`);
  return false;
}

export async function isUserFlairCleared(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditName: string,
  username: string
): Promise<boolean> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!sanitizedSubreddit || !normalizedUsername) {
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const user = await context.reddit.getUserByUsername(normalizedUsername);
      if (!user) {
        return false;
      }
      const flair = await user.getUserFlairBySubreddit(sanitizedSubreddit);
      if (!flair) {
        return true;
      }
      const flairTemplateId = normalizeTemplateId(extractTemplateId(flair));
      const flairText = String(flair.flairText ?? '').trim();
      const flairCssClass = String(flair.flairCssClass ?? '').trim();
      if (!flairTemplateId && !flairText && !flairCssClass) {
        return true;
      }
    } catch (error) {
      console.log(
        `Flair removal verification failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errorText(error)}`
      );
      return false;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return false;
}

export async function removeAllVerificationRecordsForUser(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<void> {
  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
  });
  const recordIds = Array.from(new Set(historyEntries.map((entry) => entry.member)));
  if (recordIds.length === 0) {
    await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
    await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
    return;
  }

  const payloads = await mGetStringValuesInChunks(
    context,
    recordIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const byModerator = new Map<string, string[]>();
  const approvedPrefixEntries: Array<{ recordId: string; username: string }> = [];
  const reopenMetaKeysToDelete = new Set<string>();
  const userIdsToClear = new Set<string>();
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = recordIds[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed) {
      continue;
    }
    if (getRecordUserId(parsed)) {
      userIdsToClear.add(getRecordUserId(parsed));
    }
    if (parsed.moderator) {
      const normalizedModerator = normalizeUsername(parsed.moderator);
      const ids = byModerator.get(normalizedModerator) ?? [];
      ids.push(recordId);
      byModerator.set(normalizedModerator, ids);
    }
    if (parsed.status === 'approved') {
      approvedPrefixEntries.push({ recordId, username: parsed.username });
    }
    reopenMetaKeysToDelete.add(reopenedAuditByReopenedKey(subredditId, recordId));
    if (parsed.status === 'denied') {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, recordId));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, recordId));
    }
    if (parsed.parentVerificationId?.trim()) {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, parsed.parentVerificationId.trim()));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, parsed.parentVerificationId.trim()));
    }
  }

  if (recordIds.length > 0) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), recordIds);
    await context.redis.zRem(historyDateIndexKey(subredditId), recordIds);
    await context.redis.zRem(pendingIndexKey(subredditId), recordIds);
    await context.redis.zRem(approvedIndexKey(subredditId), recordIds);
    await removeApprovedPrefixIndexEntries(context, subredditId, approvedPrefixEntries);
    await removeValidationTrackingForRecordIds(context, subredditId, recordIds);
    await context.redis.del(...recordIds.map((recordId) => verificationRecordKey(subredditId, recordId)));
  }

  for (const [normalizedModerator, ids] of byModerator.entries()) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), ids);
  }
  if (reopenMetaKeysToDelete.size > 0) {
    await context.redis.del(...Array.from(reopenMetaKeysToDelete));
  }

  await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
  await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
  for (const userId of userIdsToClear) {
    await context.redis.del(userPendingKeyById(subredditId, userId), userLatestKeyById(subredditId, userId));
  }
}
