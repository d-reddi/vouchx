import type { Devvit } from '@devvit/public-api';
import type { FeatureEducationPackState } from './types.ts';
import {
  FEATURE_EDUCATION_COMPLETION_TTL_DAYS,
  MILLIS_PER_DAY,
} from './constants.ts';
import {
  moderatorFeatureEducationCompletedKey,
  moderatorOnboardingCompletedKey,
} from './keys.ts';
import { errorText, sanitizeSubredditId } from './normalize.ts';

/**
 * Per-moderator onboarding tracking.
 *
 * Once setup is complete, each moderator is shown a one-time panel walkthrough
 * ("onboarding"). We record completion per (subreddit, moderator) so a mod only
 * ever sees it once, regardless of device (localStorage is per-device and can't
 * answer "who has / hasn't gone through it").
 */

const CURRENT_FEATURE_EDUCATION_PACKS: FeatureEducationPackState[] = [
  {
    id: 'peer-review-denial-badges',
    introducedIn: '1.5.4',
    retainUntilAtLeast: '1.8.0',
    title: 'Peer Review and denial badges',
    summary: 'See how Peer Review keeps second-opinion requests visible and how denial badges surface repeat attempts.',
    stepIds: ['demo-peer-review', 'demo-denial-badges'],
  },
];

function normalizeFeaturePackId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function cloneFeaturePack(pack: FeatureEducationPackState): FeatureEducationPackState {
  return {
    ...pack,
    stepIds: [...pack.stepIds],
  };
}

function featureEducationCompletionExpiration(): Date {
  return new Date(Date.now() + FEATURE_EDUCATION_COMPLETION_TTL_DAYS * MILLIS_PER_DAY);
}

export function getCurrentFeatureEducationPacks(): FeatureEducationPackState[] {
  return CURRENT_FEATURE_EDUCATION_PACKS.map(cloneFeaturePack);
}

function getKnownFeatureEducationPacks(packIds: readonly string[]): FeatureEducationPackState[] {
  const requestedIds = new Set(packIds.map(normalizeFeaturePackId).filter(Boolean));
  if (requestedIds.size === 0) {
    return [];
  }
  return CURRENT_FEATURE_EDUCATION_PACKS.filter((pack) => requestedIds.has(pack.id));
}

export async function getPendingModeratorFeatureEducationPacks(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string
): Promise<FeatureEducationPackState[]> {
  try {
    const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
    const normalizedModerator = moderator.trim();
    if (!subredditId || !normalizedModerator) {
      return [];
    }
    const completionValues = await Promise.all(
      CURRENT_FEATURE_EDUCATION_PACKS.map((pack) =>
        context.redis.get(moderatorFeatureEducationCompletedKey(subredditId, normalizedModerator, pack.id))
      )
    );
    return CURRENT_FEATURE_EDUCATION_PACKS.filter((_, index) => !completionValues[index]).map(cloneFeaturePack);
  } catch (error) {
    console.log(`Feature education lookup failed: ${errorText(error)}`);
    // Match onboarding's fail-open posture: Redis trouble should not trap mods
    // in repeating education flows.
    return [];
  }
}

export async function markModeratorFeatureEducationCompleted(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string,
  packIds: readonly string[]
): Promise<void> {
  const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
  const normalizedModerator = moderator.trim();
  const packs = getKnownFeatureEducationPacks(packIds);
  if (!subredditId || !normalizedModerator || packs.length === 0) {
    throw new Error('Missing feature education completion details.');
  }
  const completedAt = new Date().toISOString();
  const expiration = featureEducationCompletionExpiration();
  await Promise.all(
    packs.map((pack) =>
      context.redis.set(
        moderatorFeatureEducationCompletedKey(subredditId, normalizedModerator, pack.id),
        completedAt,
        { expiration }
      )
    )
  );
}

export async function hasCompletedModeratorOnboarding(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string
): Promise<boolean> {
  try {
    const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
    const normalizedModerator = moderator.trim();
    if (!subredditId || !normalizedModerator) {
      return false;
    }
    const value = await context.redis.get(moderatorOnboardingCompletedKey(subredditId, normalizedModerator));
    return Boolean(value);
  } catch (error) {
    console.log(`Onboarding lookup failed: ${errorText(error)}`);
    // Fail open (treat as completed) so a transient Redis error never traps a
    // moderator in a repeating walkthrough.
    return true;
  }
}

export async function markModeratorOnboardingCompleted(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string
): Promise<void> {
  const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
  const normalizedModerator = moderator.trim();
  if (!subredditId || !normalizedModerator) {
    throw new Error('Missing onboarding moderator identity.');
  }
  const completedAt = new Date().toISOString();
  const featureExpiration = featureEducationCompletionExpiration();
  await Promise.all([
    context.redis.set(moderatorOnboardingCompletedKey(subredditId, normalizedModerator), completedAt),
    ...CURRENT_FEATURE_EDUCATION_PACKS.map((pack) =>
      context.redis.set(
        moderatorFeatureEducationCompletedKey(subredditId, normalizedModerator, pack.id),
        completedAt,
        { expiration: featureExpiration }
      )
    ),
  ]);
}
