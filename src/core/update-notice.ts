import type { Devvit } from '@devvit/public-api';
import type {
  ReleaseMetadata,
  UpdateNoticeState,
} from './types.ts';
import {
  GLOBAL_SETTING_LATEST_RELEASE_LINK,
  GLOBAL_SETTING_LATEST_RELEASE_NOTES,
  GLOBAL_SETTING_LATEST_RELEASE_SEVERITY,
  GLOBAL_SETTING_LATEST_RELEASE_TITLE,
  GLOBAL_SETTING_LATEST_RELEASE_VERSION,
  MILLIS_PER_DAY,
  UPDATE_NOTICE_DISMISS_TTL_DAYS,
} from './constants.ts';
import {
  updateNoticeDismissalKey,
} from './keys.ts';
import {
  compareVersions,
  errorText,
  parseVersion,
  sanitizeSubredditId,
} from './normalize.ts';

export function normalizeUpdateNoticeText(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? normalized : null;
}

export function normalizeUpdateNoticeUrl(value: unknown): string | null {
  const normalized = normalizeUpdateNoticeText(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeReleaseSeverity(value: unknown): 'critical' | 'normal' | null {
  const normalized = normalizeUpdateNoticeText(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }
  if (normalized === 'critical') {
    return 'critical';
  }
  if (normalized === 'normal') {
    return 'normal';
  }
  return null;
}

export async function readLatestReleaseMetadata(context: Pick<Devvit.Context, 'settings'>): Promise<ReleaseMetadata | null> {
  const [rawVersion, rawSeverity, rawTitle, rawNotes, rawLink] = await Promise.all([
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_VERSION),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_SEVERITY),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_TITLE),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_NOTES),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_LINK),
  ]);
  const parsedVersion = parseVersion(rawVersion);
  if (!parsedVersion) {
    return null;
  }
  const normalizedSeverity = normalizeReleaseSeverity(rawSeverity);
  return {
    version: parsedVersion.normalized,
    critical: normalizedSeverity === 'critical',
    title: normalizeUpdateNoticeText(rawTitle),
    notes: normalizeUpdateNoticeText(rawNotes),
    linkUrl: normalizeUpdateNoticeUrl(rawLink),
  };
}

export async function buildModeratorUpdateNotice(
  context: Pick<Devvit.Context, 'settings' | 'redis'> & { subredditId?: string | null; appVersion?: string | null },
  moderator: string
): Promise<UpdateNoticeState | null> {
  try {
    const installedVersion = parseVersion(context.appVersion);
    const latestRelease = await readLatestReleaseMetadata(context);
    const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
    if (!installedVersion || !latestRelease || !subredditId) {
      return null;
    }
    const latestVersion = parseVersion(latestRelease.version);
    if (!latestVersion || compareVersions(latestVersion, installedVersion) <= 0) {
      return null;
    }
    const dismissalKey = updateNoticeDismissalKey(subredditId, moderator, latestRelease.version);
    const dismissedAt = (await context.redis.get(dismissalKey)) ?? null;
    if (!latestRelease.critical) {
      if (dismissedAt) {
        return null;
      }
    }
    return {
      targetVersion: latestRelease.version,
      critical: latestRelease.critical,
      title: latestRelease.title,
      notes: latestRelease.notes,
      linkUrl: latestRelease.linkUrl,
    };
  } catch (error) {
    console.log(`Update notice lookup failed: ${errorText(error)}`);
    return null;
  }
}

export async function dismissModeratorUpdateNotice(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string,
  targetVersion: string
): Promise<void> {
  const parsedVersion = parseVersion(targetVersion);
  const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
  if (!parsedVersion || !subredditId) {
    throw new Error('Missing update notice version.');
  }
  await context.redis.set(
    updateNoticeDismissalKey(subredditId, moderator, parsedVersion.normalized),
    new Date().toISOString(),
    {
      expiration: new Date(Date.now() + UPDATE_NOTICE_DISMISS_TTL_DAYS * MILLIS_PER_DAY),
    }
  );
}
