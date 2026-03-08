# VouchX

VouchX is a Devvit Web verification app for subreddits that need moderator-reviewed photo verification.

The app ships as:
- an inline verification post surface
- an expanded verification hub
- an expanded moderator panel
- a Devvit Web server backed by Redis, realtime refresh signals, and a scheduled retention job

## What The App Does

### Member experience
- Users open the post and see the verification panel directly in the post body.
- Users can submit or resubmit verification photos.
- Before the Devvit upload form opens, the user must accept the submission acknowledgements shown in the warning modal.
- Moderators can require `1`, `2`, or `3` photos.
- Users can open `Photo Instructions` before submitting.
- Users can withdraw a pending request.
- Verified users can remove their own verification.
- The hub auto-refreshes every 2 minutes while open.

### Moderator experience
- Moderators can review pending submissions in the expanded moderator panel.
- The moderator panel includes tabs for:
  - Pending
  - Blocked
  - History
  - Settings
  - Templates
  - Themes
- Moderator panel updates are driven by Devvit Realtime refresh signals.
- Pending requests support claim locking so multiple moderators do not action the same item at once.
- Denied requests can be reopened for re-review.
- Users can be manually blocked or unblocked.
- Users are auto-blocked after `3` denials.

### Moderator menu actions
- `Create Verification Hub (NSFW)` creates the app post.
- `Purge Audit Log` removes audit entries older than the installation-configured number of days.
- `Remove Verification Hub Post` removes an app-created verification post.

## User-Facing Status Rules

The hub can show:
- `Verified`
- `Verified (Manual)`
- `Pending review`
- `Pending re-review`
- `Blocked`
- `Not verified`

Important behavior:
- Verified status is based on live flair detection, not just stored record state.
- A blocked user who still has a valid verified flair continues to see `Verified` until the flair is removed or the verification is revoked.
- If submissions are disabled, users see the installation-configured disabled message.

## Flair Behavior

Approval applies the configured flair template ID.

Verified-state detection currently uses:
- flair template ID match
- OR configured CSS wildcard match

If Reddit omits the user’s live flair template ID, the app can also compare the user’s current flair text against the cached text of the configured flair template.

The app also performs flair reconciliation on load for approved users when the current flair looks like a stale app-applied flair that should be updated to the current configured template. It does not overwrite unrelated/manual flair just because the user has an approved record.

## Configuration Model

### Install settings
Install settings are per subreddit installation.

Current install settings:
- `Purge Audit Log days`
- `Verifications disabled message`
- `Denial Reason 1 Label`
- `Denial Reason 2 Label`
- `Denial Reason 3 Label`
- `Denial Reason 4 Label`

Notes:
- Denial reason labels are friendly names only.
- Leaving a denial reason label blank hides that reason in the moderator UI for that subreddit.

### Moderator panel settings
Moderator panel settings are also subreddit-specific.

Verification Settings tab:
- enable or disable submissions
- flair template ID
- optional flair CSS matcher
- required photo count
- photo instructions markdown
- estimated storage usage

Templates tab:
- modmail subject
- pending turnaround days
- pending body
- approval header/body
- denial header and denial body templates for enabled denial reasons
- revoked verification header/body

Themes tab:
- preset themes
- optional custom primary, accent, and background colors

### Legal links
The dashboard footer and submit-warning modal show:
- Terms and Conditions
- Privacy Policy

Those URLs are currently hardcoded in `webroot/hub-app.js`. If they change, rebuild and redeploy/upload the app.

## Template And Instruction Placeholders

### Photo Instructions
Photo instructions support markdown plus:
- `{{subreddit}}`
- `{{days}}`

### Modmail templates
Supported placeholders:
- `{{username}}`
- `{{mod}}`
- `{{subreddit}}`
- `{{date submitted}}`
- `{{reason}}`
- `{{days}}`

`{{days}}` renders with the unit included, for example `3 days`.

## Submission Flow

When a user submits:
1. The user opens the acknowledgement modal.
2. The user must confirm the submission statements.
3. The Devvit image form opens.
4. The app stores the returned media URLs on the verification record.
5. A pending modmail is sent.
6. A submission mod note is written.
7. The pending request appears in the moderator queue.

The pending submission records the acknowledgement timestamp for audit purposes.

## Review Flow

### Approve
- Applies flair
- Sends approval modmail
- Writes an approval mod note
- Moves the record into the approved index
- Schedules validation tracking

### Deny
- Stores the selected denial reason slot and optional moderator notes
- Sends denial modmail using the current configured denial template for that subreddit
- Writes a denial mod note
- Leaves the record in history
- Can trigger automatic blocking after repeated denials

### Revoke
- Removes the approved record from the approved index
- Attempts to remove flair
- Sends revoked verification modmail
- Writes a moderator note

## Realtime And Refresh Behavior

- The moderator panel subscribes to a subreddit-scoped realtime channel.
- Realtime messages do not contain user data; they only signal the client to refresh.
- Unsaved moderator drafts are preserved across realtime refreshes.
- The user hub auto-refreshes every 2 minutes while open.

## Data Stored

The app stores:
- verification records
- pending, approved, and history indexes
- audit log entries
- per-user latest and pending pointers
- blocked users and denial counters
- subreddit configuration
- validation-tracking indexes for approved users

The app also writes Reddit-side moderation artifacts such as modmail and mod notes.

## Retention And Cleanup

### Verification records
- Non-approved verification records are retained for `45 days`.
- Approved verification records are retained for `45 days` on a sliding TTL.

Approved sliding retention details:
- Approved records store `lastTtlBumpAt`.
- Loading the app for an approved verified user can bump retention.
- The bump is intentionally rate-limited to at most once every `24 hours` per approved record.

### Audit log
- Audit entries are retained for `45 days`.
- Moderators can purge audit entries earlier with the subreddit menu action.

### Cleanup jobs
The app has a daily scheduled cleanup/validation job that:
- revalidates approved users in batches
- purges verification data for users confirmed deleted or suspended
- scans non-approved history in batches
- purges expired audit entries
- sweeps stale TTL-expired record IDs out of shared indexes

### User self-removal and withdraw
- Withdrawing a pending request deletes the user’s verification records and app audit entries for that verification history.
- Self-removal deletes the user’s verification records and app audit entries for that verification history.
- These flows preserve the subreddit block record and denial counter.

## Development

Requirements:
- Node `>=22`

Scripts:
- `npm run dev` - Devvit playtest
- `npm run build` - Vite build
- `npm run check` - TypeScript typecheck
- `npm run deploy` - build then upload without rebuilding in upload step

Current app config:
- app name: `vouchx`
- dev subreddit: `vouchx_dev`

## Project Notes

- This app already uses the Devvit Web post model.
- The post UI lives under `webroot/`.
- The server entrypoint is `src/index.ts`.
- Shared app logic lives in `src/core.ts`.
- Legacy stale helpers like the old subreddit tracker have been removed.
