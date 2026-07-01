import type { Devvit } from '@devvit/public-api';
import type { BlockedUserEntry, RedisContext, RuntimeConfig } from './types.ts';
import type { ParsedRedditUsernameList } from '../shared/global-usernames.ts';
import { blockedUsersKey, denialCountKey } from './keys.ts';
import {
  errorText,
  looksLikeDeletedOrSuspendedError,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  primaryUsernameLookupField,
  usernameLookupFields,
} from './normalize.ts';
import { appendAuditLog } from './records.ts';
import { GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME, mergeParsedRedditUsernameLists, parseRedditUsernameList } from '../shared/global-usernames.ts';
import { assertCanReview } from './moderator-access.ts';
import { getRuntimeConfig } from './settings.ts';

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
    blockedBy: null,
    deniedCount: 0,
    reason: 'Blocked by developer',
    scope: 'global',
  };
}

function normalizeBlockReason(reason: string | null | undefined): string {
  return String(reason ?? '').trim().slice(0, 500);
}

function parseStoredDenialCount(value: string | null | undefined): number | null {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function consolidateStoredDenialCount(
  context: RedisContext,
  subredditId: string,
  username: string
): Promise<{ key: string; canonicalField: string; count: number } | null> {
  const canonicalField = normalizeUsernameStrict(username);
  if (!canonicalField) {
    return null;
  }
  const key = denialCountKey(subredditId);
  const lookupFields = Array.from(new Set([canonicalField, ...usernameLookupFields(username)]));
  const storedValues = await Promise.all(lookupFields.map((field) => context.redis.hGet(key, field)));
  const canonicalIndex = lookupFields.indexOf(canonicalField);
  const canonicalRaw = storedValues[canonicalIndex];
  const canonicalCount = parseStoredDenialCount(canonicalRaw);
  const validCounts = storedValues
    .map((value) => parseStoredDenialCount(value))
    .filter((value): value is number => value !== null);
  const consolidatedCount = Math.max(0, ...validCounts);
  const legacyFields = lookupFields.filter((field) => field !== canonicalField);
  const removedLegacyFields = legacyFields.length > 0 ? await context.redis.hDel(key, legacyFields) : 0;

  if (canonicalCount === null && storedValues.some((value) => value !== null && value !== undefined)) {
    // A malformed canonical value makes HINCRBY fail. Repair it before any
    // increment; valid legacy aliases still seed the recovered count.
    await context.redis.hSet(key, { [canonicalField]: `${consolidatedCount}` });
  } else if (canonicalCount !== null && removedLegacyFields > 0 && consolidatedCount > canonicalCount) {
    // Apply only the positive difference. HINCRBY preserves any newer
    // concurrent canonical increments instead of overwriting them with a stale
    // legacy snapshot.
    await context.redis.hIncrBy(key, canonicalField, consolidatedCount - canonicalCount);
  }

  const repairedRaw = await context.redis.hGet(key, canonicalField);
  const repairedCount = parseStoredDenialCount(repairedRaw);
  if (repairedCount !== null) {
    return { key, canonicalField, count: repairedCount };
  }
  if (repairedRaw === null || repairedRaw === undefined) {
    return { key, canonicalField, count: 0 };
  }
  await context.redis.hSet(key, { [canonicalField]: '0' });
  return { key, canonicalField, count: 0 };
}

export async function getStoredDenialCount(context: RedisContext, subredditId: string, username: string): Promise<number> {
  return (await consolidateStoredDenialCount(context, subredditId, username))?.count ?? 0;
}

export async function listBlockedUsers(
  context: Devvit.Context,
  subredditId: string,
  config?: RuntimeConfig
): Promise<BlockedUserEntry[]> {
  const blockedMap = await context.redis.hGetAll(blockedUsersKey(subredditId));
  const resolvedConfig = config ?? (await getRuntimeConfig(context, subredditId));
  const blockedUsers: BlockedUserEntry[] = [];
  const staleUsers: string[] = [];

  for (const [normalizedUsername, payload] of Object.entries(blockedMap)) {
    const parsed = parseBlockedUserEntry(normalizedUsername, payload, resolvedConfig.maxDenialsBeforeBlock);
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
  username: string,
  config?: RuntimeConfig
): Promise<BlockedUserEntry | null> {
  const resolvedConfig = config ?? (await getRuntimeConfig(context, subredditId));
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
  const parsed = parseBlockedUserEntry(matchedField || normalizedUsername, payload, resolvedConfig.maxDenialsBeforeBlock);
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

export async function isUserBlocked(
  context: Devvit.Context,
  subredditId: string,
  username: string,
  config?: RuntimeConfig
): Promise<boolean> {
  return (await getBlockedUser(context, subredditId, username, config)) !== null;
}

export async function repairMissingAutoBlockForUser(
  context: Devvit.Context,
  subredditId: string,
  username: string,
  config: RuntimeConfig
): Promise<BlockedUserEntry | null> {
  const existingBlocked = await getBlockedUser(context, subredditId, username, config);
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
    blockedBy: null,
    deniedCount,
    reason: `Reached ${deniedCount} denials`,
    scope: 'subreddit',
  };
  await setBlockedUser(context, subredditId, entry);
  return entry;
}

export async function incrementDenialCount(context: Devvit.Context, subredditId: string, username: string): Promise<number> {
  const consolidated = await consolidateStoredDenialCount(context, subredditId, username);
  if (!consolidated) {
    return 0;
  }
  return await context.redis.hIncrBy(consolidated.key, consolidated.canonicalField, 1);
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
  moderator: string,
  reason?: string | null
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
    true,
    reason
  );
}

export async function setManualBlockedUserEntry(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  normalizedUsername: string,
  moderator: string,
  deniedCount: number,
  syncDenialCountHash: boolean,
  reason?: string | null
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
    blockedBy: normalizeUsernameStrict(moderator) || moderator,
    deniedCount,
    reason: normalizeBlockReason(reason) || 'Blocked by moderator',
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
      notes: `Manual moderator block: ${entry.reason}`,
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
      blockedBy:
        typeof parsed.blockedBy === 'string' && parsed.blockedBy.trim()
          ? parsed.blockedBy.trim().replace(/^u\//i, '')
          : null,
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

export async function readGlobalUsernameSetting(
  context: Pick<Devvit.Context, 'settings'>,
  settingName: string
): Promise<ParsedRedditUsernameList> {
  return parseRedditUsernameList(await context.settings.get<string>(settingName));
}

export async function readMergedGlobalUsernameSettings(
  context: Pick<Devvit.Context, 'settings'>,
  settingNames: readonly string[]
): Promise<ParsedRedditUsernameList> {
  const rawChunkCount = await context.settings.get<string>(GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME);
  const parsedChunkCount = Number.parseInt(String(rawChunkCount ?? '').trim(), 10);
  const activeSettingNames =
    Number.isFinite(parsedChunkCount) && parsedChunkCount >= 0
      ? settingNames.slice(0, Math.min(settingNames.length, parsedChunkCount))
      : settingNames;
  return mergeParsedRedditUsernameLists(
    await Promise.all(activeSettingNames.map((settingName) => readGlobalUsernameSetting(context, settingName)))
  );
}
