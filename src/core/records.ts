import type { Devvit } from '@devvit/public-api';
import type {
  AuditAction,
  AuditLogEntry,
  RedisContext,
  StorageUsage,
  VerificationRecord,
  ViewerIdentitySnapshot,
} from './types.ts';
import {
  AUDIT_RETENTION_DAYS,
  HISTORY_RETENTION_DAYS,
  MILLIS_PER_DAY,
  STALE_RECORD_INDEX_SWEEP_BATCH_SIZE,
  STORAGE_MAINTENANCE_COOLDOWN_MS,
  STORAGE_METER_CAP_BYTES,
  LEGACY_VERIFIED_RECORD_RETENTION_DAYS,
  VERIFIED_RECORD_RETENTION_DAYS,
} from './constants.ts';
import { normalizeTemplateId } from './flair.ts';
import {
  approvedIndexKey,
  approvedPrefixIndexKey,
  auditDateIndexKey,
  auditEntryKey,
  blockedUsersKey,
  denialCountKey,
  historyByUserIndexKey,
  historyDateIndexKey,
  makeVerificationId,
  pendingIndexKey,
  staleRecordIndexSweepCursorKey,
  storageCalibrationKey,
  storageMaintenanceCooldownKey,
  subredditConfigKey,
  userLatestKey,
  userLatestKeyById,
  userPendingKey,
  userPendingKeyById,
  verificationRecordKey,
} from './keys.ts';
import {
  getFiniteTimestampMs,
  normalizeUserId,
  normalizeUsername,
  sanitizeSubredditId,
  sanitizeSubredditName,
} from './normalize.ts';
import { parseDenyReason } from './settings.ts';
import { parsePendingAccountDetailsSnapshot } from './submission.ts';
import { parsePendingReviewFlag } from './flags.ts';
import { purgeAuditLogOlderThanDays, removeValidationTrackingForRecordIds } from './retention.ts';

export function getRecordUserId(record: Pick<VerificationRecord, 'userId'> | null | undefined): string {
  return normalizeUserId(record?.userId);
}

export async function setUserPendingPointer(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined,
  recordId: string
): Promise<void> {
  const normalizedUsername = normalizeUsername(username);
  const normalizedUserId = normalizeUserId(userId);
  await context.redis.set(userPendingKey(subredditId, normalizedUsername), recordId);
  if (normalizedUserId) {
    await context.redis.set(userPendingKeyById(subredditId, normalizedUserId), recordId);
  }
}

export async function setUserLatestPointer(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined,
  recordId: string
): Promise<void> {
  const normalizedUsername = normalizeUsername(username);
  const normalizedUserId = normalizeUserId(userId);
  await context.redis.set(userLatestKey(subredditId, normalizedUsername), recordId);
  if (normalizedUserId) {
    await context.redis.set(userLatestKeyById(subredditId, normalizedUserId), recordId);
  }
}

export async function deleteUserPendingPointers(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined
): Promise<void> {
  const keys = [userPendingKey(subredditId, normalizeUsername(username))];
  const normalizedUserId = normalizeUserId(userId);
  if (normalizedUserId) {
    keys.push(userPendingKeyById(subredditId, normalizedUserId));
  }
  await context.redis.del(...keys);
}

export async function deleteUserLatestPointers(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined
): Promise<void> {
  const keys = [userLatestKey(subredditId, normalizeUsername(username))];
  const normalizedUserId = normalizeUserId(userId);
  if (normalizedUserId) {
    keys.push(userLatestKeyById(subredditId, normalizedUserId));
  }
  await context.redis.del(...keys);
}

export async function clearUserPendingPointersIfMatch(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined,
  recordId: string
): Promise<void> {
  const normalizedUsername = normalizeUsername(username);
  const normalizedUserId = normalizeUserId(userId);
  const usernameKey = userPendingKey(subredditId, normalizedUsername);
  const usernamePendingId = await context.redis.get(usernameKey);
  if (usernamePendingId === recordId) {
    await context.redis.del(usernameKey);
  }
  if (normalizedUserId) {
    const userIdKey = userPendingKeyById(subredditId, normalizedUserId);
    const userIdPendingId = await context.redis.get(userIdKey);
    if (userIdPendingId === recordId) {
      await context.redis.del(userIdKey);
    }
  }
}

export async function backfillUserRecordPointers(
  context: RedisContext,
  subredditId: string,
  record: VerificationRecord
): Promise<void> {
  const normalizedUserId = getRecordUserId(record);
  if (!normalizedUserId) {
    return;
  }
  await setUserLatestPointer(context, subredditId, record.username, normalizedUserId, record.id);
  if (record.status === 'pending') {
    await setUserPendingPointer(context, subredditId, record.username, normalizedUserId, record.id);
    return;
  }
  await context.redis.del(userPendingKeyById(subredditId, normalizedUserId));
}

export async function getLatestRecordForUserId(
  context: Devvit.Context,
  subredditId: string,
  userId: string
): Promise<VerificationRecord | null> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  const pointerKey = userLatestKeyById(subredditId, normalizedUserId);
  const id = await context.redis.get(pointerKey);
  if (!id) {
    return null;
  }

  const record = await getRecord(context, subredditId, id);
  if (!record || getRecordUserId(record) !== normalizedUserId) {
    await context.redis.del(pointerKey, userPendingKeyById(subredditId, normalizedUserId));
    return null;
  }

  await backfillUserRecordPointers(context, subredditId, record);
  return record;
}

export async function findLatestExistingRecordIdForUser(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<string | null> {
  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
    reverse: true,
  });
  if (historyEntries.length === 0) {
    return null;
  }

  const historyIds = historyEntries.map((entry) => entry.member);
  const payloads = await context.redis.mGet(historyIds.map((id) => verificationRecordKey(subredditId, id)));
  const staleHistoryIds: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      staleHistoryIds.push(historyIds[index]);
      continue;
    }
    const parsed = parseRecord(payload);
    if (parsed) {
      return historyIds[index];
    }
    staleHistoryIds.push(historyIds[index]);
  }

  if (staleHistoryIds.length > 0) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), staleHistoryIds);
  }

  return null;
}

export async function removeRecordIdsFromGlobalIndexes(
  context: RedisContext,
  subredditId: string,
  recordIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(recordIds.map((recordId) => recordId.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return;
  }

  await context.redis.zRem(historyDateIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(pendingIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(approvedIndexKey(subredditId), uniqueIds);
  await removeValidationTrackingForRecordIds(context, subredditId, uniqueIds);
}

export async function sweepStaleRecordIndexEntries(
  context: RedisContext,
  subredditId: string,
  batchSize = STALE_RECORD_INDEX_SWEEP_BATCH_SIZE
): Promise<number> {
  const cursorKey = staleRecordIndexSweepCursorKey(subredditId);
  const cursorRaw = await context.redis.get(cursorKey);
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const members = await context.redis.zRange(historyDateIndexKey(subredditId), cursor, cursor + batchSize - 1, {
    by: 'rank',
  });

  if (members.length === 0) {
    await context.redis.del(cursorKey);
    return 0;
  }

  const candidateIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );

  const staleIds: string[] = [];
  let liveCount = 0;
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      staleIds.push(candidateIds[index]);
      continue;
    }
    if (!parseRecord(payload)) {
      staleIds.push(candidateIds[index]);
      continue;
    }
    liveCount += 1;
  }

  if (staleIds.length > 0) {
    await removeRecordIdsFromGlobalIndexes(context, subredditId, staleIds);
  }

  const totalRecords = await context.redis.zCard(historyDateIndexKey(subredditId));
  const nextCursor = cursor + liveCount;
  if (nextCursor >= totalRecords) {
    await context.redis.del(cursorKey);
  } else {
    await context.redis.set(cursorKey, `${nextCursor}`);
  }

  return staleIds.length;
}

type StorageCalibration = {
  avgRecordBytes: number;
  avgAuditBytes: number;
  sampledAtMs: number;
  hasRecordSample: boolean;
  hasAuditSample: boolean;
};

type StorageSample =
  | { status: 'sampled'; averageBytes: number }
  | { status: 'empty' }
  | { status: 'failed' };

type StorageCalibrationResult =
  | { status: 'available'; calibration: StorageCalibration }
  | { status: 'unavailable' };

// Fallbacks used until a live sample exists (brand-new installs) or when a sample yields nothing.
const STORAGE_FALLBACK_BYTES_PER_RECORD = 1100; // record JSON (photo URLs + metadata)
const STORAGE_FALLBACK_BYTES_PER_AUDIT = 500; // audit entry JSON
// Bounded sample so the meter measures real payload sizes instead of guessing. Newest-N is
// intentionally a touch conservative (the pending queue carries the heavier account snapshot),
// which is the safe direction for a capacity gauge. strLen reads the at-rest byte length, so this
// automatically tracks Devvit's transparent compression if `redisCompressed` is ever adopted.
const STORAGE_CALIBRATION_SAMPLE_SIZE = 25;
const STORAGE_CALIBRATION_TTL_MS = 12 * 60 * 60 * 1000;
const STORAGE_ESTIMATE_HEADROOM_MULTIPLIER = 1.35;

async function sampleAverageStoredBytes(
  context: RedisContext,
  indexKey: string,
  toEntryKey: (id: string) => string
): Promise<StorageSample> {
  try {
    const members = await context.redis.zRange(indexKey, 0, STORAGE_CALIBRATION_SAMPLE_SIZE - 1, {
      by: 'rank',
      reverse: true,
    });
    if (members.length === 0) {
      return { status: 'empty' };
    }
    const lengths = await Promise.all(members.map((entry) => context.redis.strLen(toEntryKey(entry.member))));
    if (lengths.some((length) => length <= 0)) {
      return { status: 'failed' };
    }
    let total = 0;
    let counted = 0;
    for (const length of lengths) {
      if (length > 0) {
        total += length;
        counted += 1;
      }
    }
    return counted > 0 ? { status: 'sampled', averageBytes: total / counted } : { status: 'empty' };
  } catch {
    return { status: 'failed' };
  }
}

function parseStorageCalibration(payload: string | null | undefined): StorageCalibration | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<StorageCalibration>;
    if (
      typeof parsed.avgRecordBytes !== 'number' ||
      parsed.avgRecordBytes <= 0 ||
      typeof parsed.avgAuditBytes !== 'number' ||
      parsed.avgAuditBytes <= 0
    ) {
      return null;
    }
    return {
      avgRecordBytes: Math.round(parsed.avgRecordBytes),
      avgAuditBytes: Math.round(parsed.avgAuditBytes),
      sampledAtMs:
        typeof parsed.sampledAtMs === 'number' && Number.isFinite(parsed.sampledAtMs)
          ? Math.max(0, Math.floor(parsed.sampledAtMs))
          : 0,
      hasRecordSample: parsed.hasRecordSample === true,
      hasAuditSample: parsed.hasAuditSample === true,
    };
  } catch {
    return null;
  }
}

// Keep the highest successful payload averages durably. A failed refresh never overwrites this
// high-water calibration and never produces a numeric estimate presented as current.
async function getStorageCalibration(
  context: RedisContext,
  subredditId: string,
  recordCount: number,
  auditCount: number
): Promise<StorageCalibrationResult> {
  const cacheKey = storageCalibrationKey(subredditId);
  let cached: StorageCalibration | null = null;
  try {
    cached = parseStorageCalibration(await context.redis.get(cacheKey));
  } catch {
    // Sampling can still establish a trustworthy estimate for this request.
  }

  const nowMs = Date.now();
  const cacheIsFresh = Boolean(
    cached &&
      cached.sampledAtMs > 0 &&
      nowMs - cached.sampledAtMs < STORAGE_CALIBRATION_TTL_MS &&
      (recordCount === 0 || cached.hasRecordSample) &&
      (auditCount === 0 || cached.hasAuditSample)
  );
  if (cached && cacheIsFresh) {
    return { status: 'available', calibration: cached };
  }

  const [recordSample, auditSample] = await Promise.all([
    sampleAverageStoredBytes(
      context,
      historyDateIndexKey(subredditId),
      (id) => verificationRecordKey(subredditId, id)
    ),
    sampleAverageStoredBytes(
      context,
      auditDateIndexKey(subredditId),
      (id) => auditEntryKey(subredditId, id)
    ),
  ]);
  const recordSampleSucceeded = recordCount === 0 || recordSample.status === 'sampled';
  const auditSampleSucceeded = auditCount === 0 || auditSample.status === 'sampled';
  if (!recordSampleSucceeded || !auditSampleSucceeded) {
    return { status: 'unavailable' };
  }

  const calibration: StorageCalibration = {
    avgRecordBytes: Math.max(
      STORAGE_FALLBACK_BYTES_PER_RECORD,
      cached?.avgRecordBytes ?? 0,
      recordSample.status === 'sampled' ? Math.round(recordSample.averageBytes) : 0
    ),
    avgAuditBytes: Math.max(
      STORAGE_FALLBACK_BYTES_PER_AUDIT,
      cached?.avgAuditBytes ?? 0,
      auditSample.status === 'sampled' ? Math.round(auditSample.averageBytes) : 0
    ),
    sampledAtMs: nowMs,
    hasRecordSample: cached?.hasRecordSample === true || recordSample.status === 'sampled',
    hasAuditSample: cached?.hasAuditSample === true || auditSample.status === 'sampled',
  };
  try {
    await context.redis.set(cacheKey, JSON.stringify(calibration));
  } catch {
    // Best-effort persistence; this request still has a successful live calibration.
  }
  return { status: 'available', calibration };
}

export async function estimateSubredditStorageUsage(
  context: Devvit.Context,
  subredditId: string
): Promise<StorageUsage> {
  let shouldRunMaintenance = true;
  try {
    shouldRunMaintenance =
      (await context.redis.set(storageMaintenanceCooldownKey(subredditId), '1', {
        nx: true,
        expiration: new Date(Date.now() + STORAGE_MAINTENANCE_COOLDOWN_MS),
      })) === 'OK';
  } catch {
    // Preserve the previous best-effort behavior if the cooldown claim itself fails.
  }
  if (shouldRunMaintenance) {
    await sweepStaleRecordIndexEntries(context, subredditId);
    await purgeAuditLogOlderThanDays(context, subredditId, AUDIT_RETENTION_DAYS);
  }
  const recordCount = await context.redis.zCard(historyDateIndexKey(subredditId));
  const pendingCount = await context.redis.zCard(pendingIndexKey(subredditId));
  const approvedCount = await context.redis.zCard(approvedIndexKey(subredditId));
  const auditCount = await context.redis.zCard(auditDateIndexKey(subredditId));
  const blockedCount = await context.redis.hLen(blockedUsersKey(subredditId));
  const deniedCountEntries = await context.redis.hLen(denialCountKey(subredditId));
  const configMap = await context.redis.hGetAll(subredditConfigKey(subredditId));
  const configBytes = Object.entries(configMap).reduce(
    (sum, [key, value]) => sum + utf8ByteLength(key) + utf8ByteLength(value),
    0
  );

  // Capacity approximation that avoids expensive full scans. Payload sizes (record + audit JSON)
  // are measured from a small live sample and cached (see getStorageCalibration); the structural
  // costs below — sorted-set memberships and pointer keys, whose Redis overhead the old
  // payload-only estimate ignored — stay heuristic over-estimates since sorted sets have no strLen.
  // ~20% precision is fine for a capacity gauge. All counts come from cheap zCard/hLen.
  const calibrationResult = await getStorageCalibration(context, subredditId, recordCount, auditCount);
  if (calibrationResult.status === 'unavailable') {
    return {
      estimateStatus: 'unavailable',
      estimatedBytes: null,
      capBytes: STORAGE_METER_CAP_BYTES,
      percent: null,
      calibratedAt: null,
      recordCount,
      auditCount,
      blockedCount,
      deniedCountEntries,
    };
  }
  const { avgRecordBytes, avgAuditBytes, sampledAtMs } = calibrationResult.calibration;
  const BYTES_PER_ZSET_MEMBERSHIP = 100; // one sorted-set entry: member id + score + overhead
  const BYTES_PER_POINTER_KEY = 150; // one pointer key: key string + value + overhead

  // Every record sits in history:date + history:user and carries latest pointers (by-name + by-id).
  const recordBytes =
    recordCount * (avgRecordBytes + 2 * BYTES_PER_ZSET_MEMBERSHIP + 2 * BYTES_PER_POINTER_KEY);
  // Pending records add the pending sorted set plus pending pointers (by-name + by-id).
  const pendingOverheadBytes = pendingCount * (BYTES_PER_ZSET_MEMBERSHIP + 2 * BYTES_PER_POINTER_KEY);
  // Approved records add approved + approved-prefix + validation-due + validation-hard-expire sets.
  const approvedOverheadBytes = approvedCount * (4 * BYTES_PER_ZSET_MEMBERSHIP);
  // Audit entries are a payload plus their date-index membership.
  const auditBytes = auditCount * (avgAuditBytes + BYTES_PER_ZSET_MEMBERSHIP);

  const estimatedBytes = Math.ceil(
    (configBytes +
      recordBytes +
      pendingOverheadBytes +
      approvedOverheadBytes +
      auditBytes +
      blockedCount * 220 +
      deniedCountEntries * 60) *
      STORAGE_ESTIMATE_HEADROOM_MULTIPLIER
  );
  const percent = Math.max(0, Math.min(100, Math.round((estimatedBytes / STORAGE_METER_CAP_BYTES) * 1000) / 10));
  return {
    estimateStatus: 'available',
    estimatedBytes,
    capBytes: STORAGE_METER_CAP_BYTES,
    percent,
    calibratedAt: new Date(sampledAtMs).toISOString(),
    recordCount,
    auditCount,
    blockedCount,
    deniedCountEntries,
  };
}

export function emptyStorageUsage(): StorageUsage {
  return {
    estimateStatus: 'available',
    estimatedBytes: 0,
    capBytes: STORAGE_METER_CAP_BYTES,
    percent: 0,
    calibratedAt: null,
    recordCount: 0,
    auditCount: 0,
    blockedCount: 0,
    deniedCountEntries: 0,
  };
}

export async function mGetStringValuesInChunks(
  context: RedisContext,
  keys: string[],
  chunkSize = 250
): Promise<Array<string | null>> {
  if (keys.length === 0) {
    return [];
  }
  const values: Array<string | null> = [];
  for (let index = 0; index < keys.length; index += chunkSize) {
    const chunk = keys.slice(index, index + chunkSize);
    const chunkValues = await context.redis.mGet(chunk);
    values.push(...chunkValues);
  }
  return values;
}

export function utf8ByteLength(input: string): number {
  return Buffer.byteLength(input, 'utf8');
}

export async function appendAuditLog(
  context: Devvit.Context,
  input: Omit<AuditLogEntry, 'id' | 'at'> & { at?: string }
): Promise<string> {
  const id = makeVerificationId(new Date());
  const entry: AuditLogEntry = {
    id,
    subredditId: sanitizeSubredditId(input.subredditId),
    subredditName: sanitizeSubredditName(input.subredditName),
    username: input.username,
    action: input.action,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
    verificationId: input.verificationId,
    notes: input.notes,
    ...(typeof input.turnaroundMs === 'number' && Number.isFinite(input.turnaroundMs) && input.turnaroundMs >= 0
      ? { turnaroundMs: Math.floor(input.turnaroundMs) }
      : {}),
    ...(input.denyReason !== undefined ? { denyReason: input.denyReason } : {}),
  };
  const entryAtMs = getFiniteTimestampMs(entry.at, Date.now());

  await context.redis.set(auditEntryKey(entry.subredditId, id), JSON.stringify(entry), {
    expiration: new Date(entryAtMs + AUDIT_RETENTION_DAYS * MILLIS_PER_DAY),
  });
  await context.redis.zAdd(auditDateIndexKey(entry.subredditId), {
    member: id,
    score: entryAtMs,
  });
  return id;
}

export async function getLatestRecordForUser(
  context: Devvit.Context,
  subredditId: string,
  username: string
): Promise<VerificationRecord | null> {
  const normalizedUsername = normalizeUsername(username);
  let id = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
  if (!id) {
    const fallbackId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
    if (!fallbackId) {
      return null;
    }
    id = fallbackId;
    await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackId);
  }

  const record = await getRecord(context, subredditId, id);
  if (!record) {
    await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
    await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
    const fallbackId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
    if (!fallbackId) {
      return null;
    }
    await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackId);
    const fallbackRecord = await getRecord(context, subredditId, fallbackId);
    if (fallbackRecord) {
      await backfillUserRecordPointers(context, subredditId, fallbackRecord);
    }
    return fallbackRecord;
  }

  await backfillUserRecordPointers(context, subredditId, record);
  return record;
}

export async function getLatestRecordForCurrentViewer(
  context: Devvit.Context,
  subredditId: string,
  viewerIdentity: ViewerIdentitySnapshot
): Promise<VerificationRecord | null> {
  const viewerUserId = normalizeUserId(viewerIdentity.userId || context.userId);
  if (viewerUserId) {
    const recordById = await getLatestRecordForUserId(context, subredditId, viewerUserId);
    if (recordById) {
      return recordById;
    }
  }

  if (viewerIdentity.state !== 'confirmed' || !viewerIdentity.username) {
    return null;
  }

  const recordByUsername = await getLatestRecordForUser(context, subredditId, viewerIdentity.username);
  if (recordByUsername && viewerUserId && getRecordUserId(recordByUsername) === viewerUserId) {
    await backfillUserRecordPointers(context, subredditId, recordByUsername);
  }
  return recordByUsername;
}

export async function getRecord(context: RedisContext, subredditId: string, verificationId: string): Promise<VerificationRecord | null> {
  const payload = await context.redis.get(verificationRecordKey(subredditId, verificationId));
  if (!payload) {
    return null;
  }
  const parsed = parseRecord(payload);
  if (!parsed) {
    return null;
  }
  if (!parsed.subredditId) {
    parsed.subredditId = subredditId;
  }
  return parsed;
}

export function getApprovedRecordRetentionAnchorMs(
  record: Pick<VerificationRecord, 'submittedAt' | 'reviewedAt' | 'lastTtlBumpAt'>,
  fallbackMs = Date.now()
): number {
  if (typeof record.lastTtlBumpAt === 'number' && Number.isFinite(record.lastTtlBumpAt)) {
    return Math.max(0, Math.floor(record.lastTtlBumpAt));
  }

  const reviewedMs = getFiniteTimestampMs(record.reviewedAt, Number.NaN);
  if (Number.isFinite(reviewedMs)) {
    return reviewedMs;
  }

  return getFiniteTimestampMs(record.submittedAt, fallbackMs);
}

export function getHistoryRecordAnchorMs(
  record: Pick<VerificationRecord, 'status' | 'submittedAt' | 'reviewedAt' | 'removedAt'>,
  fallbackMs = Date.now()
): number {
  if (record.status === 'removed') {
    const removedMs = getFiniteTimestampMs(record.removedAt, Number.NaN);
    if (Number.isFinite(removedMs)) {
      return removedMs;
    }
  }

  if (record.status === 'approved' || record.status === 'denied') {
    const reviewedMs = getFiniteTimestampMs(record.reviewedAt, Number.NaN);
    if (Number.isFinite(reviewedMs)) {
      return reviewedMs;
    }
  }

  return getFiniteTimestampMs(record.submittedAt, fallbackMs);
}

export async function setRecord(context: RedisContext, subredditId: string, record: VerificationRecord): Promise<void> {
  const recordToStore: VerificationRecord = {
    ...record,
    subredditId,
  };
  const nowMs = Date.now();
  let expirationMs = nowMs + HISTORY_RETENTION_DAYS * MILLIS_PER_DAY;
  if (recordToStore.status === 'approved') {
    const lastTtlBumpAt = getApprovedRecordRetentionAnchorMs(recordToStore, nowMs);
    recordToStore.lastTtlBumpAt = lastTtlBumpAt;
    const retentionDays =
      typeof recordToStore.retentionDays === 'number' && recordToStore.retentionDays > 0
        ? recordToStore.retentionDays
        : LEGACY_VERIFIED_RECORD_RETENTION_DAYS;
    expirationMs = lastTtlBumpAt + retentionDays * MILLIS_PER_DAY;
  }
  await context.redis.set(verificationRecordKey(subredditId, record.id), JSON.stringify(recordToStore), {
    expiration: new Date(expirationMs),
  });
}

export function parseRecord(payload: string): VerificationRecord | null {
  try {
    const parsed = JSON.parse(payload) as Partial<VerificationRecord>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.username !== 'string' ||
      (parsed.userId !== undefined && typeof parsed.userId !== 'string') ||
      typeof parsed.subredditName !== 'string' ||
      typeof parsed.ageAcknowledgedAt !== 'string' ||
      typeof parsed.submittedAt !== 'string' ||
      typeof parsed.photoOneUrl !== 'string' ||
      typeof parsed.photoTwoUrl !== 'string' ||
      (parsed.photoThreeUrl !== undefined && typeof parsed.photoThreeUrl !== 'string') ||
      (parsed.status !== 'pending' &&
        parsed.status !== 'approved' &&
        parsed.status !== 'denied' &&
        parsed.status !== 'removed')
    ) {
      return null;
    }
    return {
      id: parsed.id,
      username: parsed.username,
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      subredditId:
        typeof parsed.subredditId === 'string' && parsed.subredditId.trim()
          ? sanitizeSubredditId(parsed.subredditId)
          : '',
      subredditName: parsed.subredditName,
      ageAcknowledgedAt: parsed.ageAcknowledgedAt,
      adultOnlySelfPhotosConfirmedAt:
        typeof parsed.adultOnlySelfPhotosConfirmedAt === 'string' ? parsed.adultOnlySelfPhotosConfirmedAt : null,
      termsAcceptedAt: typeof parsed.termsAcceptedAt === 'string' ? parsed.termsAcceptedAt : null,
      submittedAt: parsed.submittedAt,
      photoOneUrl: parsed.photoOneUrl,
      photoTwoUrl: parsed.photoTwoUrl,
      photoThreeUrl: typeof parsed.photoThreeUrl === 'string' ? parsed.photoThreeUrl : '',
      status: parsed.status,
      moderator: typeof parsed.moderator === 'string' ? parsed.moderator : null,
      reviewedAt: typeof parsed.reviewedAt === 'string' ? parsed.reviewedAt : null,
      denyReason: parseDenyReason(typeof parsed.denyReason === 'string' ? parsed.denyReason : undefined),
      denyNotes: typeof parsed.denyNotes === 'string' ? parsed.denyNotes : null,
      claimedBy: typeof parsed.claimedBy === 'string' ? parsed.claimedBy : null,
      claimedAt: typeof parsed.claimedAt === 'string' ? parsed.claimedAt : null,
      reviewFlag: parsePendingReviewFlag(parsed.reviewFlag),
      parentVerificationId: typeof parsed.parentVerificationId === 'string' ? parsed.parentVerificationId : null,
      isResubmission: parsed.isResubmission === true,
      accountDetails: parsePendingAccountDetailsSnapshot(parsed.accountDetails),
      removedAt: typeof parsed.removedAt === 'string' ? parsed.removedAt : null,
      removedBy: typeof parsed.removedBy === 'string' ? parsed.removedBy : null,
      lastValidatedAt: typeof parsed.lastValidatedAt === 'string' ? parsed.lastValidatedAt : null,
      nextValidationAt: typeof parsed.nextValidationAt === 'string' ? parsed.nextValidationAt : null,
      hardExpireAt: typeof parsed.hardExpireAt === 'string' ? parsed.hardExpireAt : null,
      validationFailureCount:
        typeof parsed.validationFailureCount === 'number' && Number.isFinite(parsed.validationFailureCount)
          ? Math.max(0, Math.floor(parsed.validationFailureCount))
          : 0,
      terminalValidationFailureCount:
        typeof parsed.terminalValidationFailureCount === 'number' &&
        Number.isFinite(parsed.terminalValidationFailureCount)
          ? Math.max(0, Math.floor(parsed.terminalValidationFailureCount))
          : 0,
      lastTtlBumpAt:
        typeof parsed.lastTtlBumpAt === 'number' && Number.isFinite(parsed.lastTtlBumpAt)
          ? Math.max(0, Math.floor(parsed.lastTtlBumpAt))
          : null,
      retentionDays:
        typeof parsed.retentionDays === 'number' && Number.isFinite(parsed.retentionDays) && parsed.retentionDays > 0
          ? Math.floor(parsed.retentionDays)
          : null,
      lastAppliedFlairTemplateId:
        typeof parsed.lastAppliedFlairTemplateId === 'string'
          ? normalizeTemplateId(parsed.lastAppliedFlairTemplateId)
          : null,
      lastFlairReconcileAt:
        typeof parsed.lastFlairReconcileAt === 'number' && Number.isFinite(parsed.lastFlairReconcileAt)
          ? Math.max(0, Math.floor(parsed.lastFlairReconcileAt))
          : null,
    };
  } catch {
    return null;
  }
}

export function parseAuditEntry(payload: string): AuditLogEntry | null {
  try {
    const parsed = JSON.parse(payload) as Partial<AuditLogEntry>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.subredditName !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.actor !== 'string' ||
      typeof parsed.at !== 'string' ||
      (parsed.action !== 'approved' &&
        parsed.action !== 'denied' &&
        parsed.action !== 'reopened' &&
        parsed.action !== 'removed_by_mod' &&
        parsed.action !== 'self_removed' &&
        parsed.action !== 'blocked' &&
        parsed.action !== 'unblocked' &&
        parsed.action !== 'audit_purged')
    ) {
      return null;
    }
    const denyReason = parseDenyReason(typeof parsed.denyReason === 'string' ? parsed.denyReason : undefined);
    return {
      id: parsed.id,
      subredditId:
        typeof parsed.subredditId === 'string' && parsed.subredditId.trim()
          ? sanitizeSubredditId(parsed.subredditId)
          : '',
      subredditName: parsed.subredditName,
      username: parsed.username,
      action: parsed.action,
      actor: parsed.actor,
      at: parsed.at,
      verificationId: typeof parsed.verificationId === 'string' ? parsed.verificationId : undefined,
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
      ...(typeof parsed.turnaroundMs === 'number' && Number.isFinite(parsed.turnaroundMs) && parsed.turnaroundMs >= 0
        ? { turnaroundMs: Math.floor(parsed.turnaroundMs) }
        : {}),
      // null marks automated denials; absent/invalid stays undefined (legacy entries).
      ...(parsed.denyReason === null
        ? { denyReason: null }
        : denyReason
          ? { denyReason }
          : {}),
    };
  } catch {
    return null;
  }
}

export function approvedPrefixFromUsername(username: string): string {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    return '';
  }
  return normalized.slice(0, 3);
}

export async function addApprovedPrefixIndexEntry(
  context: RedisContext,
  subredditId: string,
  recordId: string,
  username: string,
  approvedAtMs: number
): Promise<void> {
  const prefix3 = approvedPrefixFromUsername(username);
  if (!prefix3) {
    return;
  }
  await context.redis.zAdd(approvedPrefixIndexKey(subredditId, prefix3), { member: recordId, score: approvedAtMs });
}

export async function removeApprovedPrefixIndexEntry(
  context: RedisContext,
  subredditId: string,
  recordId: string,
  username: string
): Promise<void> {
  const prefix3 = approvedPrefixFromUsername(username);
  if (!prefix3) {
    return;
  }
  await context.redis.zRem(approvedPrefixIndexKey(subredditId, prefix3), [recordId]);
}

export async function removeApprovedPrefixIndexEntries(
  context: RedisContext,
  subredditId: string,
  entries: Array<{ recordId: string; username: string }>
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const membersByKey = new Map<string, Set<string>>();
  for (const entry of entries) {
    const prefix3 = approvedPrefixFromUsername(entry.username);
    if (!prefix3) {
      continue;
    }
    const key = approvedPrefixIndexKey(subredditId, prefix3);
    const members = membersByKey.get(key) ?? new Set<string>();
    members.add(entry.recordId);
    membersByKey.set(key, members);
  }
  for (const [key, members] of membersByKey.entries()) {
    if (members.size > 0) {
      await context.redis.zRem(key, Array.from(members));
    }
  }
}

export function asAuditAction(value: string | undefined): AuditAction | null {
  if (!value) {
    return null;
  }
  return value === 'approved' ||
    value === 'denied' ||
    value === 'reopened' ||
    value === 'removed_by_mod' ||
    value === 'self_removed' ||
    value === 'blocked' ||
    value === 'unblocked' ||
    value === 'audit_purged'
    ? value
    : null;
}

export function formatAuditEntry(entry: AuditLogEntry): string {
  const actor = entry.actor ? `u/${entry.actor}` : 'system';
  switch (entry.action) {
    case 'approved':
      return `Approved by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'denied':
      return `Denied by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'reopened':
      return `Reopened by ${actor}`;
    case 'removed_by_mod':
      return `Removed by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'self_removed':
      return `Self-removed${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'blocked':
      return `Blocked by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'unblocked':
      return `Unblocked by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'audit_purged':
      return `Audit log purged by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    default:
      return entry.notes ?? entry.action;
  }
}
