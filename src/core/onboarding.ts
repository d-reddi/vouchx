import type { Devvit } from '@devvit/public-api';
import { moderatorOnboardingCompletedKey } from './keys.ts';
import { errorText, sanitizeSubredditId } from './normalize.ts';

/**
 * Per-moderator onboarding tracking.
 *
 * Once setup is complete, each moderator is shown a one-time panel walkthrough
 * ("onboarding"). We record completion per (subreddit, moderator) so a mod only
 * ever sees it once, regardless of device (localStorage is per-device and can't
 * answer "who has / hasn't gone through it").
 */

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
  await context.redis.set(
    moderatorOnboardingCompletedKey(subredditId, normalizedModerator),
    new Date().toISOString()
  );
}
