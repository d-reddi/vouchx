import type { Devvit } from '@devvit/public-api';
import type {
  AuditRetentionJobData,
  RedditRedisContext,
  RedisContext,
  RetentionReconcileSummary,
  SchedulerContext,
  ValidationCheckResult,
  VerificationRecord,
} from './types.ts';
import {
  AUDIT_RETENTION_DAYS,
  DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS,
  INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS,
  MILLIS_PER_DAY,
  NON_APPROVED_VALIDATION_BATCH_SIZE,
  NON_APPROVED_VALIDATION_SCAN_MULTIPLIER,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  USER_VALIDATION_SCHEDULE_LOCK_TTL_MS,
  USER_VALIDATION_SCHEDULE_PRESENT_TTL_MS,
  VALIDATION_BATCH_SIZE,
  VALIDATION_CHECK_INTERVAL_DAYS,
  VALIDATION_HARD_EXPIRY_DAYS,
  LEGACY_VERIFIED_RECORD_RETENTION_DAYS,
  VERIFIED_RECORD_RETENTION_DAYS,
  VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS,
} from './constants.ts';
import {
  approvedIndexKey,
  auditDateIndexKey,
  auditEntryKey,
  historyByModeratorIndexKey,
  historyByUserIndexKey,
  historyDateIndexKey,
  pendingIndexKey,
  userLatestKey,
  userPendingKey,
  validationBackfillCursorKey,
  validationDueIndexKey,
  validationHardExpireIndexKey,
  validationNonApprovedCursorKey,
  validationNonApprovedFailureCountKey,
  validationRunLockKey,
  validationScheduleLockKey,
  validationSchedulePresentKey,
  verificationRecordKey,
} from './keys.ts';
import { createRedisLockToken, releaseRedisLockIfOwned } from './locks.ts';
import {
  addDaysIso,
  errorText,
  looksLikeDeletedOrSuspendedError,
  looksLikeTransientRedditTransportError,
  maskUsernameForLog,
  normalizeUsername,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernamesEqual,
} from './normalize.ts';
import {
  deleteUserLatestPointers,
  deleteUserPendingPointers,
  findLatestExistingRecordIdForUser,
  getApprovedRecordRetentionAnchorMs,
  getRecord,
  getRecordUserId,
  mGetStringValuesInChunks,
  parseAuditEntry,
  parseRecord,
  removeApprovedPrefixIndexEntries,
  setRecord,
  setUserLatestPointer,
  sweepStaleRecordIndexEntries,
} from './records.ts';
import { parseNonNegativeInt } from './settings.ts';
import { purgeUserVerificationData } from './purge.ts';

const TRANSIENT_MAINTENANCE_RETRY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryTransientMaintenanceOperation<ValueType>(
  operation: () => Promise<ValueType>
): Promise<ValueType> {
  for (let attempt = 0; attempt < TRANSIENT_MAINTENANCE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt >= TRANSIENT_MAINTENANCE_RETRY_ATTEMPTS - 1 ||
        !looksLikeTransientRedditTransportError(errorText(error))
      ) {
        throw error;
      }
      await sleep(150 * (attempt + 1));
    }
  }
  return await operation();
}

export async function pruneHistoryOlderThanDays(
  context: RedisContext,
  subredditId: string,
  olderThanDays: number
): Promise<number> {
  if (olderThanDays < 1) {
    return 0;
  }

  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const staleCandidates = await retryTransientMaintenanceOperation(() =>
    context.redis.zRange(historyDateIndexKey(subredditId), 0, cutoffMs, { by: 'score' })
  );
  if (staleCandidates.length === 0) {
    return 0;
  }

  const candidateIds = staleCandidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const missingIds = new Set<string>();
  const recordIdsToDelete = new Set<string>();
  const byUser = new Map<string, string[]>();
  const userIdByUsername = new Map<string, string>();
  const byModerator = new Map<string, string[]>();
  const approvedPrefixEntries: Array<{ recordId: string; username: string }> = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      missingIds.add(recordId);
      continue;
    }

    const parsed = parseRecord(payload);
    if (!parsed) {
      missingIds.add(recordId);
      continue;
    }

    if (
      parsed.status === 'approved' &&
      getApprovedRecordRetentionAnchorMs(parsed, nowMs) +
        (typeof parsed.retentionDays === 'number' && parsed.retentionDays > 0
          ? parsed.retentionDays
          : LEGACY_VERIFIED_RECORD_RETENTION_DAYS) *
          MILLIS_PER_DAY >
        nowMs
    ) {
      continue;
    }

    const normalizedUsername = normalizeUsername(parsed.username);
    const userIds = byUser.get(normalizedUsername) ?? [];
    userIds.push(recordId);
    byUser.set(normalizedUsername, userIds);
    if (getRecordUserId(parsed)) {
      userIdByUsername.set(normalizedUsername, getRecordUserId(parsed));
    }

    if (parsed.moderator) {
      const normalizedModerator = normalizeUsername(parsed.moderator);
      const modIds = byModerator.get(normalizedModerator) ?? [];
      modIds.push(recordId);
      byModerator.set(normalizedModerator, modIds);
    }
    if (parsed.status === 'approved') {
      approvedPrefixEntries.push({ recordId, username: parsed.username });
    }

    recordIdsToDelete.add(recordId);
  }

  const recordDeleteList = Array.from(recordIdsToDelete);
  const idsToRemoveFromDate = Array.from(new Set([...recordDeleteList, ...Array.from(missingIds)]));
  if (idsToRemoveFromDate.length > 0) {
    await context.redis.zRem(historyDateIndexKey(subredditId), idsToRemoveFromDate);
    await removeValidationTrackingForRecordIds(context, subredditId, idsToRemoveFromDate);
  }

  if (recordDeleteList.length === 0) {
    return 0;
  }

  await context.redis.zRem(pendingIndexKey(subredditId), recordDeleteList);
  await context.redis.zRem(approvedIndexKey(subredditId), recordDeleteList);
  await removeApprovedPrefixIndexEntries(context, subredditId, approvedPrefixEntries);
  await removeValidationTrackingForRecordIds(context, subredditId, recordDeleteList);
  await context.redis.del(...recordDeleteList.map((recordId) => verificationRecordKey(subredditId, recordId)));

  for (const [normalizedUsername, deletedIds] of byUser.entries()) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), deletedIds);
    const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
    if (pendingId && deletedIds.includes(pendingId)) {
      await deleteUserPendingPointers(context, subredditId, normalizedUsername, userIdByUsername.get(normalizedUsername) ?? '');
    }
    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId && deletedIds.includes(latestId)) {
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
          await deleteUserLatestPointers(
            context,
            subredditId,
            normalizedUsername,
            userIdByUsername.get(normalizedUsername) ?? ''
          );
        }
      } else {
        await deleteUserLatestPointers(context, subredditId, normalizedUsername, userIdByUsername.get(normalizedUsername) ?? '');
      }
    }
  }

  for (const [normalizedModerator, deletedIds] of byModerator.entries()) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), deletedIds);
  }

  return recordDeleteList.length;
}

export async function getModMenuAuditPurgeMinAgeDays(
  context: Pick<Devvit.Context, 'settings'>
): Promise<number> {
  const rawValue = await context.settings.get<number | string>(INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS);
  const parsedValue = typeof rawValue === 'number'
    ? Number.isFinite(rawValue)
      ? Math.max(0, Math.floor(rawValue))
      : DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS
    : typeof rawValue === 'string'
      ? parseNonNegativeInt(rawValue, DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS) ??
        DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS
      : DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS;
  return Math.max(DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS, parsedValue);
}

export function isApprovedRetentionBumpDue(record: VerificationRecord, nowMs = Date.now()): boolean {
  if (record.status !== 'approved') {
    return false;
  }
  const lastTtlBumpAt =
    typeof record.lastTtlBumpAt === 'number' && Number.isFinite(record.lastTtlBumpAt)
      ? Math.max(0, Math.floor(record.lastTtlBumpAt))
      : 0;
  if (lastTtlBumpAt > 0 && nowMs - lastTtlBumpAt < VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS) {
    return false;
  }
  return true;
}

export async function bumpViewerVerifiedRecordRetention(
  context: RedisContext,
  subredditId: string,
  viewerUsername: string,
  record: VerificationRecord
): Promise<VerificationRecord> {
  if (record.status !== 'approved' || !usernamesEqual(record.username, viewerUsername)) {
    return record;
  }
  const nowMs = Date.now();
  if (!isApprovedRetentionBumpDue(record, nowMs)) {
    return record;
  }
  const bumpedRecord: VerificationRecord = {
    ...record,
    lastTtlBumpAt: nowMs,
  };
  try {
    await setRecord(context, subredditId, bumpedRecord);
    return bumpedRecord;
  } catch (error) {
    console.log(
      `Drive-by retention bump failed for r/${sanitizeSubredditId(subredditId)} u/${maskUsernameForLog(viewerUsername)}: ${errorText(error)}`
    );
    return record;
  }
}

export function applyValidationSchedule(record: VerificationRecord, nowMs: number): VerificationRecord {
  return {
    ...record,
    lastValidatedAt: new Date(nowMs).toISOString(),
    nextValidationAt: addDaysIso(VALIDATION_CHECK_INTERVAL_DAYS, nowMs),
    hardExpireAt: addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, nowMs),
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
  };
}

export function initializeValidationScheduleFromRecord(record: VerificationRecord, fallbackNowMs: number): VerificationRecord {
  const reviewedMs = record.reviewedAt ? new Date(record.reviewedAt).getTime() : Number.NaN;
  const submittedMs = new Date(record.submittedAt).getTime();
  const baseMs = Number.isFinite(reviewedMs)
    ? reviewedMs
    : Number.isFinite(submittedMs)
      ? submittedMs
      : fallbackNowMs;
  return {
    ...record,
    lastValidatedAt: new Date(baseMs).toISOString(),
    nextValidationAt: addDaysIso(VALIDATION_CHECK_INTERVAL_DAYS, baseMs),
    hardExpireAt: addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, baseMs),
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
  };
}

function getValidationHardExpireAt(record: VerificationRecord, nowMs: number): string {
  const hardExpireMs = record.hardExpireAt ? new Date(record.hardExpireAt).getTime() : Number.NaN;
  return Number.isFinite(hardExpireMs) ? record.hardExpireAt! : addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, nowMs);
}

export async function upsertValidationTracking(
  context: RedisContext,
  subredditId: string,
  record: VerificationRecord
): Promise<void> {
  if (record.status !== 'approved' || !record.nextValidationAt || !record.hardExpireAt) {
    await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);
    return;
  }

  const dueMs = new Date(record.nextValidationAt).getTime();
  const hardExpireMs = new Date(record.hardExpireAt).getTime();
  if (!Number.isFinite(dueMs) || !Number.isFinite(hardExpireMs)) {
    await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);
    return;
  }

  await context.redis.zAdd(validationDueIndexKey(subredditId), { member: record.id, score: dueMs });
  await context.redis.zAdd(validationHardExpireIndexKey(subredditId), { member: record.id, score: hardExpireMs });
}

export async function removeValidationTrackingForRecordIds(
  context: RedisContext,
  subredditId: string,
  recordIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(recordIds.filter((recordId) => recordId.trim().length > 0)));
  if (uniqueIds.length === 0) {
    return;
  }
  await context.redis.zRem(validationDueIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(validationHardExpireIndexKey(subredditId), uniqueIds);
}

export async function backfillValidationTracking(
  context: RedisContext,
  subredditId: string,
  batchSize: number
): Promise<void> {
  const cursorRaw = await context.redis.get(validationBackfillCursorKey(subredditId));
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const members = await retryTransientMaintenanceOperation(() =>
    context.redis.zRange(approvedIndexKey(subredditId), cursor, cursor + batchSize - 1, {
      by: 'rank',
      reverse: true,
    })
  );

  if (members.length === 0) {
    await context.redis.del(validationBackfillCursorKey(subredditId));
    return;
  }

  const recordIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    recordIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const nowMs = Date.now();

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = recordIds[index];
    if (!payload) {
      await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
      continue;
    }
    const record = parseRecord(payload);
    if (!record || record.status !== 'approved') {
      await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
      continue;
    }
    if (record.nextValidationAt && record.hardExpireAt) {
      await upsertValidationTracking(context, subredditId, record);
      continue;
    }
    const initializedRecord = initializeValidationScheduleFromRecord(record, nowMs);
    await setRecord(context, subredditId, initializedRecord);
    await upsertValidationTracking(context, subredditId, initializedRecord);
  }

  await context.redis.set(validationBackfillCursorKey(subredditId), `${cursor + members.length}`);
}

export async function ensureUserValidationSchedule(
  context: SchedulerContext,
  subredditId: string,
  subredditName: string
): Promise<void> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedSubreddit = sanitizeSubredditName(subredditName);
  if (!normalizedSubredditId || !normalizedSubreddit) {
    return;
  }

  const lockKey = validationScheduleLockKey(normalizedSubredditId);
  const presenceKey = validationSchedulePresentKey(normalizedSubredditId);
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  try {
    try {
      if (await context.redis.get(presenceKey)) {
        return;
      }
    } catch {
      // Continue without the presence marker if Redis read-through fails.
    }

    const lock = await context.redis.set(lockKey, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + USER_VALIDATION_SCHEDULE_LOCK_TTL_MS),
    });
    if (lock !== 'OK') {
      return;
    }
    lockAcquired = true;

    const jobs = await retryTransientMaintenanceOperation(() => context.scheduler.listJobs());
    const alreadyScheduled = jobs.some((job) => {
      if (job.name !== USER_VALIDATION_JOB_NAME) {
        return false;
      }
      const jobData = (job.data ?? {}) as Partial<AuditRetentionJobData>;
      return sanitizeSubredditId(jobData.subredditId ?? '') === normalizedSubredditId;
    });

    if (!alreadyScheduled) {
      await retryTransientMaintenanceOperation(() =>
        context.scheduler.runJob({
          name: USER_VALIDATION_JOB_NAME,
          cron: USER_VALIDATION_CRON,
          data: {
            subredditId: normalizedSubredditId,
            subredditName: normalizedSubreddit,
          },
        })
      );
    }

    try {
      await context.redis.set(presenceKey, '1', {
        expiration: new Date(Date.now() + USER_VALIDATION_SCHEDULE_PRESENT_TTL_MS),
      });
    } catch {
      // Best-effort marker only.
    }
    return;
  } catch (error) {
    console.log(`[user-validation] Failed to schedule validation for r/${normalizedSubreddit}: ${errorText(error)}`);
  } finally {
    if (lockAcquired) {
      try {
        await releaseRedisLockIfOwned(context, lockKey, lockToken);
      } catch (error) {
        console.log(`[user-validation] Failed to release schedule lock for r/${normalizedSubreddit}: ${errorText(error)}`);
      }
    }
  }
}

export async function reconcileApprovedUsersForRetention(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string
): Promise<RetentionReconcileSummary> {
  const lockKey = validationRunLockKey(subredditId);
  const lockToken = createRedisLockToken();
  const lock = await retryTransientMaintenanceOperation(() =>
    context.redis.set(lockKey, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + 5 * 60 * 1000),
    })
  );
  if (lock !== 'OK') {
    return {
      processed: 0,
      validated: 0,
      purged: 0,
      retried: 0,
      nonApprovedProcessed: 0,
      nonApprovedValidated: 0,
      nonApprovedPurged: 0,
      nonApprovedRetried: 0,
      auditPurged: 0,
      staleIndexEntriesPurged: 0,
      skipped: true,
    };
  }

  try {
    const staleIndexEntriesPurged = await sweepStaleRecordIndexEntries(context, subredditId);
    await backfillValidationTracking(context, subredditId, VALIDATION_BATCH_SIZE);
    const nowMs = Date.now();
    const hardExpired = await retryTransientMaintenanceOperation(() =>
      context.redis.zRange(validationHardExpireIndexKey(subredditId), 0, nowMs, {
        by: 'score',
        limit: { offset: 0, count: VALIDATION_BATCH_SIZE },
      })
    );
    const due = await retryTransientMaintenanceOperation(() =>
      context.redis.zRange(validationDueIndexKey(subredditId), 0, nowMs, {
        by: 'score',
        limit: { offset: 0, count: VALIDATION_BATCH_SIZE },
      })
    );
    const candidateIds = Array.from(
      new Set([...hardExpired.map((entry) => entry.member), ...due.map((entry) => entry.member)])
    ).slice(0, VALIDATION_BATCH_SIZE);

    let processed = 0;
    let validated = 0;
    let purged = 0;
    let retried = 0;

    for (const recordId of candidateIds) {
      const record = await getRecord(context, subredditId, recordId);
      if (!record || record.status !== 'approved') {
        await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
        continue;
      }

      processed += 1;
      const check = await validateVerificationUserState(context, record);
      if (check.outcome === 'valid') {
        const refreshedRecord = applyValidationSchedule(
          {
            ...record,
            validationFailureCount: 0,
            terminalValidationFailureCount: 0,
          },
          nowMs
        );
        await setRecord(context, subredditId, refreshedRecord);
        await upsertValidationTracking(context, subredditId, refreshedRecord);
        validated += 1;
        continue;
      }

      if (check.outcome === 'account_unavailable') {
        const terminalFailures = (record.terminalValidationFailureCount ?? 0) + 1;
        if (terminalFailures < 2) {
          const confirmRecord: VerificationRecord = {
            ...record,
            terminalValidationFailureCount: terminalFailures,
            nextValidationAt: addDaysIso(1, nowMs),
            hardExpireAt: getValidationHardExpireAt(record, nowMs),
          };
          await setRecord(context, subredditId, confirmRecord);
          await upsertValidationTracking(context, subredditId, confirmRecord);
          retried += 1;
          continue;
        }
        await purgeUserVerificationData(context, subredditId, subredditName, record.username, {
          removeFlair: false,
          removeAuditEntries: true,
          clearModerationRecords: true,
        });
        purged += 1;
        continue;
      }

      const currentFailures = (record.validationFailureCount ?? 0) + 1;
      const retryRecord: VerificationRecord = {
        ...record,
        validationFailureCount: currentFailures,
        terminalValidationFailureCount: 0,
        nextValidationAt: addDaysIso(1, nowMs),
        hardExpireAt: getValidationHardExpireAt(record, nowMs),
      };
      await setRecord(context, subredditId, retryRecord);
      await upsertValidationTracking(context, subredditId, retryRecord);
      retried += 1;
    }

    const nonApprovedSummary = await reconcileNonApprovedUsersForRetention(context, subredditId, subredditName);
    const auditPurged = await purgeAuditLogOlderThanDays(context, subredditId, AUDIT_RETENTION_DAYS);

    return {
      processed,
      validated,
      purged,
      retried,
      nonApprovedProcessed: nonApprovedSummary.processed,
      nonApprovedValidated: nonApprovedSummary.validated,
      nonApprovedPurged: nonApprovedSummary.purged,
      nonApprovedRetried: nonApprovedSummary.retried,
      auditPurged,
      staleIndexEntriesPurged,
      skipped: false,
    };
  } finally {
    await releaseRedisLockIfOwned(context, lockKey, lockToken);
  }
}

export async function reconcileNonApprovedUsersForRetention(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string
): Promise<{ processed: number; validated: number; purged: number; retried: number }> {
  const cursorRaw = await context.redis.get(validationNonApprovedCursorKey(subredditId));
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const count = NON_APPROVED_VALIDATION_BATCH_SIZE * NON_APPROVED_VALIDATION_SCAN_MULTIPLIER;
  const members = await retryTransientMaintenanceOperation(() =>
    context.redis.zRange(historyDateIndexKey(subredditId), cursor, cursor + count - 1, {
      by: 'rank',
      reverse: true,
    })
  );

  if (members.length === 0) {
    await context.redis.del(validationNonApprovedCursorKey(subredditId));
    return { processed: 0, validated: 0, purged: 0, retried: 0 };
  }

  const candidateIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const seenUsernames = new Set<string>();
  const usernamesToCheck: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || parsed.status === 'approved') {
      continue;
    }
    const normalizedUsername = normalizeUsername(parsed.username).replace(/^u\//i, '');
    if (!normalizedUsername || seenUsernames.has(normalizedUsername)) {
      continue;
    }
    seenUsernames.add(normalizedUsername);
    usernamesToCheck.push(parsed.username);
    if (usernamesToCheck.length >= NON_APPROVED_VALIDATION_BATCH_SIZE) {
      break;
    }
  }

  const failureHashKey = validationNonApprovedFailureCountKey(subredditId);
  let processed = 0;
  let validated = 0;
  let purged = 0;
  let retried = 0;

  for (const username of usernamesToCheck) {
    processed += 1;
    const normalizedUsername = normalizeUsername(username).replace(/^u\//i, '');
    if (!normalizedUsername) {
      continue;
    }

    const check = await validateUsernameState(context, normalizedUsername);
    if (check.outcome === 'valid') {
      validated += 1;
      await context.redis.hDel(failureHashKey, [normalizedUsername, `u/${normalizedUsername}`]);
      continue;
    }
    if (check.outcome === 'retry') {
      retried += 1;
      continue;
    }

    const currentFailuresRaw = await context.redis.hGet(failureHashKey, normalizedUsername);
    const currentFailures = Number.parseInt(currentFailuresRaw ?? '0', 10);
    const nextFailures = Number.isFinite(currentFailures) ? currentFailures + 1 : 1;

    if (nextFailures < 2) {
      await context.redis.hSet(failureHashKey, { [normalizedUsername]: `${nextFailures}` });
      retried += 1;
      continue;
    }

    await context.redis.hDel(failureHashKey, [normalizedUsername, `u/${normalizedUsername}`]);
    await purgeUserVerificationData(context, subredditId, subredditName, normalizedUsername, {
      removeFlair: false,
      removeAuditEntries: true,
      clearModerationRecords: true,
    });
    purged += 1;
  }

  const nextCursor = cursor + members.length;
  const totalRecords = await retryTransientMaintenanceOperation(() => context.redis.zCard(historyDateIndexKey(subredditId)));
  if (nextCursor >= totalRecords) {
    await context.redis.del(validationNonApprovedCursorKey(subredditId));
  } else {
    await context.redis.set(validationNonApprovedCursorKey(subredditId), `${nextCursor}`);
  }

  return { processed, validated, purged, retried };
}

export async function validateVerificationUserState(
  context: Pick<Devvit.Context, 'reddit'>,
  record: VerificationRecord
): Promise<ValidationCheckResult> {
  return validateUsernameState(context, record.username);
}

export async function validateUsernameState(context: Pick<Devvit.Context, 'reddit'>, username: string): Promise<ValidationCheckResult> {
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    return { outcome: 'account_unavailable', reason: 'empty username' };
  }

  try {
    const user = await context.reddit.getUserByUsername(normalizedUsername);
    if (!user) {
      return { outcome: 'account_unavailable', reason: 'lookup returned no user' };
    }
    const maybeSuspended = Boolean((user as unknown as { isSuspended?: boolean }).isSuspended);
    if (maybeSuspended) {
      return { outcome: 'account_unavailable', reason: 'account unavailable' };
    }
    return { outcome: 'valid' };
  } catch (error) {
    const message = errorText(error).toLowerCase();
    if (looksLikeDeletedOrSuspendedError(message)) {
      return { outcome: 'account_unavailable', reason: message };
    }
    return { outcome: 'retry', reason: message };
  }
}

export async function purgeAuditLogOlderThanDays(
  context: RedisContext,
  subredditId: string,
  retentionDays: number
): Promise<number> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  if (!normalizedSubredditId) {
    return 0;
  }

  const staleCandidates =
    retentionDays <= 0
      ? await retryTransientMaintenanceOperation(() =>
          context.redis.zRange(auditDateIndexKey(normalizedSubredditId), 0, -1, { by: 'rank' })
        )
      : await retryTransientMaintenanceOperation(() =>
          context.redis.zRange(
            auditDateIndexKey(normalizedSubredditId),
            0,
            Date.now() - retentionDays * 24 * 60 * 60 * 1000,
            { by: 'score' }
          )
        );
  if (staleCandidates.length === 0) {
    return 0;
  }

  const candidateIds = staleCandidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((auditId) => auditEntryKey(normalizedSubredditId, auditId))
  );
  const missingOrInvalidIds: string[] = [];
  const idsToDelete: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const auditId = candidateIds[index];
    if (!payload) {
      missingOrInvalidIds.push(auditId);
      continue;
    }

    const parsed = parseAuditEntry(payload);
    if (!parsed) {
      missingOrInvalidIds.push(auditId);
      continue;
    }

    if (!parsed.subredditId || sanitizeSubredditId(parsed.subredditId) === normalizedSubredditId) {
      idsToDelete.push(auditId);
    }
  }

  const idsToRemoveFromSet = Array.from(new Set([...missingOrInvalidIds, ...idsToDelete]));
  if (idsToRemoveFromSet.length > 0) {
    await context.redis.zRem(auditDateIndexKey(normalizedSubredditId), idsToRemoveFromSet);
  }

  if (idsToDelete.length > 0) {
    await context.redis.del(...idsToDelete.map((auditId) => auditEntryKey(normalizedSubredditId, auditId)));
  }

  return idsToDelete.length;
}
