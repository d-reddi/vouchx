export type ParsedRedditUsernameList = {
  usernames: string[];
  invalidTokens: string[];
  canonicalValue: string;
};

export type ChunkedRedditUsernameList = {
  chunks: string[];
  overflow: boolean;
  overflowedUsernamesCount: number;
};

export const GLOBAL_BLOCKED_USERNAME_MAX_CHUNKS = 20;

export const GLOBAL_BLOCKED_USERNAME_SETTING_NAMES = Array.from(
  { length: GLOBAL_BLOCKED_USERNAME_MAX_CHUNKS },
  (_, index) => (index === 0 ? 'global_blocked_usernames' : `global_blocked_usernames_${index + 1}`)
) as readonly string[];

export const GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME = 'global_blocked_usernames_chunk_count';

// Devvit secret string settings are currently CLI-validated at 250 characters.
// Canonical blocked usernames are ASCII-only, so bytes and characters are equivalent here.
export const GLOBAL_BLOCKED_USERNAME_MAX_SETTING_BYTES = 250;

const REDDIT_USERNAME_RE = /^[A-Za-z0-9_-]+$/;

export function normalizeLooseRedditUsername(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/^u\//i, '')
    .toLowerCase();
}

export function normalizeStrictRedditUsername(input: string): string {
  let normalized = String(input ?? '').trim();
  if (!normalized) {
    return '';
  }

  if (/^(?:https?:\/\/)?(?:www\.)?reddit\.com\//i.test(normalized)) {
    normalized = normalized.replace(/^(?:https?:\/\/)?(?:www\.)?reddit\.com\//i, '/');
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.trim().toLowerCase();
      if (hostname !== 'reddit.com' && hostname !== 'www.reddit.com') {
        return '';
      }
      normalized = parsed.pathname;
    } catch {
      return '';
    }
  }

  normalized = normalized.split(/[?#]/, 1)[0]?.trim() ?? '';
  normalized = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized.includes('/')) {
    if (!/^(?:u|user)\//i.test(normalized)) {
      return '';
    }
    normalized = normalized.replace(/^(?:u|user)\//i, '');
  }

  const username = normalized.split('/').find((segment) => segment.trim())?.trim() ?? '';
  return REDDIT_USERNAME_RE.test(username) ? username.toLowerCase() : '';
}

function tokenizeRedditUsernameList(value: string | null | undefined): string[] {
  const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) {
    return [];
  }
  return normalized
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildRedditUsernameListCanonicalValue(usernames: Iterable<string>): string {
  const uniqueUsernames: string[] = [];
  const seen = new Set<string>();

  for (const username of usernames) {
    const normalized = normalizeStrictRedditUsername(username);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    uniqueUsernames.push(normalized);
  }

  return uniqueUsernames.join(',');
}

export function parseRedditUsernameList(value: string | null | undefined): ParsedRedditUsernameList {
  const usernames: string[] = [];
  const invalidTokens: string[] = [];
  const seenUsernames = new Set<string>();
  const seenInvalidTokens = new Set<string>();

  for (const token of tokenizeRedditUsernameList(value)) {
    const normalized = normalizeStrictRedditUsername(token);
    if (!normalized) {
      if (!seenInvalidTokens.has(token)) {
        seenInvalidTokens.add(token);
        invalidTokens.push(token);
      }
      continue;
    }
    if (seenUsernames.has(normalized)) {
      continue;
    }
    seenUsernames.add(normalized);
    usernames.push(normalized);
  }

  return {
    usernames,
    invalidTokens,
    canonicalValue: buildRedditUsernameListCanonicalValue(usernames),
  };
}

export function mergeParsedRedditUsernameLists(lists: Iterable<ParsedRedditUsernameList>): ParsedRedditUsernameList {
  const usernames: string[] = [];
  const invalidTokens: string[] = [];
  const seenUsernames = new Set<string>();
  const seenInvalidTokens = new Set<string>();

  for (const list of lists) {
    for (const username of list.usernames) {
      const normalized = normalizeStrictRedditUsername(username);
      if (!normalized || seenUsernames.has(normalized)) {
        continue;
      }
      seenUsernames.add(normalized);
      usernames.push(normalized);
    }
    for (const token of list.invalidTokens) {
      const normalizedToken = String(token ?? '').trim();
      if (!normalizedToken || seenInvalidTokens.has(normalizedToken)) {
        continue;
      }
      seenInvalidTokens.add(normalizedToken);
      invalidTokens.push(normalizedToken);
    }
  }

  return {
    usernames,
    invalidTokens,
    canonicalValue: buildRedditUsernameListCanonicalValue(usernames),
  };
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(String(value ?? '')).length;
}

export function splitRedditUsernameListAcrossSettings(
  usernames: Iterable<string>,
  options?: {
    maxChunks?: number;
    maxBytesPerChunk?: number;
  }
): ChunkedRedditUsernameList {
  const normalizedUsernames = parseRedditUsernameList(buildRedditUsernameListCanonicalValue(usernames)).usernames;
  const maxChunks = Math.max(1, Math.floor(options?.maxChunks ?? GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length));
  const maxBytesPerChunk = Math.max(1, Math.floor(options?.maxBytesPerChunk ?? GLOBAL_BLOCKED_USERNAME_MAX_SETTING_BYTES));
  const chunks: string[] = [];
  let currentChunk = '';
  let overflow = false;
  let overflowedUsernamesCount = 0;

  for (const username of normalizedUsernames) {
    const candidateChunk = currentChunk ? `${currentChunk},${username}` : username;
    if (getUtf8ByteLength(candidateChunk) <= maxBytesPerChunk) {
      currentChunk = candidateChunk;
      continue;
    }

    if (!currentChunk) {
      overflow = true;
      overflowedUsernamesCount += 1;
      continue;
    }

    if (chunks.length >= maxChunks - 1) {
      overflow = true;
      overflowedUsernamesCount += 1;
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = username;
    if (getUtf8ByteLength(currentChunk) > maxBytesPerChunk) {
      overflow = true;
      currentChunk = '';
      overflowedUsernamesCount += 1;
    }
  }

  if (currentChunk) {
    if (chunks.length < maxChunks) {
      chunks.push(currentChunk);
    } else {
      overflow = true;
      overflowedUsernamesCount += currentChunk.split(',').filter(Boolean).length;
    }
  }

  return {
    chunks,
    overflow,
    overflowedUsernamesCount,
  };
}
