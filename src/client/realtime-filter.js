// Decides whether a hub realtime "refresh" signal applies to the current viewer.
//
// The server targets per-user actions by attaching `usernames` to the hub
// refresh signal (see sendRefreshSignals in src/index.ts). This keeps a mod
// action from fanning out to every hub viewer at once (the main driver of
// Reddit Data API 429s):
//   - A signal with no `usernames` is global (e.g. settings/theme) -> everyone.
//   - Reviewers always refetch on any queue change so the pending-count bubble
//     stays accurate (there are only a handful of them, so the cost is tiny).
//   - Otherwise only viewers named in `usernames` refetch.
//
// Username comparison is case-insensitive to match the server's strict
// normalization (lowercased), so the two sides line up.
export function shouldApplyHubRefreshSignal(message, viewer) {
  if (!message || typeof message !== 'object' || message.type !== 'refresh') {
    return false;
  }
  const usernames = Array.isArray(message.usernames) ? message.usernames : null;
  if (!usernames || usernames.length === 0) {
    return true;
  }
  if (viewer && viewer.canReview) {
    return true;
  }
  const me = String((viewer && viewer.viewerUsername) || '').trim().toLowerCase();
  if (!me) {
    return false;
  }
  return usernames.some((name) => String(name ?? '').trim().toLowerCase() === me);
}
