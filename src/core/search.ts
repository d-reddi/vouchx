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
import { APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER, MAX_PENDING_TO_LOAD, MILLIS_PER_DAY } from './constants.ts';
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

export async function searchHistoryRecords(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<HistorySearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = normalizeUsernamePrefixFilter(query.username, normalizeUsernameForLookup);
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const baseKey = historyDateIndexKey(subredditId);
  const candidateCount = limit * (usernameFilter ? 8 : 3);

  const candidates = await context.redis.zRange(baseKey, minScore, maxScore, {
    by: 'score',
    reverse: true,
    limit: { offset, count: candidateCount },
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const candidateIds = candidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const items: HistorySearchPanelItem[] = [];
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
    if (!parsed) {
      staleIds.push(recordId);
      continue;
    }
    if (usernameFilter && !normalizeUsernameForLookup(parsed.username).startsWith(usernameFilter)) {
      continue;
    }
    items.push({
      id: parsed.id,
      username: parsed.username,
      status: parsed.status,
      submittedAt: parsed.submittedAt,
      acknowledgedAt: parsed.ageAcknowledgedAt,
      reviewedAt: parsed.reviewedAt ?? null,
      moderator: parsed.moderator ?? null,
      denyReason: parseDenyReason(parsed.denyReason) ?? null,
      parentVerificationId: parsed.parentVerificationId ?? null,
      reopenedChildId: null,
      reopenedState: 'none',
      ...(parsed.status === 'approved' ? toSearchPhotoLinkFields(parsed) : {}),
    });
    if (items.length >= limit) {
      break;
    }
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(baseKey, Array.from(new Set(staleIds)));
  }

  const deniedItems = items.filter((item) => item.status === 'denied');
  if (deniedItems.length > 0) {
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

    if (presentChildIds.length > 0) {
      const childPayloads = await mGetStringValuesInChunks(
        context,
        presentChildIds.map((childId) => verificationRecordKey(subredditId, childId))
      );
      const staleParentIds: string[] = [];
      for (let childIndex = 0; childIndex < childPayloads.length; childIndex++) {
        const payload = childPayloads[childIndex];
        if (payload) {
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
  }

  return {
    items,
    offset: offset + scannedCount,
    hasMore: scannedCount < candidates.length || candidates.length >= candidateCount,
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

  const candidates = await loadAuditWindowCandidates(context, subredditId, {
    minScore,
    maxScore,
    offset,
    count: limit * 4,
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const items: AuditSearchPanelItem[] = [];
  const approvedAuditItemsByVerificationId = new Map<string, AuditSearchPanelItem[]>();
  let scannedCount = 0;
  for (const candidate of candidates) {
    scannedCount += 1;
    const parsed = candidate.entry;
    if (!parsed) {
      continue;
    }
    if (usernameFilter && !normalizeUsernameForLookup(parsed.username).startsWith(usernameFilter)) {
      continue;
    }
    if (actorFilter && !normalizeUsernameForLookup(parsed.actor).startsWith(actorFilter)) {
      continue;
    }
    if (actionFilter && parsed.action !== actionFilter) {
      continue;
    }
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
    offset: offset + scannedCount,
    hasMore: scannedCount < candidates.length || candidates.length >= limit * 4,
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
