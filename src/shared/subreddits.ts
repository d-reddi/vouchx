export const VOUCHX_HOME_SUBREDDIT_NAME = 'vouchx';

export function normalizeRedditSubredditName(input: string | null | undefined): string {
  return String(input ?? '')
    .trim()
    .replace(/^r\//i, '')
    .toLowerCase();
}

export function isVouchxHomeSubreddit(input: string | null | undefined): boolean {
  return normalizeRedditSubredditName(input) === VOUCHX_HOME_SUBREDDIT_NAME;
}
