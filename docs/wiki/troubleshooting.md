# Troubleshooting

This page collects common issues, operational limits, and retention behavior.

## Common setup issues

### `Mod Panel` is missing

The current account probably does not have `Manage Users` in that subreddit.

### Queue requests do not appear

Check `Settings -> General` and confirm an approval flair is saved. VouchX hides queue review cards until a valid approval flair is configured.

### Saving verification settings fails

The approval flair must be a valid Reddit user flair template. If using manual input, the template ID must be non-empty and match a Reddit-style template ID format.

### Deny is unavailable or fails

Check both conditions:

- at least one denial reason label is enabled in install settings
- a denial reason is selected in the pending card before clicking `Confirm denial`

The first `Deny` click only opens the denial options. This prevents accidental denials while typing notes.

### Batch denial is unavailable

Batch denial requires:

- at least two selected requests
- selected requests that are not reopened re-review cases
- at least one enabled denial reason
- a selected denial reason in the batch toolbar

Batch approval also requires at least two selected requests.

### Peer Review does not show Lock or Unlock

This is expected. Peer Review hides normal lock controls and shows `Cancel Peer Review` instead. Peer Review is not a lock; any moderator who can normally act on the request may approve, deny, add notes, or cancel Peer Review unless the request is locked by another moderator.

### Peer Review requests stay at the top of the queue

This is expected. Peer Review requests are prioritized above normal pending requests, with the oldest Peer Review request first.

### Reopen fails

A denied case can only be reopened when:

- the record is still denied
- the original photos are still available
- the user does not already have another pending request

If photos are unavailable, the user must submit again.

## Common member states

### User is blocked

A block stops new submissions. If the user is still showing as verified, check whether their verification flair has already been removed. A block can be:

- automatic after the configured denial threshold
- manual from the `Blocked` tab
- global from the app-level blocklist

### User says they are verified but status is wrong

VouchX determines verified status from live flair detection. It checks the configured approval flair template ID and can also fall back to the optional CSS substring matcher.

If automatic flair repair is enabled, approved users who open the hub can have missing verification flair restored, no more than once every 24 hours. Existing flair that matches the CSS fallback is not replaced.

### Shadowbanned user was denied automatically

If `Auto-deny shadowbanned accounts` is enabled in install settings, VouchX denies new submissions when Reddit reports the account as shadowbanned. The denial is automated, logged, does not increment the denial-count auto-block threshold, and sends appeal guidance.

### User wants to remove their data

Members can:

- withdraw a pending request
- remove their own verification after approval

These actions remove stored verification data and related audit entries for that user in the current subreddit workflow.

## Audit and history behavior

### Audit purge does nothing

The moderator menu action respects the install setting `Purge audit log data older than (days)`.

- `0` purges all audit entries
- any other value only purges entries older than that threshold

### Stats says `Not enough data yet`

`90% Decided Within` needs at least 10 timed approve/deny decisions in the selected range. Older audit entries without timing metadata are excluded.

### Denial reason stats look incomplete

Denial-reason breakdowns come from newer denial audit metadata. Legacy denials without reason metadata are excluded from this breakdown.

### Why a denied record shows `Reopened: Yes (cancelled)`

A moderator reopened the denied case and later canceled the re-review instead of completing it.

### History search does not run right away

Use the History filter controls and submit a search. The default summaries show `Last 45 days`, and larger histories are scanned in batches.

## Photo requirements behavior

### Android opens photo requirements differently

On Android, Photo Requirements may open as a dedicated page instead of an in-place popup. This is expected behavior for mobile compatibility.

### Users see a recent-instructions prompt

If photo requirements were reviewed recently, VouchX may ask the user to confirm whether they want to view them again or continue. This avoids forcing repeat readers through the same popup.

## Retention and cleanup

### What the app stores

VouchX stores:

- verification records
- pending, approved, and history indexes
- audit log entries
- blocked-user entries and denial counters
- subreddit configuration
- per-moderator onboarding and feature-education completion state
- validation tracking data

The app does not store uploaded image files directly. It stores the media URLs returned by the Devvit upload system.

### Retention windows

- non-approved verification records are retained for 45 days
- approved records use a sliding 180-day window under the current policy
- older approved records may retain their original legacy retention value
- audit logs are retained for 45 days unless purged sooner

Approved-record retention can be refreshed, but not more than once every 24 hours for the same record.

### Automatic jobs

A scheduled job runs daily to:

- validate approved users
- clean up deleted or suspended users
- remove expired history and audit entries
- maintain indexes

## Operational tips

- Test the full flow after changing flair configuration or denial reason labels.
- Keep denial labels stable once moderators are trained on them.
- Use `History` before reopening a denied case so you do not create duplicate active reviews.
- Record clear revocation reasons because that text is sent to the user.
- Use Peer Review notes for moderator-only coordination, not member-facing denial copy.
