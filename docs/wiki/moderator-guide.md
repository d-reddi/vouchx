# Moderator Guide

This page covers the day-to-day moderation workflow.

## Access rules

- Moderators need `Manage Users` to use the moderator panel.
- The panel opens from the verification hub post with `Mod Panel`.
- The panel updates in realtime when actions happen. Unsaved review drafts are preserved across refreshes.
- The setup guide appears until required setup is complete. After setup, each moderator gets a one-time panel tour. New feature walkthroughs can appear later and can be replayed from the panel footer.
- If the subreddit restricts Settings access, reviewers can still use the queue, history, blocked users, and stats, but cannot edit settings.

## Queue tab

Use `Queue` to review new requests.

If the list does not appear, save a valid approval flair under `Settings -> General` first.

### What you can do

- filter by username
- filter by age with `All`, `<24h`, `24-72h`, and `>72h`
- filter to only Peer Review requests
- inspect uploaded photos
- swipe through enlarged photos on supported devices
- open `Stats` for a pending account snapshot
- see whether a request is a reopened case or a resubmission
- open `Denied before` / `Denied xN` badges for the latest previous-denial details
- lock or unlock a request
- select multiple eligible requests and approve or deny them in bulk
- ask for Peer Review and add moderator-only Peer Review notes
- approve a request
- deny a request
- cancel a reopened re-review

### Locking

- Click `Lock` before reviewing if you want to reserve the pending verification.
- A locked case shows who holds the lock.
- `Unlock` releases your lock.
- `Force Unlock` removes another moderator’s lock.
- Approval, denial, and re-review cancellation respect the current lock owner.
- A request in Peer Review hides the normal lock controls. Peer Review is not a lock; any moderator who can normally act may approve, deny, add notes, or cancel Peer Review unless the request is locked by another moderator.

### Peer Review

Use `Peer Review` when a request needs a second opinion.

- Peer Review requests jump to the top of the queue.
- When multiple requests are in Peer Review, the oldest Peer Review request appears first.
- Moderators can add short internal notes while the request remains in Peer Review.
- `Cancel Peer Review` clears the marker and its note thread.
- Approving, denying, or removing the pending request clears Peer Review automatically.

Peer Review is only for pending moderation coordination. It is not visible to the member and does not block normal review decisions.

### Approving

Approving a pending request:

- applies the configured approval flair, or the selected approval flair when multiple approval flairs are enabled
- marks the record approved
- removes the request from `Queue`
- sends approval modmail
- writes a moderator note
- adds history and audit entries

If flair application fails, approval does not complete.

### Denying

For a normal pending request:

- select a denial reason
- optionally add moderator notes
- optionally tick `Block user`
- click `Confirm denial`

Denial notes appear in moderator notes and can also be inserted into denial templates with `{{denial_notes}}`. 

By default, after 3 denials, the app automatically blocks that user from submitting again until a moderator removes the block. The threshold is configurable in install settings and can be disabled by setting it to `0`.

If `Auto-deny shadowbanned accounts` is enabled, Reddit-reported shadowbanned accounts are denied automatically when they submit. These denials are logged and use the shadowban appeal message, but they do not increment the denial-count auto-block threshold.

### Batch review

Use the checkboxes on queue cards to select multiple requests.

- Batch approval requires at least two selected requests.
- Reopened re-review requests are excluded from batch denial.

### Re-review

- Reopened denied cases show `Reopened` in the pending card.
- Re-review cases can be approved or canceled.
- Re-review cases do not use the standard denial flow from the pending card.
- Use `Keep Denied` to cancel a reopened re-review and leave the original denial in place.

## Blocked tab

Use `Blocked` to manage accounts that cannot submit.

- `Block User` adds a manual block.
- `Remove Block` restores the user’s ability to submit.
- Search can match username or block reason.
- Auto-blocked users show their denial count and the threshold reason.

## History tab

`History` has three views.

### Records

Use this view to search past verification records by:

- username prefix
- status (`All`, `Approved`, `Denied`, `Reopened`)
- submitted date range

This view is where moderators can reopen denied cases when the original photos are still available, default summary is `Last 45 days`..

### Verified Users

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

## Stats tab

Use `Stats` to review team activity.

- `Currently Verified` counts users who are approved right now.
- Approval, denial, reopen, and active-moderator counts come from audit entries in the selected range.
- `90% Decided Within` shows P90 decision time using timed approve/deny audit entries. The app shows `Not enough data yet` until there are at least 10 timed decisions.
- Denial reasons are counted from newer denial audit metadata. Older entries without reason metadata are excluded from the reason breakdown.
- Per-moderator rows show approvals, denials, reopens, and total actions in the selected range.

## Moderator menu actions

Outside the panel, moderators also get these app menu actions:

- `Create Verification Hub (VouchX)`: create the NSFW verification post
- `Purge Audit Log`: delete audit entries older than the configured install-setting window, or all entries if the value is `0`
- `Remove Verification Hub Post`: remove the current app-created verification post
