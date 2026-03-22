# VouchX

VouchX is a photo verification app for Reddit communities. It gives your subreddit a member-facing Verification Hub where users submit photos, and it gives moderators a built-in review panel for approving, denying, tracking, and maintaining verification records.

This README is written for subreddit moderators and admins who are setting up or running VouchX.

## What VouchX Does

### For members

- Submit 1, 2, or 3 verification photos, depending on your setup.
- Read photo requirements before submitting, if you enable that option.
- See their current status in the hub: pending, verified, denied, removed, or blocked.
- Withdraw a pending request.
- Resubmit after a denial or after verification is removed.
- Remove their own verification later, which removes their verification flair and stored verification data.

### For moderators

- Review a queue of pending submissions.
- Lock a request while you work it.
- Approve with a verification flair.
- Optionally choose from multiple approval flairs on each approval.
- Deny with a reason template and optional moderator notes.
- Block or unblock users from submitting.
- Reopen denied cases for another review when the original photos are still available.
- Revoke an approved verification later with a reason.
- Search approved users, verification records, blocked users, and the audit trail.
- View helpful account details on pending requests, including account age, subreddit karma, overall karma, previous denied attempts, and banned-user indicators.

## Before You Start

- Moderators need `Manage Users` permission to review requests or use the moderator panel.
- The `Settings` tab can optionally be limited to moderators with config/settings access.
- Opening subreddit install settings from inside VouchX requires a moderator with full permissions.
- Updating VouchX from an in-app update notice also requires a moderator with full permissions.

## Quick Setup

1. Install VouchX in your subreddit.
2. From the subreddit moderator menu, run `Create Verification Hub (VouchX)`.
   - VouchX creates the hub post and marks it NSFW.
3. Open the hub post and click `Mod Panel`.
4. In `Settings > General`, save your primary approval flair.
   - This is the required first step. Until a primary approval flair is saved, the hub will show `Setup required` and approvals stay blocked.
5. Still in `Settings > General`, choose:
   - whether submissions are enabled
   - how many photos are required
   - your photo instructions
   - optional extra approval flairs, if you have enabled that install setting
6. In your subreddit install settings, review the subreddit-wide options such as denial reasons, auto-blocking, and auto flair repair.
7. In `Settings > Templates`, customize the modmail messages VouchX sends.
8. In `Settings > Themes`, optionally change the member-facing hub colors.

## Install Settings vs VouchX Panel Settings

### Subreddit install settings

These are subreddit-wide controls in Reddit's app install settings for VouchX:

- `Verifications disabled message`
  - The message members see when submissions are turned off.
- `Max denials before auto-block`
  - Automatically blocks users from submitting again after they reach the chosen number of denials.
- `Automatically repair verification flair`
  - When enabled, VouchX checks approved users when they open the hub, up to once every 24 hours, and can restore a missing or changed verification flair.
- `Enable multiple approval flairs`
  - Lets you configure a second and third approval flair and choose one per approval in the queue.
- `Show photo instructions before verification submission`
  - Shows your saved photo instructions before the upload form opens.
- `Restrict Settings tab to mods with config/settings access`
  - Limits the VouchX `Settings` tab without changing queue access.
- `Purge audit log data older than (days)`
  - Used by the `Purge Audit Log` moderator menu action.
- `Denial reason labels`
  - These labels control which denial reasons are available in the queue and in template settings.
  - Leave a label blank to hide that denial reason entirely.

### VouchX panel settings

These are the settings you manage inside `Mod Panel > Settings`:

- submissions on/off
- primary approval flair
- optional flair template ID manual entry
- optional flair CSS substring match
- optional second and third approval flairs
- required photo count
- photo instructions
- pending, approval, denial, and revocation modmail templates
- denial note handling
- hub theme preset and custom colors

## Setting Up Flair

VouchX is not ready until the primary approval flair is saved.

### Recommended setup

Use the flair picker in `Settings > General` and choose the flair that should be applied to approved users.

- The picker shows mod-only user flairs.
- This is the easiest setup and should be your default choice.

### If your flair is not listed

Use `Manual Input` and paste the flair template ID.

- This is useful when the flair is not mod-only or does not appear in the picker.
- Approvals stay blocked if the saved primary flair template is invalid.

### Optional flair matching fallback

You can also set a flair CSS substring.

- This is mainly for subreddits that need VouchX to recognize a valid verification flair even when the exact template ID is not enough.
- VouchX still prefers template ID matching first.

### Multiple approval flairs

If `Enable multiple approval flairs` is turned on in install settings:

- you can save a second and third approval flair in `Settings > General`
- moderators can choose which saved flair to apply on each approval
- approved users keep working as verified with any of those saved approval flairs

## Member Flow

From the member's point of view, the Verification Hub works like this:

1. They open the hub post.
2. They review your photo requirements.
3. Before uploading, they must confirm:
   - they are at least 18
   - the photos are of themselves
   - they accept the VouchX Terms and Conditions
4. They upload the required number of photos.
5. VouchX places the request in the moderator queue and sends the pending-review modmail template.

Members can also:

- withdraw a pending request
- see when a request is denied or removed
- resubmit later
- remove their own verification, which removes their flair and stored verification data

## Moderator Workflow

### Queue

The `Queue` tab is where moderators review pending requests.

Available tools include:

- username filter
- queue age filters (`under 24h`, `24-72h`, `over 72h`)
- lock/unlock controls so one moderator can claim a request
- a `Stats` popup for pending users
- badges for resubmissions and currently banned users

Each pending request shows:

- the submitted photos
- submission time
- account age
- acknowledgement timestamps
- account snapshot details, including subreddit karma, overall karma, and previous denied attempts

### Approving a request

When a moderator approves a request, VouchX:

- applies the selected approval flair
- marks the request approved
- sends the approval modmail template
- writes a mod note
- stores the record in history

If the user is currently banned from the subreddit:

- VouchX shows a confirmation prompt
- on confirmation, it unbans the user first and then completes the approval

If the request was reopened from a previous denial and the user had been blocked:

- VouchX attempts to remove that submission block automatically on approval

### Denying a request

To deny a request, a moderator must choose one of the enabled denial reasons.

Moderators can also add optional denial notes. Those notes are:

- saved with the record
- written to mod notes
- available in denial modmail through `{{denial_notes}}`
- optionally forced into denial modmail with the `Always include moderator denial notes` setting

Moderators can also block the user at denial time.

Separately, VouchX can auto-block users after repeated denials if you set a denial threshold in install settings.

### Reopening a denied request

Moderators can reopen a denied case from `History > Records` when the original photos are still available.

That moves the request back into the queue as a re-review case.

### Revoking an approved verification

From `History > Approved`, moderators can revoke an approved verification.

VouchX requires a reason, then:

- removes the user's verification flair
- marks the record as removed
- sends the revocation modmail template
- keeps the action in history and audit data

## History, Blocked Users, and Audit Trail

### History > Approved

Search approved members by username and date range, and revoke approved verifications when needed.

### History > Records

Search verification records across pending, approved, denied, and removed entries.

This is also where moderators can reopen denied requests for another review.

### History > Audit

Search the moderator action log by:

- user
- moderator
- date range
- action type

Tracked actions include:

- approved
- denied
- reopened
- removed
- blocked
- unblocked

### Blocked

The `Blocked` tab shows:

- users blocked manually
- users auto-blocked after repeated denials
- the reason for the block
- the denial count, when applicable

Moderators can also manually block a user or remove a block from this tab.

## Modmail Templates

VouchX can send modmail for:

- pending review
- approval
- denial
- revoked verification

VouchX tries to reply in an existing modmail thread for that user when possible. If there is no usable thread, it creates a new one.

### Template placeholders

The template editor supports these placeholders:

- `{{username}}`
- `{{mod}}`
- `{{subreddit}}`
- `{{date submitted}}`
- `{{days}}`

Denial templates also support:

- `{{denial_notes}}`

`{{days}}` already includes the unit, such as `3 days`.

## Flair Repair and Verification Detection

VouchX mainly identifies verified users by approval flair.

In plain terms:

- template ID is the main check
- optional CSS substring matching can also count as verified
- if Reddit does not return a flair template ID, VouchX can fall back to the saved flair text

If automatic flair repair is enabled:

- VouchX checks an approved user when they open the hub
- it runs at most once every 24 hours per approved user
- if the verification flair is missing or changed, VouchX tries to restore it
- if the user's current flair still matches your saved CSS substring rule, VouchX does not replace it

## Permissions

### Who can review

Moderators with `Manage Users` permission can:

- open the moderator panel
- review the queue
- approve
- deny
- reopen
- revoke
- block and unblock
- search records and audit history

### Who can change VouchX settings

If you enable `Restrict Settings tab to mods with config/settings access`, only moderators with config/settings access can use the `Settings` tab.

Queue access does not change.

### Who can open install settings or update the app

Only moderators with full permissions can:

- use the `Open install settings` link inside VouchX
- use the in-app `Update Now` action from moderator update notices

## Maintenance and Update Notices

### Moderator menu actions

VouchX adds moderator menu actions for:

- `Create Verification Hub (VouchX)`
- `Purge Audit Log`
- `Remove Verification Hub Post`

### Audit log purge

`Purge Audit Log` uses your install setting for audit retention days.

- set it to `0` to purge all audit entries
- otherwise, VouchX removes only entries older than the configured age

### Update notices

When a newer VouchX release is configured, moderators using the panel can see an update notice.

- standard notices can be dismissed for 7 days
- critical notices reappear until the app is updated
- moderators without full permissions can still see the notice, but they are told to ask a moderator with full permissions to update VouchX

## Important Notes

- If the hub says `Setup required`, save the primary approval flair in `Settings > General`.
- If the flair picker does not show the flair you want, use `Manual Input` and paste the template ID.
- Only denial reasons with labels in install settings appear in the queue and in denial template settings.
- If a user deletes their account or is suspended before review, VouchX removes the request from review instead of leaving a broken pending item behind.
- If submissions are turned off, members see the disabled message from install settings.
