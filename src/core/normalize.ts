import type { ParsedVersion } from './types.ts';
import { normalizeLooseRedditUsername, normalizeStrictRedditUsername } from '../shared/global-usernames.ts';
import type { Devvit } from '@devvit/public-api';

export function parseVersion(value: unknown): ParsedVersion | null {
  const normalized = typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('.');
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }
  if (!parts.every((part) => /^\d+$/.test(part))) {
    return null;
  }
  const [major, minor, patch, playtestRevision = 0] = parts.map((part) => Number(part));
  if (![major, minor, patch, playtestRevision].every((part) => Number.isSafeInteger(part) && part >= 0)) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    playtestRevision,
    normalized: parts.length === 4 ? `${major}.${minor}.${patch}.${playtestRevision}` : `${major}.${minor}.${patch}`,
  };
}

export function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }
  return left.playtestRevision - right.playtestRevision;
}

export function normalizeOptionalIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsedMs = new Date(value).getTime();
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : null;
}

export function normalizeOptionalWholeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

export function normalizeNonNegativeWholeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function parseTimestampMs(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function getFiniteTimestampMs(input: string | null | undefined, fallbackMs: number): number {
  const parsedMs = typeof input === 'string' ? new Date(input).getTime() : Number.NaN;
  return Number.isFinite(parsedMs) ? parsedMs : fallbackMs;
}

export function sanitizeSubredditId(input: string): string {
  return input.trim().toLowerCase();
}

export function sanitizeSubredditName(input: string): string {
  return input.trim().replace(/^\/?r\//i, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

export function normalizeUserId(input: string | null | undefined): string {
  return typeof input === 'string' ? input.trim() : '';
}

export function normalizeUsername(input: string): string {
  return normalizeLooseRedditUsername(input);
}

export function normalizeUsernameStrict(input: string): string {
  return normalizeStrictRedditUsername(input);
}

export function normalizeUsernameForLookup(input: string): string {
  return normalizeUsernameStrict(input) || normalizeUsername(input);
}

export function primaryUsernameLookupField(input: string): string {
  return normalizeUsernameStrict(input) || normalizeUsername(input);
}

export function usernameLookupFields(input: string): string[] {
  const compatibility = normalizeUsername(input);
  const strict = normalizeUsernameStrict(input);
  return Array.from(
    new Set(
      [
        compatibility,
        strict,
        strict ? `u/${strict}` : '',
        strict ? `/u/${strict}` : '',
        strict ? `/user/${strict}` : '',
        strict ? `/user/${strict}/` : '',
        strict ? `https://www.reddit.com/user/${strict}` : '',
        strict ? `https://www.reddit.com/user/${strict}/` : '',
        strict ? `https://www.reddit.com/user/${strict}/about/` : '',
      ].filter((value) => typeof value === 'string' && value.trim())
    )
  );
}

export function normalizeModmailConversationId(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized.replace(/^ModmailConversation[_:]/i, '');
}

export function maskUsernameForLog(input: string | null | undefined): string {
  const normalized = normalizeUsernameForLookup(input ?? '');
  if (!normalized) {
    return '<redacted-user>';
  }
  if (normalized.length <= 2) {
    return `${normalized.slice(0, 1)}*`;
  }
  if (normalized.length <= 4) {
    return `${normalized.slice(0, 1)}***`;
  }
  return `${normalized.slice(0, 2)}***${normalized.slice(-1)}`;
}

export function normalizeUsernameKey(input: string): string {
  return normalizeUsername(input);
}

export function usernamesEqual(left: string, right: string): boolean {
  return normalizeUsernameForLookup(left) === normalizeUsernameForLookup(right);
}

export function addDaysIso(days: number, fromMs: number): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

export function dedupeNonEmpty(values: string[]): string[] {
  const deduped: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (!deduped.includes(trimmed)) {
      deduped.push(trimmed);
    }
  }
  return deduped;
}

export function looksLikeDeletedOrSuspendedError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes('user_doesnt_exist')) {
    return true;
  }
  if (normalized.includes('does not exist') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes("doesn't exist") && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('doesnt exist') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('unknown user')) {
    return true;
  }
  if (normalized.includes('not found') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('account deleted') || normalized.includes('account is deleted')) {
    return true;
  }
  if (normalized.includes('account suspended') || normalized.includes('user is suspended')) {
    return true;
  }
  return false;
}

export function looksLikeTransientRedditTransportError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('unknown internal error') ||
    /\bhttp(?:\s+status)?\s+429\b/.test(normalized) ||
    /\b429\s+too many requests\b/.test(normalized) ||
    (normalized.includes('http request') && /http status 5\d\d\b/.test(normalized)) ||
    (normalized.includes('grpc invocation failed') && /\b5\d\d\b/.test(normalized)) ||
    /\b5\d\d\s+internal server error\b/.test(normalized) ||
    normalized.includes('unexpected eof') ||
    normalized.includes('i/o timeout') ||
    normalized.includes('read tcp') ||
    normalized.includes('write tcp') ||
    normalized.includes('upstream request missing or timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('socket hang up') ||
    normalized.includes('econnreset') ||
    normalized.includes('connection reset') ||
    normalized.includes('goaway') ||
    normalized.includes('graceful shutdown') ||
    normalized.includes('call cancelled') ||
    /^1 cancelled\b/.test(normalized) ||
    /\bfailed to get \d{3} response after \d+ attempts?\b/.test(normalized)
  );
}

export function looksLikeRedditPermissionOrRateLimitError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /\b(?:401|403|429)\b/.test(normalized) ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('permission denied') ||
    normalized.includes('insufficient permission') ||
    normalized.includes('not permitted') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('ratelimit')
  );
}

export function looksLikeRedditNameFormattingError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    /\b(?:invalid|malformed|missing)\b[^\n]*(?:user(?:name)?|subreddit|community|recipient|field ['"]?(?:to|username|subreddit))/.test(
      normalized
    ) ||
    /(?:user(?:name)?|subreddit|community|recipient|field ['"]?(?:to|username|subreddit))[^\n]*\b(?:invalid|malformed|missing)\b/.test(
      normalized
    )
  );
}

export async function getCurrentSubredditNameCompat(
  context: Pick<Devvit.Context, 'reddit'> & { subredditName?: string | null }
): Promise<string> {
  const contextSubredditName = sanitizeSubredditName(typeof context.subredditName === 'string' ? context.subredditName : '');
  if (contextSubredditName) {
    return contextSubredditName;
  }

  const redditClient = context.reddit as Devvit.Context['reddit'] & {
    getCurrentSubredditName?: () => Promise<string>;
    getCurrentSubreddit: () => Promise<{ name?: string | null }>;
  };

  if (typeof redditClient.getCurrentSubredditName === 'function') {
    const subredditName = sanitizeSubredditName(await redditClient.getCurrentSubredditName());
    if (subredditName) {
      return subredditName;
    }
  }

  const subreddit = await redditClient.getCurrentSubreddit();
  return sanitizeSubredditName(typeof subreddit?.name === 'string' ? subreddit.name : '');
}
