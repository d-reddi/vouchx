# VouchX

**A moderator-reviewed photo verification system for Reddit communities.**

VouchX provides a structured system for managing photo verification submissions inside Reddit.

Members submit photos for moderator review, and moderators manage approvals through a centralized moderation panel.

The app provides:

- Inline verification hub post
- Moderator review queue with claim locking
- Automated modmail templates
- Verification flair integration
- Audit history and retention controls
- Customizable themes and messaging
- Automatic cleanup and validation jobs

---

**Screenshots and workflow demos:**  
https://www.reddit.com/r/vouchx/wiki/demo/

## Setup, Documentation & Help
https://www.reddit.com/r/vouchx/wiki/guide/


---

# Member Experience

Members interact with verification directly inside the verification hub post.

Users can:

- submit photos for moderator review
- review photo instructions before submitting
- resubmit verification if denied (moderators see "resubmitted" on the pending card if the user is resubmitting)
- withdraw a pending request
- remove their own verification if they choose

The verification hub automatically refreshes while open so members can see status updates.

Possible status messages include:

- Verified
- Verified (Manual)
- Pending review
- Pending re-review
- Blocked
- Not verified
- Denied

If submissions are disabled, users will see the configured disabled message.

---

# Moderator Experience

Moderators manage submissions through an expanded moderator panel. If a verification is pending, a red bubble appears at the top right of the hub UI.

The moderator panel includes:

- **Queue** — submissions awaiting review
- **History** — records, approved users, and audit activity
- **Blocked** — users prevented from submitting
- **Settings** — general verification settings, templates, and themes

Pending submissions support **claim locking**, ensuring multiple moderators do not act on the same request simultaneously.

Denied submissions can be reopened for additional review.

Users may be automatically blocked after repeated denials.

---

# Quick Setup (Moderator)

Getting started takes less than a minute.
A built in onboarding walks through the process. 

1. Install **VouchX** in your subreddit.
2. Use the moderator menu action **Create Verification Hub (NSFW)**.
3. Open the created post.
4. Click **Mod Panel**.
5. Configure verification settings:

- enable or disable submissions
- set the verification flair template ID (On desktop: in Mod Tools, go to Look & Feel > User Flair, hover over the flair, click Copy ID, then paste it into the verification flair template field.)
- choose required photo count
- configure photo instructions

Once saved, users can begin submitting verification requests.

---

# Moderator Menu Actions

VouchX adds several tools to the subreddit moderator menu.

### Create Verification Hub (NSFW)

Creates a new verification hub post.

### Purge Audit Log

Removes audit log entries older than the configured retention window.

### Remove Verification Hub Post

Removes a verification post created by the app.

---

# Verification Flair Behavior

When a submission is approved, the configured verification flair is applied.

Verification status is determined using live subreddit flair detection rather than relying solely on stored records.

The app checks:

- flair template ID
- optional flair CSS substring matcher
- fallback flair text matching when necessary

The app also performs flair reconciliation for approved users when a stored flair appears outdated compared to the currently configured template.

Manual or unrelated flair is not overwritten simply because a verification record exists.

---

# Configuration Model

Settings are stored **per subreddit installation**.

## Install Settings

Install settings control general verification behavior.

Current settings include:

- Purge Audit Log days
- Verifications disabled message
- Denial Reason 1 Label
- Denial Reason 2 Label
- Denial Reason 3 Label
- Denial Reason 4 Label

Denial reason labels are display names only.

Leaving a denial label blank hides that reason in the moderator interface.

---

## Moderator Panel Settings

### Settings > General

Moderators can configure:

- enable or disable submissions
- verification flair template ID
- optional flair CSS matcher (substring match against live flair CSS classes)
- required photo count
- photo instructions (Markdown shown when the user presses `Photo Instructions`)
- estimated storage usage

### Settings > Templates

Automated messaging templates include:

- pending notification
- approval messages
- denial messages
- revoked verification messages

Templates are customizable per subreddit.

### Settings > Themes

Interface appearance can be customized using:

- preset themes
- custom primary color
- accent color
- background color

---

# Template Placeholders

Templates support dynamic placeholders.

### Photo Instructions

Supported placeholders:

- `{{subreddit}}`
- `{{days}}`

### Modmail Templates

Supported placeholders:

- `{{username}}`
- `{{mod}}`
- `{{subreddit}}`
- `{{date submitted}}`
- `{{days}}`

Denial body templates also support:

- `{{denial_notes}}`

`{{denial_notes}}` renders moderator-entered denial notes as `Moderator Notes: ...` when notes are present. The
legacy `{{reason}}` denial placeholder is still accepted as a temporary compatibility alias.

Example '{{days}}' rendering:

```
3 days
```

---

# Submission Flow

When a user submits photos:

1. The user opens the submission acknowledgement modal.
2. The user confirms the submission statements.
3. The Devvit image upload form opens.
4. The app stores the returned media URLs on the verification record.
5. A pending modmail notification is sent.
6. A submission mod note is written.
7. The submission appears in the moderator queue.

The acknowledgement timestamp is recorded for audit purposes.

---

# Review Flow

## Approve

Approval performs the following actions:

- applies verification flair
- sends approval modmail
- writes an approval moderator note
- moves the record into the approved index
- schedules validation tracking

## Deny

Denial performs the following actions:

- stores the denial reason and moderator notes
- sends denial modmail using the configured template and optional `{{denial_notes}}` placeholder
- writes a moderator note
- retains the record in history
- may trigger automatic blocking after repeated denials

## Revoke Verification

Revoking verification performs the following actions:

- removes the approved record
- attempts to remove flair
- sends revoked verification modmail
- writes a moderator note

---

# Realtime Updates

The moderator panel subscribes to a **subreddit-scoped realtime channel**.

Realtime messages contain **no user data**.  
They only signal the client to refresh.

This allows moderation queues to update instantly when actions occur.

Unsaved moderator drafts are preserved across refresh events.

The user verification hub automatically refreshes every **2 minutes** while open.

---

# Data Stored

The app stores only the information required to operate the verification workflow.

Stored data includes:

- verification records
- pending, approved, and history indexes
- audit log entries
- per-user latest and pending pointers
- blocked users and denial counters
- subreddit configuration
- validation tracking indexes

The app also writes Reddit moderation artifacts such as **modmail messages** and **moderator notes**.

The app **does not store image files**.  
It stores only media URLs returned by the Devvit image upload system.

---

# Data Retention

## Verification Records

Non-approved verification records are retained for **45 days**.

Approved records use a **sliding 45-day retention window**.

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

## v1.2.1

- Account age now shown on pending queue cards
- New Stats button showing subreddit karma, previous denials, and ban status
- Clearer color-coded status badges and improved action instructions
- Install setting to restrict Settings tab to mods with config/everything permissions
- Install setting to require viewing photo instructions before submission
- Optional submission limits (block after X submissions or disable resubmits)
- Main verification hub now updates live when status changes
- Improved mod note handling
- Simpler first-time setup flow
- Flair Template ID verification before save
- Android fix for photo instructions scrolling
- Performance improvements for moderators and users
- Report a Bug / Request a Feature link added to the mod panel
- How to Use This App link added to the hub
- Clearer status instructions for users
- Notifications for updates, and critical update messages

## v1.1.2

- critical fix: initialize the daily retention / validation scheduler from live dashboard loads so subreddit installs do not miss scheduled cleanup
- refine the moderator panel into a cleaner dark dashboard layout with better mobile workflow and queue prioritization
- fix stale moderator history / approved / audit views after moderation actions
- fix history, approved, and audit search consistency after approve, deny, remove, and reopen flows
- fix history search date-window and pagination behavior so records do not disappear or duplicate after search
- refresh the verification hub after stale withdraw attempts when the pending request has already been resolved
- update the optional flair CSS matcher to use substring matching

## v1.0.10

- initial public Reddit release
