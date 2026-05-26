import type { Devvit } from '@devvit/public-api';
import type {
  HubModeratorUiState,
  ModeratorAccessSnapshot,
  ModeratorPermissionState,
  ViewerIdentitySnapshot,
} from './types.ts';
import {
  INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS,
  MODERATOR_LOOKUP_LOG_COOLDOWN_MS,
  MODERATOR_PERMISSION_CACHE_TTL_MS,
  MODERATOR_UI_POSITIVE_CACHE_TTL_MS,
  MODERATOR_UI_UNAVAILABLE_BACKOFF_MS,
} from './constants.ts';
import {
  moderatorLookupLogCooldownKey,
  moderatorPermissionCacheKey,
  moderatorUiPositiveCacheKey,
  moderatorUiUnavailableBackoffKey,
  pendingIndexKey,
} from './keys.ts';
import {
  dedupeNonEmpty,
  errorText,
  getCurrentSubredditNameCompat,
  looksLikeTransientRedditTransportError,
  maskUsernameForLog,
  normalizeUserId,
  normalizeUsername,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernamesEqual,
} from './normalize.ts';
import { parseBooleanString } from './settings.ts';

export const moderatorAccessRequestMemoSymbol = Symbol('vouchx.moderatorAccessRequestMemo');

export const viewerIdentityRequestMemoSymbol = Symbol('vouchx.viewerIdentityRequestMemo');

export function getViewerIdentityRequestMemo(
  context: Devvit.Context
): Promise<ViewerIdentitySnapshot> | undefined {
  const memoOwner = context as Devvit.Context & {
    [viewerIdentityRequestMemoSymbol]?: Promise<ViewerIdentitySnapshot>;
  };
  return memoOwner[viewerIdentityRequestMemoSymbol];
}

export async function getViewerIdentitySnapshot(context: Devvit.Context): Promise<ViewerIdentitySnapshot> {
  const existing = getViewerIdentityRequestMemo(context);
  if (existing) {
    return await existing;
  }

  const memoOwner = context as Devvit.Context & {
    [viewerIdentityRequestMemoSymbol]?: Promise<ViewerIdentitySnapshot>;
  };

  const lookupPromise = (async (): Promise<ViewerIdentitySnapshot> => {
    const fallbackUserId = normalizeUserId(context.userId);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const user = await context.reddit.getCurrentUser();
        const userId = normalizeUserId(String((user as { id?: string | null } | null)?.id ?? fallbackUserId));
        let username = normalizeUsernameStrict(
          String((user as { username?: string | null } | null)?.username ?? '')
        );

        if (!username) {
          try {
            username = normalizeUsernameStrict((await context.reddit.getCurrentUsername()) ?? '');
          } catch (usernameError) {
            if (attempt >= 1 && !user && !userId) {
              return {
                state: fallbackUserId ? 'unavailable' : 'anonymous',
                userId: fallbackUserId,
                username: null,
                user: null,
                error: fallbackUserId ? errorText(usernameError) : null,
              };
            }
          }
        }

        if (!user && !username && !userId) {
          return {
            state: 'anonymous',
            userId: '',
            username: null,
            user: null,
            error: null,
          };
        }

        return {
          state: user || username ? 'confirmed' : userId ? 'unavailable' : 'anonymous',
          userId,
          username: username || null,
          user: user ?? null,
          error: user || username ? null : 'Viewer identity unavailable.',
        };
      } catch (error) {
        const message = errorText(error);
        if (attempt < 1 && looksLikeTransientRedditTransportError(message)) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        return {
          state: fallbackUserId ? 'unavailable' : 'anonymous',
          userId: fallbackUserId,
          username: null,
          user: null,
          error: fallbackUserId ? message : null,
        };
      }
    }

    return {
      state: fallbackUserId ? 'unavailable' : 'anonymous',
      userId: fallbackUserId,
      username: null,
      user: null,
      error: null,
    };
  })();

  memoOwner[viewerIdentityRequestMemoSymbol] = lookupPromise;
  try {
    return await lookupPromise;
  } catch (error) {
    delete memoOwner[viewerIdentityRequestMemoSymbol];
    throw error;
  }
}

export function getModeratorAccessRequestMemo(
  context: Devvit.Context
): Map<string, Promise<ModeratorAccessSnapshot>> {
  const memoOwner = context as Devvit.Context & {
    [moderatorAccessRequestMemoSymbol]?: Map<string, Promise<ModeratorAccessSnapshot>>;
  };
  if (!memoOwner[moderatorAccessRequestMemoSymbol]) {
    memoOwner[moderatorAccessRequestMemoSymbol] = new Map<string, Promise<ModeratorAccessSnapshot>>();
  }
  return memoOwner[moderatorAccessRequestMemoSymbol]!;
}

export async function getModeratorAccessSnapshot(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<ModeratorAccessSnapshot> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const normalizedUsername = normalizeUsername(username);
  const memoKey = `${sanitizedSubreddit}:${normalizedUsername || username.trim().toLowerCase()}`;
  const memo = getModeratorAccessRequestMemo(context);
  const existing = memo.get(memoKey);
  if (existing) {
    return await existing;
  }

  const lookupPromise = (async (): Promise<ModeratorAccessSnapshot> => {
    const permissionSnapshot = await getCurrentModeratorPermissionSnapshot(context, sanitizedSubreddit, username);
    if (permissionSnapshot.permissions.length > 0) {
      return {
        state: permissionSnapshot.state,
        permissionState: permissionSnapshot.state,
        isModerator: true,
        permissions: permissionSnapshot.permissions,
      };
    }

    return {
      state: permissionSnapshot.state === 'unknown' ? 'unknown' : 'denied',
      permissionState: permissionSnapshot.state,
      isModerator: false,
      permissions: permissionSnapshot.permissions,
    };
  })();

  memo.set(memoKey, lookupPromise);
  try {
    return await lookupPromise;
  } catch (error) {
    memo.delete(memoKey);
    throw error;
  }
}

export async function assertCanReview(
  context: Devvit.Context,
  subredditName: string,
  username: string,
  access?: ModeratorAccessSnapshot
): Promise<void> {
  const snapshot = access ?? (await getModeratorAccessSnapshot(context, sanitizeSubredditName(subredditName), username));
  const accessError = getModeratorReviewAccessError(snapshot);
  if (accessError) {
    throw accessError;
  }
}

export async function getSettingsTabRequiresConfigAccess(
  context: Pick<Devvit.Context, 'settings'>
): Promise<boolean> {
  const raw = await context.settings.get<boolean | string>(INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS);
  return typeof raw === 'boolean' ? raw : parseBooleanString(raw, false);
}

export async function getCurrentModeratorPermissionList(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<string[]> {
  return (await getCurrentModeratorPermissionSnapshot(context, subredditName, username)).permissions;
}

export async function getCurrentModeratorPermissionSnapshot(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<{ permissions: string[]; state: ModeratorPermissionState }> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const viewerIdentity = await getViewerIdentitySnapshot(context);
  if (
    viewerIdentity.state !== 'confirmed' ||
    !viewerIdentity.username ||
    !usernamesEqual(viewerIdentity.username, username)
  ) {
    return {
      permissions: [],
      state: 'unknown',
    };
  }

  try {
    const currentUser = viewerIdentity.user;
    if (!currentUser) {
      const cachedPermissions = await getCachedModeratorPermissions(context, username);
      return {
        permissions: cachedPermissions,
        state: cachedPermissions.length > 0 ? 'cached' : 'unknown',
      };
    }
    const permissions = normalizeModeratorPermissions(
      await currentUser.getModPermissionsForSubreddit(sanitizedSubreddit)
    );
    await cacheModeratorPermissions(context, username, permissions);
    return {
      permissions,
      state: 'confirmed',
    };
  } catch (error) {
    const cachedPermissions = await getCachedModeratorPermissions(context, username);
    if (cachedPermissions.length > 0) {
      return {
        permissions: cachedPermissions,
        state: 'cached',
      };
    }
    await logModeratorLookupFailureWithCooldown(
      context,
      'permissions',
      username,
      `Moderator permission lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errorText(error)}`
    );
    return {
      permissions: [],
      state: 'unknown',
    };
  }
}

export async function assertCanAccessModeratorSettingsTab(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<void> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const access = await getModeratorAccessSnapshot(context, sanitizedSubreddit, username);
  const reviewAccessError = getModeratorReviewAccessError(access);
  if (reviewAccessError) {
    throw reviewAccessError;
  }
  const settingsTabRequiresConfigAccess = await getSettingsTabRequiresConfigAccess(context);
  if (!settingsTabRequiresConfigAccess) {
    return;
  }
  if (moderatorPermissionLookupNeedsRetry(access)) {
    throw createStatusError(503, 'Unable to verify moderator permissions right now. Please retry.');
  }
  if (!hasConfigAccessPermissionInList(access.permissions)) {
    throw createStatusError(403, 'Only moderators with config/settings access can use the Settings tab.');
  }
}

export function createStatusError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export function getModeratorMembershipError(
  access: ModeratorAccessSnapshot,
  deniedMessage: string
): (Error & { status: number }) | null {
  if (access.state === 'unknown') {
    return createStatusError(503, 'Unable to verify moderator access right now. Please retry.');
  }
  if (!access.isModerator) {
    return createStatusError(403, deniedMessage);
  }
  return null;
}

export function moderatorPermissionLookupNeedsRetry(access: ModeratorAccessSnapshot): boolean {
  return access.isModerator && access.permissionState === 'unknown' && access.permissions.length === 0;
}

export function getModeratorReviewAccessError(
  access: ModeratorAccessSnapshot
): (Error & { status: number }) | null {
  const membershipError = getModeratorMembershipError(
    access,
    'Only moderators with Manage Users permission can review verifications.'
  );
  if (membershipError) {
    return membershipError.status === 503
      ? createStatusError(503, membershipError.message)
      : createStatusError(403, 'Only moderators with Manage Users permission can review verifications.');
  }
  if (moderatorPermissionLookupNeedsRetry(access)) {
    return createStatusError(503, 'Unable to verify moderator permissions right now. Please retry.');
  }
  if (!hasManageUsersPermissionInList(access.permissions)) {
    return createStatusError(403, 'Only moderators with Manage Users permission can review verifications.');
  }
  return null;
}

export function hasManageUsersPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all') || normalized.includes('access');
}

export function hasConfigAccessPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all') || normalized.includes('config');
}

export function hasAllModeratorPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all');
}

export function normalizeModeratorPermissions(permissions: string[]): string[] {
  return dedupeNonEmpty(permissions.map((permission) => String(permission ?? '').trim()));
}

export function getModeratorCacheSubredditId(context: { subredditId?: string | null }): string {
  return sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
}

export async function cacheModeratorPermissions(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string,
  permissions: string[]
): Promise<void> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  const normalizedPermissions = normalizeModeratorPermissions(permissions);
  if (!subredditId || !normalizedUsername || normalizedPermissions.length === 0) {
    return;
  }

  try {
    await context.redis.set(
      moderatorPermissionCacheKey(subredditId, normalizedUsername),
      JSON.stringify(normalizedPermissions),
      {
        expiration: new Date(Date.now() + MODERATOR_PERMISSION_CACHE_TTL_MS),
      }
    );
  } catch {
    // Best-effort cache only.
  }
}

export async function getCachedModeratorPermissions(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string
): Promise<string[]> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return [];
  }

  try {
    const payload = await context.redis.get(moderatorPermissionCacheKey(subredditId, normalizedUsername));
    if (!payload) {
      return [];
    }
    const parsed = JSON.parse(payload) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeModeratorPermissions(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [];
  }
}

export async function cachePositiveModeratorUiState(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null; userId?: string | null }
): Promise<void> {
  const subredditId = getModeratorCacheSubredditId(context);
  const userId = normalizeUserId(context.userId);
  if (!subredditId || !userId) {
    return;
  }
  try {
    await context.redis.set(moderatorUiPositiveCacheKey(subredditId, userId), '1', {
      expiration: new Date(Date.now() + MODERATOR_UI_POSITIVE_CACHE_TTL_MS),
    });
    await context.redis.del(moderatorUiUnavailableBackoffKey(subredditId, userId));
  } catch {
    // Best-effort cache only.
  }
}

export async function hasCachedPositiveModeratorUiState(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null; userId?: string | null }
): Promise<boolean> {
  const subredditId = getModeratorCacheSubredditId(context);
  const userId = normalizeUserId(context.userId);
  if (!subredditId || !userId) {
    return false;
  }
  try {
    return Boolean(await context.redis.get(moderatorUiPositiveCacheKey(subredditId, userId)));
  } catch {
    return false;
  }
}

export async function setModeratorUiUnavailableBackoff(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null; userId?: string | null }
): Promise<void> {
  const subredditId = getModeratorCacheSubredditId(context);
  const userId = normalizeUserId(context.userId);
  if (!subredditId || !userId) {
    return;
  }
  try {
    await context.redis.set(moderatorUiUnavailableBackoffKey(subredditId, userId), '1', {
      expiration: new Date(Date.now() + MODERATOR_UI_UNAVAILABLE_BACKOFF_MS),
    });
  } catch {
    // Best-effort backoff only.
  }
}

export async function hasModeratorUiUnavailableBackoff(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null; userId?: string | null }
): Promise<boolean> {
  const subredditId = getModeratorCacheSubredditId(context);
  const userId = normalizeUserId(context.userId);
  if (!subredditId || !userId) {
    return false;
  }
  try {
    return Boolean(await context.redis.get(moderatorUiUnavailableBackoffKey(subredditId, userId)));
  } catch {
    return false;
  }
}

export async function logModeratorLookupFailureWithCooldown(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  scope: string,
  username: string,
  message: string
): Promise<void> {
  if (looksLikeTransientRedditTransportError(message)) {
    return;
  }
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return;
  }

  try {
    const shouldLog = await context.redis.set(
      moderatorLookupLogCooldownKey(subredditId, scope, normalizedUsername),
      '1',
      {
        nx: true,
        expiration: new Date(Date.now() + MODERATOR_LOOKUP_LOG_COOLDOWN_MS),
      }
    );
    if (shouldLog !== 'OK') {
      return;
    }
  } catch {
    return;
  }

  console.log(message);
}

export async function getHubModeratorUiState(context: Devvit.Context): Promise<HubModeratorUiState> {
  const hiddenState: HubModeratorUiState = {
    buttonVisible: false,
    isModerator: false,
    canReview: false,
    pendingCount: 0,
  };
  if (!normalizeUserId(context.userId)) {
    return hiddenState;
  }

  if (await hasCachedPositiveModeratorUiState(context)) {
    return {
      buttonVisible: true,
      isModerator: true,
      canReview: true,
      pendingCount: await context.redis.zCard(pendingIndexKey(sanitizeSubredditId(context.subredditId))),
    };
  }

  if (await hasModeratorUiUnavailableBackoff(context)) {
    return hiddenState;
  }

  const viewerIdentity = await getViewerIdentitySnapshot(context);
  if (viewerIdentity.state !== 'confirmed' || !viewerIdentity.username) {
    if (viewerIdentity.state === 'unavailable') {
      await setModeratorUiUnavailableBackoff(context);
    }
    return hiddenState;
  }

  const subredditName = await getCurrentSubredditNameCompat(context);
  const permissionSnapshot = await getCurrentModeratorPermissionSnapshot(context, subredditName, viewerIdentity.username);
  if (permissionSnapshot.state === 'unknown') {
    await setModeratorUiUnavailableBackoff(context);
    return hiddenState;
  }

  const canReview = hasManageUsersPermissionInList(permissionSnapshot.permissions);
  if (!canReview) {
    return {
      buttonVisible: false,
      isModerator: permissionSnapshot.permissions.length > 0,
      canReview: false,
      pendingCount: 0,
    };
  }

  await cachePositiveModeratorUiState(context);
  return {
    buttonVisible: true,
    isModerator: true,
    canReview: true,
    pendingCount: await context.redis.zCard(pendingIndexKey(sanitizeSubredditId(context.subredditId))),
  };
}
