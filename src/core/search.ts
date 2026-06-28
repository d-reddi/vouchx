import type { Devvit } from '@devvit/public-api';
import type {
  ApprovedSearchPanelItem,
  ApprovedSearchResponsePayload,
  AuditSearchPanelItem,
  AuditSearchResponsePayload,
  AuditWindowCandidate,
  HistorySearchPanelItem,
  HistorySearchResponsePayload,
  ModeratorStatsDecisionTiming,
  ModeratorStatsDenialReasonRow,
  ModeratorStatsModeratorRow,
  ModeratorStatsPayload,
  ModeratorStatsRange,
  RedisContext,
  SearchPhotoLinkFields,
  VerificationRecord,
} from './types.ts';
import {
  APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER,
  FILTERED_SEARCH_SCAN_BATCH_SIZE,
  FILTERED_SEARCH_SCAN_MAX_ENTRIES,
  FILTERED_SEARCH_SCAN_TIME_BUDGET_MS,
  MAX_PENDING_TO_LOAD,
  MILLIS_PER_DAY,
} from './constants.ts';
import { normalizeUsernamePrefixFilter } from './flair.ts';
import {
  approvedIndexKey,
  approvedPrefixIndexKey,
  auditDateIndexKey,
  auditEntryKey,
  historyDateIndexKey,
  pendingIndexKey,
  reopenedChildByDeniedKey,
  reopenedStateByDeniedKey,
  verificationRecordKey,
} from './keys.ts';
import { getFiniteTimestampMs, normalizeUsername, normalizeUsernameForLookup, parseTimestampMs } from './normalize.ts';
import {
  addApprovedPrefixIndexEntry,
  asAuditAction,
  formatAuditEntry,
  mGetStringValuesInChunks,
  parseAuditEntry,
  parseRecord,
  removeApprovedPrefixIndexEntries,
  setRecord,
} from './records.ts';
import { clearExpiredPendingClaim, pendingClaimChanged } from './locks.ts';
import { normalizeSubmittedPhotoUrl, parseDenyReason } from './settings.ts';
import { removeValidationTrackingForRecordIds } from './retention.ts';

function getPendingReviewSortScore(record: VerificationRecord): number {
  const flaggedAtMs = parseTimestampMs(record.reviewFlag?.flaggedAt);
  if (Number.isFinite(flaggedAtMs) && flaggedAtMs > 0) {
    return flaggedAtMs;
  }
  const submittedAtMs = parseTimestampMs(record.submittedAt);
  return Number.isFinite(submittedAtMs) && submittedAtMs > 0 ? submittedAtMs : 0;
}

function comparePendingQueueRecords(left: VerificationRecord, right: VerificationRecord): number {
  const leftFlagged = Boolean(left.reviewFlag);
  const rightFlagged = Boolean(right.reviewFlag);
  if (leftFlagged !== rightFlagged) {
    return leftFlagged ? -1 : 1;
  }
  return getPendingReviewSortScore(left) - getPendingReviewSortScore(right);
}

export async function listPendingVerifications(context: Devvit.Context, subredditId: string): Promise<VerificationRecord[]> {
  const members = await context.redis.zRange(pendingIndexKey(subredditId), 0, MAX_PENDING_TO_LOAD - 1, {
    by: 'rank',
  });

  if (members.length === 0) {
    return [];
  }

  const recordKeys = members.map((member) => verificationRecordKey(subredditId, member.member));
  const payloads = await context.redis.mGet(recordKeys);
  const records: VerificationRecord[] = [];
  const stalePendingIds: string[] = [];
  const claimRecordsToRefresh: VerificationRecord[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      stalePendingIds.push(members[index].member);
      continue;
    }
    const parsed = parseRecord(payload);
    if (parsed && parsed.status === 'pending') {
      if (!parsed.subredditId) {
        parsed.subredditId = subredditId;
      }
      const normalizedRecord = clearExpiredPendingClaim(parsed);
      if (pendingClaimChanged(parsed, normalizedRecord)) {
        claimRecordsToRefresh.push(normalizedRecord);
      }
      records.push(normalizedRecord);
      continue;
    }
    stalePendingIds.push(members[index].member);
  }

  if (claimRecordsToRefresh.length > 0) {
    await Promise.all(claimRecordsToRefresh.map((record) => setRecord(context, subredditId, record)));
  }

  if (stalePendingIds.length > 0) {
    await context.redis.zRem(pendingIndexKey(subredditId), Array.from(new Set(stalePendingIds)));
    await removeValidationTrackingForRecordIds(context, subredditId, stalePendingIds);
  }

  return records.sort(comparePendingQueueRecords);
}

export function toSearchPhotoLinkFields(
  record: Pick<VerificationRecord, 'photoOneUrl' | 'photoTwoUrl' | 'photoThreeUrl'>
): SearchPhotoLinkFields {
  const photoOneUrl = normalizeSubmittedPhotoUrl(record.photoOneUrl);
  const photoTwoUrl = normalizeSubmittedPhotoUrl(record.photoTwoUrl);
  const photoThreeUrl = normalizeSubmittedPhotoUrl(record.photoThreeUrl);
  const fields: SearchPhotoLinkFields = {};
  if (photoOneUrl) {
    fields.photoOneUrl = photoOneUrl;
  }
  if (photoTwoUrl) {
    fields.photoTwoUrl = photoTwoUrl;
  }
  if (photoThreeUrl) {
    fields.photoThreeUrl = photoThreeUrl;
  }
  return fields;
}

export function toApprovedSearchPanelItem(record: VerificationRecord): ApprovedSearchPanelItem {
  return {
    id: record.id,
    username: record.username,
    approvedAt: record.reviewedAt ?? record.submittedAt,
    approvedBy: record.moderator ?? 'unknown',
    acknowledgedAt: record.ageAcknowledgedAt,
    ...toSearchPhotoLinkFields(record),
  };
}

type HistoryStatusFilter = 'all' | 'approved' | 'denied' | 'reopened';

function normalizeHistoryStatusFilter(value: unknown): HistoryStatusFilter {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'approved' || normalized === 'denied' || normalized === 'reopened' ? normalized : 'all';
}

function isReopenedHistoryItem(item: HistorySearchPanelItem): boolean {
  return Boolean(item.parentVerificationId?.trim()) || (item.status === 'denied' && item.reopenedState !== 'none');
}

function shouldConsiderRecordForHistoryStatusFilter(record: VerificationRecord, statusFilter: HistoryStatusFilter): boolean {
  if (statusFilter === 'all') {
    return true;
  }
  if (statusFilter === 'approved') {
    return record.status === 'approved';
  }
  if (statusFilter === 'denied') {
    return record.status === 'denied';
  }
  return record.status === 'denied' || Boolean(record.parentVerificationId?.trim());
}

function matchesHistoryStatusFilter(item: HistorySearchPanelItem, statusFilter: HistoryStatusFilter): boolean {
  if (statusFilter === 'all') {
    return true;
  }
  if (statusFilter === 'approved') {
    return item.status === 'approved';
  }
  if (statusFilter === 'denied') {
    return item.status === 'denied' && !isReopenedHistoryItem(item);
  }
  return isReopenedHistoryItem(item);
}

function toHistorySearchPanelItem(record: VerificationRecord): HistorySearchPanelItem {
  return {
    id: record.id,
    username: record.username,
    status: record.status,
    submittedAt: record.submittedAt,
    acknowledgedAt: record.ageAcknowledgedAt,
    reviewedAt: record.reviewedAt ?? null,
    moderator: record.moderator ?? null,
    denyReason: parseDenyReason(record.denyReason) ?? null,
    parentVerificationId: record.parentVerificationId ?? null,
    reopenedChildId: null,
    reopenedState: 'none',
    ...(record.status === 'approved' ? toSearchPhotoLinkFields(record) : {}),
  };
}

async function enrichHistoryReopenState(
  context: Devvit.Context,
  subredditId: string,
  items: HistorySearchPanelItem[]
): Promise<void> {
  const deniedItems = items.filter((item) => item.status === 'denied');
  if (deniedItems.length === 0) {
    return;
  }

  const [reopenedChildIds, reopenedStates] = await Promise.all([
    mGetStringValuesInChunks(
      context,
      deniedItems.map((item) => reopenedChildByDeniedKey(subredditId, item.id))
    ),
    mGetStringValuesInChunks(
      context,
      deniedItems.map((item) => reopenedStateByDeniedKey(subredditId, item.id))
    ),
  ]);
  const deniedIndexesByChildId = new Map<string, number>();
  const presentChildIds: string[] = [];
  for (let index = 0; index < deniedItems.length; index++) {
    const childId = reopenedChildIds[index];
    const normalizedChildId = typeof childId === 'string' ? childId.trim() : '';
    deniedItems[index].reopenedChildId = normalizedChildId || null;
    deniedItems[index].reopenedState = normalizedChildId
      ? 'yes'
      : reopenedStates[index] === 'cancelled'
        ? 'yes_cancelled'
        : 'none';
    if (normalizedChildId) {
      deniedIndexesByChildId.set(normalizedChildId, index);
      presentChildIds.push(normalizedChildId);
    }
  }

  if (presentChildIds.length === 0) {
    return;
  }

  const childPayloads = await mGetStringValuesInChunks(
    context,
    presentChildIds.map((childId) => verificationRecordKey(subredditId, childId))
  );
  const staleParentIds: string[] = [];
  for (let childIndex = 0; childIndex < childPayloads.length; childIndex++) {
    if (childPayloads[childIndex]) {
      continue;
    }
    const childId = presentChildIds[childIndex];
    const deniedIndex = deniedIndexesByChildId.get(childId);
    if (deniedIndex === undefined) {
      continue;
    }
    deniedItems[deniedIndex].reopenedChildId = null;
    if (deniedItems[deniedIndex].reopenedState === 'yes') {
      deniedItems[deniedIndex].reopenedState = 'none';
    }
    staleParentIds.push(deniedItems[deniedIndex].id);
  }
  if (staleParentIds.length > 0) {
    await context.redis.del(...staleParentIds.map((parentId) => reopenedChildByDeniedKey(subredditId, parentId)));
  }
}

export async function searchHistoryRecords(
  context: Devvit.Context,
  subredditId: string,
  query: {
    status?: string;
    username?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<HistorySearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const statusFilter = normalizeHistoryStatusFilter(query.status);
  const usernameFilter = normalizeUsernamePrefixFilter(query.username, normalizeUsernameForLookup);
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const baseKey = historyDateIndexKey(subredditId);
  const hasRecordFilters = Boolean(usernameFilter || statusFilter !== 'all');
  const batchSize = hasRecordFilters ? FILTERED_SEARCH_SCAN_BATCH_SIZE : limit * 3;
  const maxEntriesToScan = hasRecordFilters ? FILTERED_SEARCH_SCAN_MAX_ENTRIES : batchSize;
  const scanStartedAt = Date.now();
  const items: HistorySearchPanelItem[] = [];
  let scanOffset = offset;
  let inspectedCount = 0;
  let hasMore = false;

  while (inspectedCount < maxEntriesToScan) {
    const requestedCount = Math.min(batchSize, maxEntriesToScan - inspectedCount);
    const loadedCandidates = await context.redis.zRange(baseKey, minScore, maxScore, {
      by: 'score',
      reverse: true,
      limit: { offset: scanOffset, count: hasRecordFilters ? requestedCount + 1 : requestedCount },
    });
    if (loadedCandidates.length === 0) {
      hasMore = false;
      break;
    }

    const candidates = hasRecordFilters ? loadedCandidates.slice(0, requestedCount) : loadedCandidates;
    const hasMoreCandidates = hasRecordFilters && loadedCandidates.length > requestedCount;
    const candidateIds = candidates.map((entry) => entry.member);
    const payloads = await mGetStringValuesInChunks(
      context,
      candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
    );
    const parsedRecords: Array<VerificationRecord | null> = [];
    const candidateItems: Array<HistorySearchPanelItem | null> = [];
    const staleIds: string[] = [];
    for (let index = 0; index < payloads.length; index++) {
      const parsed = payloads[index] ? parseRecord(payloads[index]!) : null;
      parsedRecords.push(parsed);
      if (!parsed) {
        staleIds.push(candidateIds[index]);
        candidateItems.push(null);
        continue;
      }
      if (usernameFilter && !normalizeUsernameForLookup(parsed.username).startsWith(usernameFilter)) {
        candidateItems.push(null);
        continue;
      }
      if (!shouldConsiderRecordForHistoryStatusFilter(parsed, statusFilter)) {
        candidateItems.push(null);
        continue;
      }
      candidateItems.push(toHistorySearchPanelItem(parsed));
    }
    await enrichHistoryReopenState(
      context,
      subredditId,
      candidateItems.filter((item): item is HistorySearchPanelItem => item !== null)
    );

    let consumedCount = 0;
    let consumedLiveCount = 0;
    for (let index = 0; index < candidates.length; index++) {
      consumedCount += 1;
      inspectedCount += 1;
      if (parsedRecords[index]) {
        consumedLiveCount += 1;
      }
      const item = candidateItems[index];
      if (!item || !matchesHistoryStatusFilter(item, statusFilter)) {
        continue;
      }
      items.push(item);
      if (items.length >= limit) {
        break;
      }
    }

    if (staleIds.length > 0) {
      await context.redis.zRem(baseKey, Array.from(new Set(staleIds)));
    }

    // Stale entries were removed above, so only live entries advance the
    // cursor. This keeps the next scan aligned with the compacted index.
    scanOffset += consumedLiveCount;
    hasMore =
      consumedCount < candidates.length ||
      (hasRecordFilters ? hasMoreCandidates : candidates.length >= requestedCount);

    if (items.length >= limit || !hasRecordFilters || !hasMoreCandidates) {
      break;
    }
    if (
      inspectedCount >= maxEntriesToScan ||
      Date.now() - scanStartedAt >= FILTERED_SEARCH_SCAN_TIME_BUDGET_MS
    ) {
      hasMore = true;
      break;
    }
  }

  return {
    items,
    offset: scanOffset,
    hasMore,
    requestId: 0,
  };
}

export async function searchApprovedRecords(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<ApprovedSearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = normalizeUsernamePrefixFilter(query.username, normalizeUsername);
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }
  if (!usernameFilter) {
    const candidates = await context.redis.zRange(approvedIndexKey(subredditId), minScore, maxScore, {
      by: 'score',
      reverse: true,
      limit: { offset, count: limit * 4 },
    });
    if (candidates.length === 0) {
      return { items: [], offset, hasMore: false, requestId: 0 };
    }

    const candidateIds = candidates.map((entry) => entry.member);
    const payloads = await mGetStringValuesInChunks(
      context,
      candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
    );

    const items: ApprovedSearchPanelItem[] = [];
    const staleIds: string[] = [];
    let scannedCount = 0;
    for (let index = 0; index < payloads.length; index++) {
      scannedCount += 1;
      const payload = payloads[index];
      const recordId = candidateIds[index];
      if (!payload) {
        staleIds.push(recordId);
        continue;
      }
      const parsed = parseRecord(payload);
      if (!parsed || parsed.status !== 'approved') {
        staleIds.push(recordId);
        continue;
      }
      items.push(toApprovedSearchPanelItem(parsed));
      if (items.length >= limit) {
        break;
      }
    }

    if (staleIds.length > 0) {
      await context.redis.zRem(approvedIndexKey(subredditId), Array.from(new Set(staleIds)));
      await removeValidationTrackingForRecordIds(context, subredditId, staleIds);
    }

    return {
      items,
      offset: offset + scannedCount,
      hasMore: scannedCount < candidates.length || candidates.length >= limit * 4,
      requestId: 0,
    };
  }

  const prefix3 = usernameFilter.slice(0, 3);
  const prefixKey = approvedPrefixIndexKey(subredditId, prefix3);
  const candidateCount = limit * APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER;
  const candidates = await context.redis.zRange(prefixKey, minScore, maxScore, {
    by: 'score',
    reverse: true,
    limit: { offset, count: candidateCount + 1 },
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const hasMoreCandidates = candidates.length > candidateCount;
  const candidateWindow = hasMoreCandidates ? candidates.slice(0, candidateCount) : candidates;
  const candidateIds = candidateWindow.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );

  const items: ApprovedSearchPanelItem[] = [];
  const staleIds: string[] = [];
  let matchedCount = 0;
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      staleIds.push(recordId);
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || parsed.status !== 'approved') {
      staleIds.push(recordId);
      continue;
    }
    const normalizedUsername = normalizeUsername(parsed.username);
    if (!normalizedUsername.startsWith(usernameFilter)) {
      continue;
    }
    matchedCount += 1;
    if (items.length < limit) {
      items.push(toApprovedSearchPanelItem(parsed));
    }
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(prefixKey, Array.from(new Set(staleIds)));
  }

  return {
    items,
    offset: offset + candidateWindow.length,
    hasMore: matchedCount > limit || hasMoreCandidates,
    requestId: 0,
  };
}

export function normalizeModeratorStatsRange(value: string | undefined | null): ModeratorStatsRange {
  return typeof value === 'string' && value.trim().toLowerCase() === 'monthly' ? 'monthly' : 'weekly';
}

export function moderatorStatsLookbackDays(range: ModeratorStatsRange): number {
  return range === 'monthly' ? 30 : 7;
}

export function moderatorStatsActorKey(actor: string): string {
  const normalized = normalizeUsernameForLookup(actor);
  if (normalized) {
    return normalized;
  }
  const trimmed = String(actor || '').trim().toLowerCase();
  return trimmed || 'unknown';
}

export async function loadAuditWindowCandidates(
  context: RedisContext,
  subredditId: string,
  query: {
    minScore: number;
    maxScore: number;
    offset?: number;
    count?: number;
  }
): Promise<AuditWindowCandidate[]> {
  const rangeQuery: {
    by: 'score';
    reverse: boolean;
    limit?: { offset: number; count: number };
  } = {
    by: 'score',
    reverse: true,
  };
  if (typeof query.offset === 'number' && typeof query.count === 'number') {
    rangeQuery.limit = {
      offset: Math.max(0, Math.floor(query.offset)),
      count: Math.max(1, Math.floor(query.count)),
    };
  }

  const candidates = await context.redis.zRange(auditDateIndexKey(subredditId), query.minScore, query.maxScore, rangeQuery);
  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((auditId) => auditEntryKey(subredditId, auditId))
  );

  const staleIds: string[] = [];
  const loadedCandidates: AuditWindowCandidate[] = [];
  for (let index = 0; index < candidateIds.length; index++) {
    const auditId = candidateIds[index];
    const payload = payloads[index];
    if (!payload) {
      staleIds.push(auditId);
      loadedCandidates.push({ id: auditId, entry: null });
      continue;
    }

    const parsed = parseAuditEntry(payload);
    if (!parsed) {
      staleIds.push(auditId);
      loadedCandidates.push({ id: auditId, entry: null });
      continue;
    }

    loadedCandidates.push({ id: auditId, entry: parsed });
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(auditDateIndexKey(subredditId), Array.from(new Set(staleIds)));
  }

  return loadedCandidates;
}

function auditCandidateMatchesFilters(
  candidate: AuditWindowCandidate,
  usernameFilter: string,
  actorFilter: string,
  actionFilter: ReturnType<typeof asAuditAction>
): boolean {
  const entry = candidate.entry;
  if (!entry) {
    return false;
  }
  if (usernameFilter && !normalizeUsernameForLookup(entry.username).startsWith(usernameFilter)) {
    return false;
  }
  if (actorFilter && !normalizeUsernameForLookup(entry.actor).startsWith(actorFilter)) {
    return false;
  }
  return !actionFilter || entry.action === actionFilter;
}

export async function searchAuditEntries(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    actor?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<AuditSearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = normalizeUsernamePrefixFilter(query.username, normalizeUsernameForLookup);
  const actorFilter = normalizeUsernamePrefixFilter(query.actor, normalizeUsernameForLookup);
  const actionFilter = asAuditAction(query.action);
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const items: AuditSearchPanelItem[] = [];
  const approvedAuditItemsByVerificationId = new Map<string, AuditSearchPanelItem[]>();
  const hasEntryFilters = Boolean(usernameFilter || actorFilter || actionFilter);
  const batchSize = hasEntryFilters ? FILTERED_SEARCH_SCAN_BATCH_SIZE : limit * 4;
  const maxEntriesToScan = hasEntryFilters ? FILTERED_SEARCH_SCAN_MAX_ENTRIES : batchSize;
  const scanStartedAt = Date.now();
  let scanOffset = offset;
  let inspectedCount = 0;
  let hasMore = false;

  while (inspectedCount < maxEntriesToScan) {
    const requestedCount = Math.min(batchSize, maxEntriesToScan - inspectedCount);
    const loadedCandidates = await loadAuditWindowCandidates(context, subredditId, {
      minScore,
      maxScore,
      offset: scanOffset,
      count: hasEntryFilters ? requestedCount + 1 : requestedCount,
    });
    if (loadedCandidates.length === 0) {
      hasMore = false;
      break;
    }
    const candidates = hasEntryFilters ? loadedCandidates.slice(0, requestedCount) : loadedCandidates;
    const hasMoreCandidates = hasEntryFilters && loadedCandidates.length > requestedCount;

    let consumedCount = 0;
    let consumedLiveCount = 0;
    for (const candidate of candidates) {
      consumedCount += 1;
      inspectedCount += 1;
      if (candidate.entry) {
        consumedLiveCount += 1;
      }
      if (!auditCandidateMatchesFilters(candidate, usernameFilter, actorFilter, actionFilter)) {
        continue;
      }

      const parsed = candidate.entry!;
      const item: AuditSearchPanelItem = {
        id: parsed.id,
        username: parsed.username,
        actor: parsed.actor,
        action: parsed.action,
        line: formatAuditEntry(parsed),
        at: parsed.at,
      };
      items.push(item);
      const verificationId = parsed.action === 'approved' ? (parsed.verificationId ?? '').trim() : '';
      if (verificationId) {
        const verificationItems = approvedAuditItemsByVerificationId.get(verificationId) ?? [];
        verificationItems.push(item);
        approvedAuditItemsByVerificationId.set(verificationId, verificationItems);
      }
      if (items.length >= limit) {
        break;
      }
    }

    // The loader removes missing or malformed entries from the index. Excluding
    // those entries from the cursor keeps the next batch aligned after cleanup.
    scanOffset += consumedLiveCount;
    hasMore = consumedCount < candidates.length || (hasEntryFilters ? hasMoreCandidates : candidates.length >= requestedCount);

    if (items.length >= limit || !hasEntryFilters || !hasMoreCandidates) {
      break;
    }
    if (
      inspectedCount >= maxEntriesToScan ||
      Date.now() - scanStartedAt >= FILTERED_SEARCH_SCAN_TIME_BUDGET_MS
    ) {
      hasMore = true;
      break;
    }
  }

  if (approvedAuditItemsByVerificationId.size > 0) {
    const verificationIds = Array.from(approvedAuditItemsByVerificationId.keys());
    const payloads = await mGetStringValuesInChunks(
      context,
      verificationIds.map((verificationId) => verificationRecordKey(subredditId, verificationId))
    );
    for (let index = 0; index < payloads.length; index++) {
      const verificationId = verificationIds[index];
      if (!verificationId) {
        continue;
      }
      const payload = payloads[index];
      if (!payload) {
        continue;
      }
      const record = parseRecord(payload);
      if (!record) {
        continue;
      }
      const photoFields = toSearchPhotoLinkFields(record);
      for (const item of approvedAuditItemsByVerificationId.get(verificationId) ?? []) {
        Object.assign(item, photoFields);
      }
    }
  }

  return {
    items,
    offset: scanOffset,
    hasMore,
    requestId: 0,
  };
}

export async function getModeratorStats(
  context: RedisContext,
  subredditId: string,
  requestedRange: ModeratorStatsRange
): Promise<ModeratorStatsPayload> {
  const range = normalizeModeratorStatsRange(requestedRange);
  const nowMs = Date.now();
  const minScore = Math.max(0, nowMs - moderatorStatsLookbackDays(range) * MILLIS_PER_DAY);
  const maxScore = nowMs;

  const [currentlyVerified, auditCandidates] = await Promise.all([
    countCurrentlyVerifiedRecords(context, subredditId),
    loadAuditWindowCandidates(context, subredditId, {
      minScore,
      maxScore,
    }),
  ]);

  const moderatorsByActor = new Map<string, ModeratorStatsModeratorRow>();
  let approvals = 0;
  let denials = 0;
  let reopens = 0;
  const decisionTurnaroundSamples: number[] = [];
  const denialReasonCounts = new Map<ModeratorStatsDenialReasonRow['reason'], number>();

  // Period counts come from the audit trail, while current verified comes from the live approved index.
  for (const candidate of auditCandidates) {
    const entry = candidate.entry;
    if (!entry || (entry.action !== 'approved' && entry.action !== 'denied' && entry.action !== 'reopened')) {
      continue;
    }

    const moderatorKey = moderatorStatsActorKey(entry.actor);
    const current = moderatorsByActor.get(moderatorKey) ?? {
      moderator: moderatorKey,
      approvals: 0,
      denials: 0,
      reopens: 0,
      totalActions: 0,
    };

    if (entry.action === 'approved') {
      current.approvals += 1;
      approvals += 1;
    } else if (entry.action === 'denied') {
      current.denials += 1;
      denials += 1;
    } else {
      current.reopens += 1;
      reopens += 1;
    }
    current.totalActions += 1;
    moderatorsByActor.set(moderatorKey, current);

    if (entry.action === 'approved' || entry.action === 'denied') {
      if (typeof entry.turnaroundMs === 'number' && Number.isFinite(entry.turnaroundMs) && entry.turnaroundMs >= 0) {
        decisionTurnaroundSamples.push(entry.turnaroundMs);
      }
    }
    if (entry.action === 'denied' && entry.denyReason !== undefined) {
      // null marks automated denials; legacy entries without the field are excluded.
      const reasonKey: ModeratorStatsDenialReasonRow['reason'] = entry.denyReason ?? 'auto';
      denialReasonCounts.set(reasonKey, (denialReasonCounts.get(reasonKey) ?? 0) + 1);
    }
  }

  const denialReasons: ModeratorStatsDenialReasonRow[] = Array.from(denialReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.reason.localeCompare(right.reason);
    });

  const moderators = Array.from(moderatorsByActor.values()).sort((left, right) => {
    if (right.totalActions !== left.totalActions) {
      return right.totalActions - left.totalActions;
    }
    if (right.approvals !== left.approvals) {
      return right.approvals - left.approvals;
    }
    return left.moderator.localeCompare(right.moderator);
  });

  const topApproverSource = moderators
    .filter((row) => row.approvals > 0)
    .sort((left, right) => {
      if (right.approvals !== left.approvals) {
        return right.approvals - left.approvals;
      }
      return left.moderator.localeCompare(right.moderator);
    })[0];
  const topDenierSource = moderators
    .filter((row) => row.denials > 0)
    .sort((left, right) => {
      if (right.denials !== left.denials) {
        return right.denials - left.denials;
      }
      return left.moderator.localeCompare(right.moderator);
    })[0];

  return {
    range,
    generatedAt: new Date(nowMs).toISOString(),
    summary: {
      currentlyVerified,
      approvals,
      denials,
      reopens,
      activeModerators: moderators.length,
    },
    leaders: {
      topApprover: topApproverSource
        ? { moderator: topApproverSource.moderator, count: topApproverSource.approvals }
        : null,
      topDenier: topDenierSource
        ? { moderator: topDenierSource.moderator, count: topDenierSource.denials }
        : null,
    },
    decisionTiming: computeDecisionTimingSummary(decisionTurnaroundSamples),
    denialReasons,
    moderators,
  };
}

export function computeDecisionTimingSummary(samples: number[]): ModeratorStatsDecisionTiming {
  const validSamples = samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (validSamples.length === 0) {
    return { sampleCount: 0, percentile90Ms: null };
  }
  const percentile90Index = Math.max(0, Math.ceil(validSamples.length * 0.9) - 1);
  return {
    sampleCount: validSamples.length,
    percentile90Ms: Math.round(validSamples[percentile90Index]!),
  };
}

export async function countCurrentlyVerifiedRecords(
  context: RedisContext,
  subredditId: string
): Promise<number> {
  const [approvedEntries, historyEntries] = await Promise.all([
    context.redis.zRange(approvedIndexKey(subredditId), 0, -1, { by: 'rank' }),
    context.redis.zRange(historyDateIndexKey(subredditId), 0, -1, { by: 'rank' }),
  ]);

  if (approvedEntries.length === 0 && historyEntries.length === 0) {
    return 0;
  }

  const approvedIds = new Set(approvedEntries.map((entry) => entry.member));
  const candidateIds = Array.from(
    new Set([
      ...approvedEntries.map((entry) => entry.member),
      ...historyEntries.map((entry) => entry.member),
    ])
  );
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );

  let count = 0;
  const approvedIdsToRemove: string[] = [];
  const approvedPrefixEntriesToRemove: Array<{ recordId: string; username: string }> = [];
  const approvedEntriesToAdd: Array<{ member: string; score: number }> = [];
  const approvedPrefixEntriesToAdd: Array<{ recordId: string; username: string; approvedAtMs: number }> = [];

  for (let index = 0; index < candidateIds.length; index++) {
    const recordId = candidateIds[index];
    const payload = payloads[index];
    const parsed = payload ? parseRecord(payload) : null;
    const isIndexedApproved = approvedIds.has(recordId);

    if (!parsed) {
      if (isIndexedApproved) {
        approvedIdsToRemove.push(recordId);
      }
      continue;
    }

    if (parsed.status === 'approved') {
      count += 1;
      if (!isIndexedApproved) {
        const approvedAtMs = getFiniteTimestampMs(parsed.reviewedAt, getFiniteTimestampMs(parsed.submittedAt, Date.now()));
        approvedEntriesToAdd.push({ member: recordId, score: approvedAtMs });
        approvedPrefixEntriesToAdd.push({
          recordId,
          username: parsed.username,
          approvedAtMs,
        });
      }
      continue;
    }

    if (isIndexedApproved) {
      approvedIdsToRemove.push(recordId);
      approvedPrefixEntriesToRemove.push({ recordId, username: parsed.username });
    }
  }

  if (approvedIdsToRemove.length > 0) {
    const uniqueApprovedIdsToRemove = Array.from(new Set(approvedIdsToRemove));
    await context.redis.zRem(approvedIndexKey(subredditId), uniqueApprovedIdsToRemove);
    await removeValidationTrackingForRecordIds(context, subredditId, uniqueApprovedIdsToRemove);
  }

  if (approvedPrefixEntriesToRemove.length > 0) {
    await removeApprovedPrefixIndexEntries(context, subredditId, approvedPrefixEntriesToRemove);
  }

  if (approvedEntriesToAdd.length > 0) {
    for (const entry of approvedEntriesToAdd) {
      await context.redis.zAdd(approvedIndexKey(subredditId), entry);
    }
    for (const entry of approvedPrefixEntriesToAdd) {
      await addApprovedPrefixIndexEntry(context, subredditId, entry.recordId, entry.username, entry.approvedAtMs);
    }
  }

  return count;
}

export function parseSearchBoundaryMs(value: string | undefined, endOfDay: boolean): number {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return endOfDay ? Date.now() : 0;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`).getTime();
  }
  return new Date(raw).getTime();
}
