import type { Devvit } from '@devvit/public-api';
import type {
  PendingPanelItem,
  VerificationRecord,
} from './types.ts';
import {
  PENDING_CLAIM_TTL_MS,
  VERIFICATION_ACTION_LOCK_TTL_MS,
} from './constants.ts';
import {
  pendingIndexKey,
  verificationActionLockKey,
} from './keys.ts';
import {
  assertCanReview,
} from './moderator-access.ts';
import {
  normalizeUsernameForLookup,
  parseTimestampMs,
  sanitizeSubredditId,
  usernamesEqual,
} from './normalize.ts';
import {
  getRecord,
  setRecord,
} from './records.ts';
import {
  getCurrentSubredditNameCompat,
  toPendingPanelItem,
} from '../core.ts';

export function assertClaimAllowsAction(record: VerificationRecord, moderator: string): void {
  const normalizedRecord = clearExpiredPendingClaim(record);
  const claimedBy = normalizeUsernameForLookup(normalizedRecord.claimedBy ?? '');
  if (!claimedBy) {
    return;
  }
  if (!usernamesEqual(claimedBy, moderator)) {
    throw new Error(`This request is currently claimed by u/${normalizedRecord.claimedBy}.`);
  }
}

export function clearExpiredPendingClaim(record: VerificationRecord, nowMs = Date.now()): VerificationRecord {
  const claimedBy = normalizeUsernameForLookup(record.claimedBy ?? '');
  const claimedAtMs = parseTimestampMs(record.claimedAt);
  const claimActive =
    Boolean(claimedBy) &&
    Number.isFinite(claimedAtMs) &&
    claimedAtMs > 0 &&
    nowMs - claimedAtMs < PENDING_CLAIM_TTL_MS;

  if (claimActive) {
    return record;
  }

  if (!record.claimedBy && !record.claimedAt) {
    return record;
  }

  return {
    ...record,
    claimedBy: null,
    claimedAt: null,
  };
}

export function pendingClaimChanged(left: VerificationRecord, right: VerificationRecord): boolean {
  return (left.claimedBy ?? null) !== (right.claimedBy ?? null) || (left.claimedAt ?? null) !== (right.claimedAt ?? null);
}

export function createRedisLockToken(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function releaseRedisLockIfOwned(
  context: Pick<Devvit.Context, 'redis'>,
  key: string,
  lockToken: string
): Promise<void> {
  const currentLockToken = await context.redis.get(key);
  if (currentLockToken === lockToken) {
    await context.redis.del(key);
  }
}

export async function withRedisLock<T>(
  context: Pick<Devvit.Context, 'redis'>,
  key: string,
  ttlMs: number,
  failureMessage: string,
  callback: () => Promise<T>
): Promise<T> {
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lock = await context.redis.set(key, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + ttlMs),
    });
    if (lock === 'OK') {
      lockAcquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (!lockAcquired) {
    throw new Error(failureMessage);
  }

  try {
    return await callback();
  } finally {
    await releaseRedisLockIfOwned(context, key, lockToken);
  }
}

export async function withVerificationActionLock<T>(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  verificationId: string,
  callback: () => Promise<T>
): Promise<T> {
  return withRedisLock(
    context,
    verificationActionLockKey(subredditId, verificationId),
    VERIFICATION_ACTION_LOCK_TTL_MS,
    'Another moderation action is already in progress for this verification. Refresh and try again.',
    callback
  );
}

export async function setPendingClaimState(
  context: Devvit.Context,
  verificationId: string,
  shouldClaim: boolean
): Promise<{ item: PendingPanelItem; changed: boolean; pendingCount: number }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);

  const storedRecord = await getRecord(context, subredditId, verificationId);
  if (!storedRecord) {
    throw new Error('Verification not found.');
  }
  let record = clearExpiredPendingClaim(storedRecord);
  if (pendingClaimChanged(storedRecord, record)) {
    await setRecord(context, subredditId, record);
  }
  if (record.status !== 'pending') {
    throw new Error('Verification is no longer pending.');
  }

  const claimedByNormalized = normalizeUsernameForLookup(record.claimedBy ?? '');
  const moderatorNormalized = normalizeUsernameForLookup(moderator);
  let updatedRecord = record;
  let changed = false;

  if (shouldClaim) {
    if (claimedByNormalized && claimedByNormalized !== moderatorNormalized) {
      throw new Error(`This request is currently claimed by u/${record.claimedBy}.`);
    }
    if (claimedByNormalized !== moderatorNormalized) {
      changed = true;
      updatedRecord = {
        ...record,
        claimedBy: moderator,
        claimedAt: new Date().toISOString(),
      };
    }
  } else if (record.claimedBy || record.claimedAt) {
    changed = true;
    updatedRecord = {
      ...record,
      claimedBy: null,
      claimedAt: null,
    };
  }

  if (changed) {
    await setRecord(context, subredditId, updatedRecord);
  }

  const pendingCount = await context.redis.zCard(pendingIndexKey(subredditId));
  return { item: toPendingPanelItem(updatedRecord), changed, pendingCount };
}
