# Moderator Guide

This page covers the day-to-day moderation workflow.

## Access rules

- Moderators need `Manage Users` to use the moderator panel.
- The panel opens from the verification hub post with `Open Moderator Panel`.
- The panel updates in realtime when actions happen. Unsaved review drafts are preserved across refreshes.

## Pending tab

Use `Pending` to review new requests.

If the list does not appear, save a valid value in `Flair template ID to set` under `Settings` first.

### What you can do

- filter by username
- filter by age with `All`, `<24h`, `24-72h`, and `>72h`
- inspect uploaded photos
- see whether a request is a reopened case or a resubmission
- lock or unlock a request
- approve a request
- deny a request
- cancel a reopened re-review

### Locking

- Click `Lock` before reviewing if you want to reserve the pending verification.
- A locked case shows who holds the lock.
- `Unlock` releases your lock.
- `Force Unlock` removes another moderator’s lock.
- Approval, denial, and re-review cancellation respect the current lock owner.

### Approving

Approving a pending request:

- applies the configured flair
- marks the record approved
- removes the request from `Pending`
- sends approval modmail
- writes a moderator note
- adds history and audit entries

If flair application fails, approval does not complete.

### Denying

For a normal pending request:

- select a denial reason
- optionally add moderator notes
- click `Deny`

Denial notes appear in moderator notes and can also be inserted into denial templates with `{{reason}}`.

After 3 denials, the app automatically blocks that user from submitting again until a moderator removes the block.

### Re-review

- Reopened denied cases show `Reopened` in the pending card.
- Re-review cases can be approved or canceled.
- Re-review cases do not use the standard denial flow from the pending card.

## Blocked tab

Use `Blocked` to manage accounts that cannot submit.

- `Block User` adds a manual block.
- `Remove Block` restores the user’s ability to submit.
- Search can match username or block reason.
- Auto-blocked users show their denial count and the reason `Reached 3 denials`.

## History tab

`History` has three views.

### Records

Use this view to search past verification records by:

- username prefix
- submitted date range

This view is where moderators can reopen denied cases when the original photos are still available.

### Approved

Use this view to find approved users and revoke verification.

Revoking verification:

- requires a reason
- removes flair
- marks the record as removed
- sends revocation modmail
- adds an audit entry

### Audit

Use this view to search moderator actions by:

- username prefix
- actor
- action type
- action date range

Available action filters are `Approved`, `Denied`, `Reopened`, `Removed`, `Blocked`, and `Unblocked`.

## Moderator menu actions

Outside the panel, moderators also get these app menu actions:

- `Create Verification Hub (VouchX)`: create the NSFW verification post
- `Purge Audit Log`: delete audit entries older than the configured install-setting window, or all entries if the value is `0`
- `Remove Verification Hub Post`: remove the current app-created verification post
