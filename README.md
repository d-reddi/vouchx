# VouchX

VouchX is a photo verification app for Reddit communities. It gives your subreddit a member-facing Verification Hub where users submit photos, and it gives moderators a built-in review panel for approving, denying, tracking, and maintaining verification records.

The app provides:

- Inline verification hub post
- Moderator review queue with claim locking
- Automated modmail templates
- Verification flair integration
- Audit history and retention controls
- Customizable themes and messaging
- Automatic cleanup and validation jobs 

---

## Screenshots and workflow demos: 
[https://www.reddit.com/r/vouchx/wiki/demo/](https://www.reddit.com/r/vouchx/wiki/demo/)

## Full Setup, Features, Documentation & Help:
[https://www.reddit.com/r/vouchx/wiki/guide/](https://www.reddit.com/r/vouchx/wiki/guide/)


---

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

## Stats

View app stats like total approved, denied, etc. 

## Permissions

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

### Update notices

When a newer VouchX release is configured, moderators using the panel can see an update notice.

- standard notices can be dismissed for 7 days
- critical notices reappear until the app is updated
- moderators without full permissions can still see the notice, but they are told to ask a moderator with full permissions to update VouchX

---

# Data Retention

## Verification Records

Non-approved verification records are retained for **45 days**.

Approved records use a **sliding 90-day retention window**.

Approved records store a `lastTtlBumpAt` timestamp, and retention may be refreshed when verified users interact with the app.

Retention bumps are rate-limited to **once every 24 hours per record**.

## Audit Logs

Audit entries are retained for **45 days**.

Moderators may purge audit entries earlier using the moderator menu action.

---

# Cleanup Jobs

A daily scheduled job performs:

- approved user validation
- cleanup of deleted or suspended users
- scanning of expired history records
- removal of expired audit entries
- index maintenance

---

# User-Initiated Removal

Users may:

- withdraw pending submissions
- remove their own verification

These actions delete the user’s verification records and associated audit entries.

---

# Changelog 

Full Changelog available at: [https://www.reddit.com/r/vouchx/wiki/changelog/](https://www.reddit.com/r/vouchx/wiki/changelog/)

## v 1.3.3

New Features
- Multiple approval flairs (optional — enable in install settings)
- Banned member indicator in pending queue
- Automatically unban users on approval (useful for banned pending verifications)
- Block user option on denial
- Total karma added to "Stats" popup
- Stats page shows totals for each status, and total current verified users.

Fixes & Improvements
- Bumped user retention to 90 days to allow time-away from sub before removing from "verified records".
- Improved Modmail handling reliability
- Improved flair handling
- Improved Mod UI refresh rules
- Fixed error when approving deleted users
- Improved contrast for young account badge
- Backend console: more graceful failure handling