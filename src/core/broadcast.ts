import type { Devvit } from '@devvit/public-api';
import type {
  BroadcastComposeInput,
  BroadcastEntry,
  BroadcastHistoryItem,
  BroadcastPage,
  BroadcastPollSummary,
  BroadcastType,
  DeveloperBroadcastState,
  ModmailStepResult,
  SchedulerContext,
} from './types.ts';
import {
  BROADCAST_BODY_MAX_LENGTH,
  BROADCAST_DELIVERY_LOCK_TTL_MS,
  BROADCAST_DEV_SUBREDDIT,
  BROADCAST_HOST_SUBREDDIT,
  BROADCAST_MAX_AGE_MS,
  BROADCAST_POLL_SECOND_SLOT_STEP,
  BROADCAST_POLL_SLOT_COUNT,
  INSTALL_SETTING_APP_ANNOUNCEMENTS_ENABLED,
  BROADCAST_MAX_ENTRIES_ON_PAGE,
  BROADCAST_PAGE_SCHEMA_VERSION,
  BROADCAST_POLL_JOB_NAME,
  BROADCAST_POLL_SCHEDULE_LOCK_TTL_MS,
  BROADCAST_POLL_SCHEDULE_PRESENT_TTL_MS,
  BROADCAST_PROCESSED_TTL_MS,
  BROADCAST_SUBJECT_MAX_LENGTH,
  GLOBAL_SETTING_BROADCAST_WIKI_PAGE,
  GLOBAL_SETTING_DEVELOPER_UI_USERNAMES,
} from './constants.ts';
import {
  broadcastDeliveryLockKey,
  broadcastDeliveredKey,
  broadcastPollScheduleLockKey,
  broadcastPollSchedulePresentKey,
} from './keys.ts';
import {
  compareVersions,
  errorText,
  normalizeOptionalBoolean,
  normalizeUsernameStrict,
  parseVersion,
  sanitizeSubredditId,
  sanitizeSubredditName,
} from './normalize.ts';
import { createRedisLockToken, releaseRedisLockIfOwned } from './locks.ts';
import { readGlobalUsernameSetting } from './blocking.ts';
import { sendModNotification } from './modmail.ts';

// Author-facing token that each receiving installation expands to its own
// community handle (r/SubName) at delivery time.
const BROADCAST_SUBREDDIT_TOKEN_PATTERN = /\{\{\s*subreddit\s*\}\}/gi;

// Subreddits allowed to author broadcasts. Both read and write the canonical
// wiki on BROADCAST_HOST_SUBREDDIT.
const BROADCAST_HOST_SUBREDDITS: readonly string[] = [BROADCAST_HOST_SUBREDDIT, BROADCAST_DEV_SUBREDDIT];

type BroadcastReadContext = Pick<Devvit.Context, 'reddit'>;
type BroadcastSettingsContext = Pick<Devvit.Context, 'settings'>;

export type BroadcastComposeValidation =
  | { ok: true; value: { subject: string; body: string; type: BroadcastType; maxVersion: string | null } }
  | { ok: false; error: string };

// Unknown/legacy values fall back to the opt-out-able announcement type, the
// safer default (it respects a subreddit's app-announcements preference).
export function normalizeBroadcastType(value: unknown): BroadcastType {
  return value === 'notification' ? 'notification' : 'announcement';
}

export type BroadcastPublishResult =
  | { ok: true; entry: BroadcastEntry; total: number }
  | { ok: false; error: string };

export type BroadcastMutationResult = { ok: true } | { ok: false; error: string };

type BroadcastPageParseResult =
  | { ok: true; page: BroadcastPage }
  | { ok: false; error: string };

export type BroadcastPageReadResult =
  | { status: 'ok'; page: BroadcastPage }
  | { status: 'missing'; error: string }
  | { status: 'invalid'; error: string }
  | { status: 'error'; error: string };

type AnnouncementPreference =
  | { status: 'available'; enabled: boolean }
  | { status: 'unavailable'; error: string };

export function resolveBroadcastTokens(text: string, subredditName: string): string {
  const normalized = sanitizeSubredditName(subredditName);
  const replacement = normalized ? `r/${normalized}` : 'this subreddit';
  return String(text ?? '').replace(BROADCAST_SUBREDDIT_TOKEN_PATTERN, replacement);
}

export function sanitizeWikiPageName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-/]/g, '')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 200);
}

// True for subreddits allowed to drive the broadcast interface (compose /
// publish / revoke). The broadcast log itself always lives on
// BROADCAST_HOST_SUBREDDIT; the dev subreddit can author it from its own hub.
export function isBroadcastHostSubreddit(subredditName: string | null | undefined): boolean {
  return BROADCAST_HOST_SUBREDDITS.includes(sanitizeSubredditName(subredditName ?? ''));
}

export function validateBroadcastCompose(input: Partial<BroadcastComposeInput>): BroadcastComposeValidation {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!subject) {
    return { ok: false, error: 'Enter a subject.' };
  }
  if (subject.length > BROADCAST_SUBJECT_MAX_LENGTH) {
    return { ok: false, error: `Subject must be ${BROADCAST_SUBJECT_MAX_LENGTH} characters or fewer.` };
  }
  if (!body) {
    return { ok: false, error: 'Enter a message body.' };
  }
  if (body.length > BROADCAST_BODY_MAX_LENGTH) {
    return { ok: false, error: `Body must be ${BROADCAST_BODY_MAX_LENGTH} characters or fewer.` };
  }
  let maxVersion: string | null = null;
  const rawMax = typeof input.maxVersion === 'string' ? input.maxVersion.trim() : '';
  if (rawMax) {
    const parsed = parseVersion(rawMax);
    if (!parsed) {
      return { ok: false, error: 'Version filter must look like 1.2.3, or be left blank to reach every installation.' };
    }
    maxVersion = parsed.normalized;
  }
  return { ok: true, value: { subject, body, type: normalizeBroadcastType(input.type), maxVersion } };
}

function createBroadcastId(nowMs: number): string {
  return `${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function coerceBroadcastEntry(raw: unknown): BroadcastEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const createdAt = typeof obj.createdAt === 'string' ? obj.createdAt.trim() : '';
  const subject = typeof obj.subject === 'string' ? obj.subject : '';
  const body = typeof obj.body === 'string' ? obj.body : '';
  if (!id || !createdAt || !subject.trim() || !body.trim()) {
    return null;
  }
  if (!Number.isFinite(new Date(createdAt).getTime())) {
    return null;
  }
  const maxVersionRaw = typeof obj.maxVersion === 'string' ? obj.maxVersion.trim() : '';
  const parsedMaxVersion = maxVersionRaw ? parseVersion(maxVersionRaw) : null;
  if (maxVersionRaw && !parsedMaxVersion) {
    return null;
  }
  const authoredByRaw = typeof obj.authoredBy === 'string' ? obj.authoredBy.trim() : '';
  return {
    id,
    createdAt,
    subject,
    body,
    type: normalizeBroadcastType(obj.type),
    maxVersion: parsedMaxVersion ? parsedMaxVersion.normalized : null,
    revoked: obj.revoked === true,
    authoredBy: authoredByRaw || null,
  };
}

export function parseBroadcastPage(content: unknown): BroadcastPageParseResult {
  const empty: BroadcastPage = { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts: [] };
  if (typeof content !== 'string' || !content.trim()) {
    return { ok: true, page: empty };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: 'Broadcast wiki content is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Broadcast wiki content must be a JSON object.' };
  }
  const schemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== BROADCAST_PAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported broadcast wiki schema version ${String(schemaVersion ?? 'missing')}.`,
    };
  }
  const rawList = (parsed as { broadcasts?: unknown }).broadcasts;
  if (!Array.isArray(rawList)) {
    return { ok: false, error: 'Broadcast wiki content must include a broadcasts array.' };
  }
  const broadcasts: BroadcastEntry[] = [];
  const seen = new Set<string>();
  for (const raw of rawList) {
    const entry = coerceBroadcastEntry(raw);
    if (!entry) {
      return { ok: false, error: 'Broadcast wiki content contains an invalid entry.' };
    }
    if (seen.has(entry.id)) {
      return { ok: false, error: `Broadcast wiki content contains duplicate id ${entry.id}.` };
    }
    seen.add(entry.id);
    broadcasts.push(entry);
  }
  return { ok: true, page: { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts } };
}

export function serializeBroadcastPage(page: BroadcastPage): string {
  return JSON.stringify(
    { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts: page.broadcasts },
    null,
    2
  );
}

// Newest first, drop anything past the max age (so the shared page stays small
// and new installs never see stale announcements), then cap the entry count.
export function pruneBroadcastEntries(entries: BroadcastEntry[], nowMs: number): BroadcastEntry[] {
  return [...entries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((entry) => {
      const created = new Date(entry.createdAt).getTime();
      return Number.isFinite(created) && nowMs - created <= BROADCAST_MAX_AGE_MS;
    })
    .slice(0, BROADCAST_MAX_ENTRIES_ON_PAGE);
}

function toHistoryItem(entry: BroadcastEntry): BroadcastHistoryItem {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    subject: entry.subject,
    type: entry.type,
    maxVersion: entry.maxVersion,
    revoked: entry.revoked,
    authoredBy: entry.authoredBy,
  };
}

// Default ON: a subreddit only stops receiving opt-out announcements when the
// install setting is explicitly turned off.
async function readAppAnnouncementsEnabled(context: BroadcastSettingsContext): Promise<AnnouncementPreference> {
  try {
    const raw = await context.settings.get<boolean | string>(INSTALL_SETTING_APP_ANNOUNCEMENTS_ENABLED);
    return { status: 'available', enabled: normalizeOptionalBoolean(raw) !== false };
  } catch (error) {
    return { status: 'unavailable', error: errorText(error) };
  }
}

export async function readBroadcastPagePointer(context: BroadcastSettingsContext): Promise<string | null> {
  const raw = await context.settings.get<string>(GLOBAL_SETTING_BROADCAST_WIKI_PAGE);
  return sanitizeWikiPageName(raw) || null;
}

export async function isBroadcastDeveloper(
  context: BroadcastSettingsContext,
  username: string | null | undefined
): Promise<boolean> {
  const normalized = normalizeUsernameStrict(username ?? '');
  if (!normalized) {
    return false;
  }
  const developers = await readGlobalUsernameSetting(context, GLOBAL_SETTING_DEVELOPER_UI_USERNAMES);
  return developers.usernames.includes(normalized);
}

function looksLikeMissingWikiPageError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const status = 'status' in error ? Number(error.status) : NaN;
    const code = 'code' in error ? String(error.code).toLowerCase() : '';
    if (status === 404 || code === '404' || code === 'not_found' || code === 'not-found') {
      return true;
    }
  }
  const message = errorText(error).toLowerCase();
  return /(?:wiki\s+)?page\s+(?:was\s+)?(?:not\s+found|does\s+not\s+exist)|\b404\b/.test(message);
}

// Reads the canonical wiki without collapsing missing, invalid, and transient
// failures into the same empty state. Polling and publishing can then fail
// closed without overwriting a valid page after an unsuccessful read.
export async function readBroadcastPageFromWiki(
  context: BroadcastReadContext,
  pageName: string
): Promise<BroadcastPageReadResult> {
  const page = sanitizeWikiPageName(pageName);
  if (!page) {
    return { status: 'error', error: 'The configured broadcast wiki page name is invalid.' };
  }
  try {
    const wikiPage = await context.reddit.getWikiPage(BROADCAST_HOST_SUBREDDIT, page);
    const parsed = parseBroadcastPage(wikiPage?.content ?? '');
    return parsed.ok
      ? { status: 'ok', page: parsed.page }
      : { status: 'invalid', error: parsed.error };
  } catch (error) {
    const detail = errorText(error);
    return looksLikeMissingWikiPageError(error)
      ? { status: 'missing', error: detail || 'Broadcast wiki page was not found.' }
      : { status: 'error', error: detail || 'Broadcast wiki page could not be read.' };
  }
}

async function writeBroadcastPage(
  context: BroadcastReadContext,
  pageName: string,
  page: BroadcastPage,
  reason: string
): Promise<boolean> {
  const content = serializeBroadcastPage(page);
  try {
    await context.reddit.updateWikiPage({ subredditName: BROADCAST_HOST_SUBREDDIT, page: pageName, content, reason });
    return true;
  } catch {
    // The page may not exist yet; fall back to creating it.
    try {
      await context.reddit.createWikiPage({ subredditName: BROADCAST_HOST_SUBREDDIT, page: pageName, content, reason });
      return true;
    } catch {
      return false;
    }
  }
}

export async function getDeveloperBroadcastState(
  context: BroadcastReadContext & BroadcastSettingsContext,
  currentSubredditName: string
): Promise<DeveloperBroadcastState> {
  const pageName = await readBroadcastPagePointer(context);
  let history: BroadcastHistoryItem[] = [];
  let pageError: string | null = null;
  if (pageName) {
    const result = await readBroadcastPageFromWiki(context, pageName);
    if (result.status === 'ok') {
      history = result.page.broadcasts.map(toHistoryItem);
    } else if (result.status !== 'missing') {
      pageError = result.error;
    }
  }
  return {
    canPublish: isBroadcastHostSubreddit(currentSubredditName),
    hostSubreddit: BROADCAST_HOST_SUBREDDIT,
    pointerConfigured: Boolean(pageName),
    pageName,
    pageError,
    history,
  };
}

export async function publishBroadcast(
  context: BroadcastReadContext & BroadcastSettingsContext,
  params: { authoredBy: string; input: Partial<BroadcastComposeInput>; nowMs?: number }
): Promise<BroadcastPublishResult> {
  const pageName = await readBroadcastPagePointer(context);
  if (!pageName) {
    return {
      ok: false,
      error: 'No broadcast page is configured. Set the broadcast_wiki_page global setting via the Devvit CLI first.',
    };
  }
  const validation = validateBroadcastCompose(params.input);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const nowMs = params.nowMs ?? Date.now();
  const readResult = await readBroadcastPageFromWiki(context, pageName);
  if (readResult.status === 'invalid') {
    return { ok: false, error: `${readResult.error} Fix the canonical wiki page before publishing.` };
  }
  if (readResult.status === 'error') {
    return { ok: false, error: `Could not safely read the broadcast page: ${readResult.error}` };
  }
  const existing = readResult.status === 'ok'
    ? readResult.page
    : { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts: [] };
  const entry: BroadcastEntry = {
    id: createBroadcastId(nowMs),
    createdAt: new Date(nowMs).toISOString(),
    subject: validation.value.subject,
    body: validation.value.body,
    type: validation.value.type,
    maxVersion: validation.value.maxVersion,
    revoked: false,
    authoredBy: normalizeUsernameStrict(params.authoredBy) || null,
  };
  const nextEntries = pruneBroadcastEntries([entry, ...existing.broadcasts], nowMs);
  const written = await writeBroadcastPage(
    context,
    pageName,
    { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts: nextEntries },
    `VouchX broadcast ${entry.id}`
  );
  if (!written) {
    return {
      ok: false,
      error: `Could not write the broadcast page. Confirm the app account can edit the wiki on r/${BROADCAST_HOST_SUBREDDIT}.`,
    };
  }
  return { ok: true, entry, total: nextEntries.length };
}

export async function revokeBroadcast(
  context: BroadcastReadContext & BroadcastSettingsContext,
  broadcastId: string,
  nowMs = Date.now()
): Promise<BroadcastMutationResult> {
  const pageName = await readBroadcastPagePointer(context);
  if (!pageName) {
    return { ok: false, error: 'No broadcast page is configured.' };
  }
  const id = String(broadcastId ?? '').trim();
  if (!id) {
    return { ok: false, error: 'Missing broadcast id.' };
  }
  const readResult = await readBroadcastPageFromWiki(context, pageName);
  if (readResult.status !== 'ok') {
    return { ok: false, error: `Could not safely read the broadcast page: ${readResult.error}` };
  }
  let found = false;
  const broadcasts = readResult.page.broadcasts.map((entry) => {
    if (entry.id === id) {
      found = true;
      return { ...entry, revoked: true };
    }
    return entry;
  });
  if (!found) {
    return { ok: false, error: 'That broadcast is no longer on the page.' };
  }
  const written = await writeBroadcastPage(
    context,
    pageName,
    { schemaVersion: BROADCAST_PAGE_SCHEMA_VERSION, broadcasts: pruneBroadcastEntries(broadcasts, nowMs) },
    `VouchX broadcast revoke ${id}`
  );
  return written ? { ok: true } : { ok: false, error: 'Could not update the broadcast page.' };
}

// Delivers the composed message to the current subreddit's own modmail only.
// Does not touch the shared wiki log — used to proof markdown and the
// {{subreddit}} token before broadcasting to every installation.
export async function sendBroadcastTest(
  context: BroadcastReadContext,
  params: { subredditId: string; subredditName: string; input: Partial<BroadcastComposeInput> }
): Promise<ModmailStepResult> {
  const validation = validateBroadcastCompose(params.input);
  if (!validation.ok) {
    return { status: 'failed', reason: validation.error };
  }
  const subject = resolveBroadcastTokens(validation.value.subject, params.subredditName);
  const body = resolveBroadcastTokens(validation.value.body, params.subredditName);
  return sendModNotification(context, params.subredditId, subject, body);
}

async function markBroadcastDelivered(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  broadcastId: string,
  nowMs: number
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await context.redis.set(broadcastDeliveredKey(subredditId, broadcastId), '1', {
        expiration: new Date(nowMs + BROADCAST_PROCESSED_TTL_MS),
      });
      return true;
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  }
  return false;
}

function appendBroadcastFailure(summary: BroadcastPollSummary, broadcastId: string, reason: string): void {
  summary.failed += 1;
  if (summary.failureDetails.length < 5) {
    summary.failureDetails.push(`${broadcastId}: ${reason}`);
  }
}

function appendBroadcastDiagnostic(summary: BroadcastPollSummary, broadcastId: string, reason: string): void {
  if (summary.failureDetails.length < 5) {
    summary.failureDetails.push(`${broadcastId}: ${reason}`);
  }
}

// Runs on every installation's schedule. Reads the shared log, then for each
// live entry self-selects by version, delivers a mod notification, and records
// the delivery locally. Idempotency is per-installation, keyed by broadcast id;
// the wiki log is never written back to from here.
export async function runBroadcastPoll(
  context: Pick<Devvit.Context, 'reddit' | 'redis' | 'settings'> & { appVersion?: string | null },
  subredditId: string,
  subredditName: string,
  nowMs = Date.now()
): Promise<BroadcastPollSummary> {
  const summary: BroadcastPollSummary = {
    skipped: false,
    considered: 0,
    delivered: 0,
    alreadyDelivered: 0,
    deliveryInProgress: 0,
    skippedByVersion: 0,
    skippedExpired: 0,
    skippedRevoked: 0,
    skippedOptedOut: 0,
    failed: 0,
    markerFailures: 0,
    failureDetails: [],
  };
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedSubredditName = sanitizeSubredditName(subredditName);
  if (!normalizedSubredditId || !normalizedSubredditName) {
    return { ...summary, skipped: true, reason: 'missing-subreddit' };
  }
  const pageName = await readBroadcastPagePointer(context);
  if (!pageName) {
    return { ...summary, skipped: true, reason: 'no-pointer' };
  }
  const readResult = await readBroadcastPageFromWiki(context, pageName);
  if (readResult.status !== 'ok') {
    return {
      ...summary,
      skipped: true,
      reason: 'no-page',
      detail: `${readResult.status}: ${readResult.error}`,
    };
  }

  const myVersion = parseVersion(context.appVersion ?? null);
  const announcementPreference = await readAppAnnouncementsEnabled(context);
  for (const entry of readResult.page.broadcasts) {
    summary.considered += 1;
    if (entry.revoked) {
      summary.skippedRevoked += 1;
      continue;
    }
    const createdMs = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(createdMs) || nowMs - createdMs > BROADCAST_MAX_AGE_MS) {
      summary.skippedExpired += 1;
      continue;
    }
    const deliveredKey = broadcastDeliveredKey(normalizedSubredditId, entry.id);
    let alreadyDelivered: boolean;
    try {
      alreadyDelivered = Boolean(await context.redis.get(deliveredKey));
    } catch (error) {
      appendBroadcastFailure(summary, entry.id, `could not read delivery marker (${errorText(error)})`);
      continue;
    }
    if (alreadyDelivered) {
      summary.alreadyDelivered += 1;
      continue;
    }
    if (entry.maxVersion) {
      const maxVersion = parseVersion(entry.maxVersion);
      if (!myVersion) {
        // Own version unknown — do not deliver, but leave it unmarked so a later
        // poll with a resolved version can still qualify.
        summary.skippedByVersion += 1;
        continue;
      }
      if (!maxVersion || compareVersions(myVersion, maxVersion) >= 0) {
        // At or above the cutoff is terminal (the app version only increases).
        summary.skippedByVersion += 1;
        if (!(await markBroadcastDelivered(context, normalizedSubredditId, entry.id, nowMs))) {
          summary.markerFailures += 1;
          appendBroadcastDiagnostic(summary, entry.id, 'could not persist terminal version-filter marker');
        }
        continue;
      }
    }
    if (entry.type === 'announcement') {
      if (announcementPreference.status === 'unavailable') {
        appendBroadcastFailure(
          summary,
          entry.id,
          `could not read announcement preference (${announcementPreference.error})`
        );
        continue;
      }
      if (!announcementPreference.enabled) {
        // Opt-out broadcast suppressed for this subreddit. Leave it unmarked so
        // re-enabling before expiry still delivers it.
        summary.skippedOptedOut += 1;
        continue;
      }
    }

    const lockKey = broadcastDeliveryLockKey(normalizedSubredditId, entry.id);
    const lockToken = createRedisLockToken();
    try {
      const lock = await context.redis.set(lockKey, lockToken, {
        nx: true,
        expiration: new Date(Date.now() + BROADCAST_DELIVERY_LOCK_TTL_MS),
      });
      if (lock !== 'OK') {
        summary.deliveryInProgress += 1;
        continue;
      }
    } catch (error) {
      appendBroadcastFailure(summary, entry.id, `could not acquire delivery lock (${errorText(error)})`);
      continue;
    }

    try {
      // Close the race where another poll completed between the initial marker
      // read and this execution acquiring the lock.
      try {
        if (await context.redis.get(deliveredKey)) {
          summary.alreadyDelivered += 1;
          continue;
        }
      } catch (error) {
        appendBroadcastFailure(summary, entry.id, `could not recheck delivery marker (${errorText(error)})`);
        continue;
      }

      const subject = resolveBroadcastTokens(entry.subject, normalizedSubredditName);
      const body = resolveBroadcastTokens(entry.body, normalizedSubredditName);
      const result = await sendModNotification(context, normalizedSubredditId, subject, body);
      if (result.status === 'failed') {
        // Leave unmarked so the next poll retries delivery.
        appendBroadcastFailure(summary, entry.id, result.reason ?? 'mod notification delivery failed');
        continue;
      }
      summary.delivered += 1;
      if (!(await markBroadcastDelivered(context, normalizedSubredditId, entry.id, nowMs))) {
        summary.markerFailures += 1;
        appendBroadcastDiagnostic(summary, entry.id, 'delivered but could not persist delivery marker');
      }
    } finally {
      try {
        await releaseRedisLockIfOwned(context, lockKey, lockToken);
      } catch (error) {
        appendBroadcastDiagnostic(summary, entry.id, `could not release delivery lock (${errorText(error)})`);
      }
    }
  }
  return summary;
}

// The poll fires every 4 hours, offset into a per-subreddit slot that spreads
// installations across a multi-minute window so they don't all read the shared
// wiki at once. The slot is derived from the subreddit id: pseudo-random across
// installs but stable per install, so the schedule never churns. Devvit honors
// the seconds field on a best-effort basis, so the staggering is approximate.
export function broadcastPollCron(subredditId: string): string {
  const normalized = sanitizeSubredditId(subredditId);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  const offsetSeconds = (hash % BROADCAST_POLL_SLOT_COUNT) * BROADCAST_POLL_SECOND_SLOT_STEP;
  const minute = Math.floor(offsetSeconds / 60);
  const second = offsetSeconds % 60;
  // Six fields: second minute hour day-of-month month day-of-week.
  return `${second} ${minute} */4 * * *`;
}

export async function ensureBroadcastPollSchedule(
  context: SchedulerContext,
  subredditId: string,
  subredditName: string
): Promise<void> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedSubreddit = sanitizeSubredditName(subredditName);
  if (!normalizedSubredditId || !normalizedSubreddit) {
    return;
  }

  const cron = broadcastPollCron(normalizedSubredditId);
  const lockKey = broadcastPollScheduleLockKey(normalizedSubredditId);
  const presenceKey = broadcastPollSchedulePresentKey(normalizedSubredditId);
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  try {
    try {
      // The marker stores the cron it was scheduled with, so a changed cadence
      // invalidates it and forces a reschedule.
      if ((await context.redis.get(presenceKey)) === cron) {
        return;
      }
    } catch {
      // Continue without the presence marker if the read-through fails.
    }

    const lock = await context.redis.set(lockKey, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + BROADCAST_POLL_SCHEDULE_LOCK_TTL_MS),
    });
    if (lock !== 'OK') {
      return;
    }
    lockAcquired = true;

    const jobs = await context.scheduler.listJobs();
    const matchingJobs = jobs.filter((job) => {
      if (job.name !== BROADCAST_POLL_JOB_NAME) {
        return false;
      }
      const jobData = (job.data ?? {}) as { subredditId?: string };
      return sanitizeSubredditId(jobData.subredditId ?? '') === normalizedSubredditId;
    });
    const correctJob = matchingJobs.find((job) => 'cron' in job && job.cron === cron);

    // Cancel anything stale — a job on the previous cadence, or duplicates — so
    // the computed cron stays the single source of truth.
    for (const job of matchingJobs) {
      if (job === correctJob) {
        continue;
      }
      try {
        await context.scheduler.cancelJob(job.id);
      } catch {
        // Best-effort; a leftover job simply keeps firing until it is retried.
      }
    }

    if (!correctJob) {
      await context.scheduler.runJob({
        name: BROADCAST_POLL_JOB_NAME,
        cron,
        data: { subredditId: normalizedSubredditId, subredditName: normalizedSubreddit },
      });
    }

    try {
      await context.redis.set(presenceKey, cron, {
        expiration: new Date(Date.now() + BROADCAST_POLL_SCHEDULE_PRESENT_TTL_MS),
      });
    } catch {
      // Best-effort marker only.
    }
  } catch (error) {
    console.log(`[broadcast] Failed to schedule broadcast poll for r/${normalizedSubreddit}: ${errorText(error)}`);
  } finally {
    if (lockAcquired) {
      try {
        await context.redis.del(lockKey);
      } catch {
        // Best-effort release; the lock has a short TTL.
      }
    }
  }
}
