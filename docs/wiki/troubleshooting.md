# Troubleshooting

This page collects common issues, operational limits, and retention behavior.

## Common setup issues

### `Mod Panel` is missing

The current account probably does not have `Manage Users` in that subreddit.

### Queue requests do not appear

Check `Settings -> General` and confirm `Flair template ID` is saved. VouchX hides queue review cards until this field is configured.

### Saving verification settings fails

The flair template ID must be non-empty and match a Reddit-style template ID format.

### Deny is unavailable or fails

Check both conditions:

- at least one denial reason label is enabled in install settings
- a denial reason is selected in the pending card before clicking `Deny`

### Reopen fails

A denied case can only be reopened when:

- the record is still denied
- the original photos are still available
- the user does not already have another pending request

If photos are unavailable, the user must submit again.

## Common member states

### User is blocked

A block stops new submissions. If the user is still showing as verified, check whether their verification flair has already been removed. A block can be:

- automatic after 3 denials
- manual from the `Blocked` tab

### User says they are verified but status is wrong

VouchX determines verified status from live flair detection. It checks the configured flair template ID and can also fall back to the optional CSS substring matcher.

### User wants to remove their data

Members can:

- withdraw a pending request
- remove their own verification after approval

These actions remove stored verification data and related audit entries for that user in the current subreddit workflow.

## Audit and history behavior

### Audit purge does nothing

The moderator menu action respects the install setting `Purge Audit Log days`.

- `0` purges all audit entries
- any other value only purges entries older than that threshold

### Why a denied record shows `Reopened: Yes (cancelled)`

A moderator reopened the denied case and later canceled the re-review instead of completing it.

## Retention and cleanup

### What the app stores

VouchX stores:

- verification records
- pending, approved, and history indexes
- audit log entries
- blocked-user entries and denial counters
- subreddit configuration
- validation tracking data

The app does not store uploaded image files directly. It stores the media URLs returned by the Devvit upload system.

### Retention windows

- non-approved verification records are retained for 45 days
- approved records use a sliding 45-day window
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
