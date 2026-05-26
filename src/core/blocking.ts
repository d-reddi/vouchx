import type { Devvit } from '@devvit/public-api';
import type {
  BlockedUserEntry,
  RedisContext,
  RuntimeConfig,
} from './types.ts';
import type { ParsedRedditUsernameList } from '../shared/global-usernames.ts';
import {
  blockedUsersKey,
  denialCountKey,
} from './keys.ts';
import {
  errorText,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  primaryUsernameLookupField,
  usernameLookupFields,
} from './normalize.ts';
import {
  appendAuditLog,
} from './records.ts';
import {
  assertCanReview,
  getRuntimeConfig,
  looksLikeDeletedOrSuspendedError,
} from '../core.ts';

export function createGlobalBlockedUserEntry(
  blockedUsernames: ParsedRedditUsernameList,
  username: string
): BlockedUserEntry | null {
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername || !blockedUsernames.usernames.includes(normalizedUsername)) {
    return null;
  }
  return {
    username: normalizedUsername,
    blockedAt: '',
    deniedCount: 0,
    reason: 'Blocked by developer',
    scope: 'global',
  };
}

export async function getStoredDenialCount(context: RedisContext, subredditId: string, username: string): Promise<number> {
  const lookupFields = usernameLookupFields(username);
  if (lookupFields.length === 0) {
    return 0;
  }

  const key = denialCountKey(subredditId);
  const primaryField = primaryUsernameLookupField(username);
  for (const field of lookupFields) {
    const currentRaw = await context.redis.hGet(key, field);
    const current = Number.parseInt(currentRaw ?? '0', 10);
    if (!Number.isFinite(current) || current <= 0) {
      continue;
    }
    if (primaryField && field !== primaryField) {
      await context.redis.hSet(key, { [primaryField]: `${current}` });
    }
    return current;
  }

  return 0;
}

export async function listBlockedUsers(context: Devvit.Context, subredditId: string): Promise<BlockedUserEntry[]> {
  const blockedMap = await context.redis.hGetAll(blockedUsersKey(subredditId));
  const config = await getRuntimeConfig(context, subredditId);
  const blockedUsers: BlockedUserEntry[] = [];
  const staleUsers: string[] = [];

  for (const [normalizedUsername, payload] of Object.entries(blockedMap)) {
    const parsed = parseBlockedUserEntry(normalizedUsername, payload, config.maxDenialsBeforeBlock);
    if (!parsed) {
      staleUsers.push(normalizedUsername);
      continue;
    }
    blockedUsers.push(parsed);
  }

  if (staleUsers.length > 0) {
    await context.redis.hDel(blockedUsersKey(subredditId), staleUsers);
  }

  blockedUsers.sort((a, b) => {
    const aTime = new Date(a.blockedAt).getTime() || 0;
    const bTime = new Date(b.blockedAt).getTime() || 0;
    return bTime - aTime;
  });

  return blockedUsers;
}

export async function getBlockedUser(
  context: Devvit.Context,
  subredditId: string,
  username: string
): Promise<BlockedUserEntry | null> {
  const config = await getRuntimeConfig(context, subredditId);
  const normalizedUsername = normalizeUsername(username);
  const key = blockedUsersKey(subredditId);
  const lookupFields = usernameLookupFields(username);
  const primaryField = primaryUsernameLookupField(username);
  let matchedField = '';
  let payload: string | null = null;
  for (const field of lookupFields) {
    payload = (await context.redis.hGet(key, field)) ?? null;
    if (payload) {
      matchedField = field;
      break;
    }
  }
  if (!payload) {
    return null;
  }
  const parsed = parseBlockedUserEntry(matchedField || normalizedUsername, payload, config.maxDenialsBeforeBlock);
  if (!parsed) {
    if (lookupFields.length > 0) {
      await context.redis.hDel(key, lookupFields);
    }
    return null;
  }
  if (primaryField) {
    await context.redis.hSet(key, { [primaryField]: JSON.stringify(parsed) });
  }
  const staleFields = lookupFields.filter((field) => field !== primaryField);
  if (staleFields.length > 0) {
    await context.redis.hDel(key, staleFields);
  }
  return parsed;
}

export async function isUserBlocked(context: Devvit.Context, subredditId: string, username: string): Promise<boolean> {
  return (await getBlockedUser(context, subredditId, username)) !== null;
}

export async function repairMissingAutoBlockForUser(
  context: Devvit.Context,
  subredditId: string,
  username: string,
  config: RuntimeConfig
): Promise<BlockedUserEntry | null> {
  const existingBlocked = await getBlockedUser(context, subredditId, username);
  if (existingBlocked) {
    return existingBlocked;
  }
  if (config.maxDenialsBeforeBlock <= 0) {
    return null;
  }

  const deniedCount = await getStoredDenialCount(context, subredditId, username);
  if (deniedCount < config.maxDenialsBeforeBlock) {
    return null;
  }

  const normalizedUsername = normalizeUsernameForLookup(username);
  if (!normalizedUsername) {
    return null;
  }

  const entry: BlockedUserEntry = {
    username: normalizedUsername,
    blockedAt: new Date().toISOString(),
    deniedCount,
    reason: `Reached ${deniedCount} denials`,
    scope: 'subreddit',
  };
  await setBlockedUser(context, subredditId, entry);
  return entry;
}

export async function incrementDenialCount(context: Devvit.Context, subredditId: string, username: string): Promise<number> {
  const key = denialCountKey(subredditId);
  const normalizedUsername = normalizeUsername(username);
  const next = (await getStoredDenialCount(context, subredditId, normalizedUsername)) + 1;
  await context.redis.hSet(key, { [normalizedUsername]: `${next}` });
  return next;
}

export async function setBlockedUser(context: Devvit.Context, subredditId: string, entry: BlockedUserEntry): Promise<void> {
  await context.redis.hSet(blockedUsersKey(subredditId), {
    [normalizeUsername(entry.username)]: JSON.stringify(entry),
  });
}

export async function unblockUserForModerator(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  username: string,
  moderator: string
): Promise<boolean> {
  await assertCanReview(context, subredditName, moderator);
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    return false;
  }
  const blocked = await getBlockedUser(context, subredditId, normalizedUsername);
  if (!blocked) {
    return false;
  }

  const lookupFields = usernameLookupFields(username);
  if (lookupFields.length > 0) {
    await context.redis.hDel(blockedUsersKey(subredditId), lookupFields);
    await context.redis.hDel(denialCountKey(subredditId), lookupFields);
  }

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName,
      username: blocked.username,
      actor: moderator,
      action: 'unblocked',
      notes: `Removed submission block for u/${blocked.username}.`,
    });
  } catch (error) {
    console.log(`Audit log write failed (unblocked): ${errorText(error)}`);
  }

  return true;
}

export async function blockUserForModerator(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  username: string,
  moderator: string
): Promise<{ alreadyBlocked: boolean; entry: BlockedUserEntry }> {
  await assertCanReview(context, subredditName, moderator);
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    throw new Error('A valid username is required.');
  }

  try {
    const user = await context.reddit.getUserByUsername(normalizedUsername);
    if (!user) {
      throw new Error('User lookup returned no result.');
    }
  } catch (error) {
    const message = errorText(error).toLowerCase();
    if (looksLikeDeletedOrSuspendedError(message)) {
      throw new Error(`u/${normalizedUsername} was not found or is suspended.`);
    }
    throw new Error(`Unable to validate u/${normalizedUsername}. ${errorText(error)}`);
  }

  const deniedCount = await getStoredDenialCount(context, subredditId, normalizedUsername);

  return await setManualBlockedUserEntry(
    context,
    subredditId,
    subredditName,
    normalizedUsername,
    moderator,
    deniedCount,
    true
  );
}

export async function setManualBlockedUserEntry(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  normalizedUsername: string,
  moderator: string,
  deniedCount: number,
  syncDenialCountHash: boolean
): Promise<{ alreadyBlocked: boolean; entry: BlockedUserEntry }> {
  const canonicalUsername = normalizeUsernameStrict(normalizedUsername);
  if (!canonicalUsername) {
    throw new Error('A valid username is required.');
  }

  const existing = await getBlockedUser(context, subredditId, canonicalUsername);
  if (existing) {
    return { alreadyBlocked: true, entry: existing };
  }

  const entry: BlockedUserEntry = {
    username: canonicalUsername,
    blockedAt: new Date().toISOString(),
    deniedCount,
    reason: 'Blocked by moderator',
    scope: 'subreddit',
  };

  if (syncDenialCountHash) {
    if (deniedCount > 0) {
      await context.redis.hSet(denialCountKey(subredditId), { [canonicalUsername]: `${deniedCount}` });
    } else {
      await context.redis.hDel(denialCountKey(subredditId), [canonicalUsername, `u/${canonicalUsername}`]);
    }
  }
  await setBlockedUser(context, subredditId, entry);

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName,
      username: entry.username,
      actor: moderator,
      action: 'blocked',
      notes: 'Manual moderator block.',
    });
  } catch (error) {
    console.log(`Audit log write failed (manual_block): ${errorText(error)}`);
  }

  return { alreadyBlocked: false, entry };
}

export function parseBlockedUserEntry(
  normalizedUsername: string,
  payload: string,
  fallbackDeniedCount: number
): BlockedUserEntry | null {
  try {
    const parsed = JSON.parse(payload) as Partial<BlockedUserEntry>;
    if (!parsed || typeof parsed.blockedAt !== 'string') {
      return null;
    }
    const deniedCountRaw = Number.parseInt(`${parsed.deniedCount ?? ''}`, 10);
    const deniedCount =
      Number.isFinite(deniedCountRaw) && deniedCountRaw >= 0 ? deniedCountRaw : fallbackDeniedCount;
    const username = normalizeUsernameForLookup(parsed.username ?? normalizedUsername);
    if (!username) {
      return null;
    }
    return {
      username,
      blockedAt: parsed.blockedAt,
      deniedCount,
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : deniedCount > 0
            ? `Reached ${deniedCount} denials`
            : 'Blocked by moderator',
      scope: parsed.scope === 'global' ? 'global' : 'subreddit',
    };
  } catch {
    return null;
  }
}
