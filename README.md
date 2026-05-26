# VouchX

VouchX is a photo verification app for Reddit communities.  

It gives your subreddit a **Verification Hub for submissions** and a **moderator panel to review and manage approvals**.

---

## What VouchX Provides

- Verification Hub for user submissions  
- Moderator review queue with claim locking  
- Automated modmail templates  
- Verification flair integration  
- Audit history and retention controls  
- Customizable messaging and themes  
- Automatic cleanup and validation  

---

## Documentation & Help

Full setup guides and advanced configuration:  
[https://www.reddit.com/r/vouchx/wiki/guide/](https://www.reddit.com/r/vouchx/wiki/guide/)

Workflow demos:  
[https://www.reddit.com/r/vouchx](https://www.reddit.com/r/vouchx/)

---

## Quick Setup

1. Install VouchX in your subreddit  
2. Run **Create Verification Hub (VouchX)** from the mod menu  
3. Open the hub post → click **Mod Panel**  
4. In **Settings > General**, set your primary approval flair (**required**)  
5. Configure:
   - Submissions on/off  
   - Photo requirements  (Optional Translation for ES, FR)
   - Instructions  
6. (Optional) Customize modmail templates  

**You’re ready to start reviewing submissions.**

---

## How It Works

### Members
- Submit photos through the Verification Hub  
- Requests enter the moderator queue  
- Receive updates via modmail  
- Can resubmit or remove their verification  

### Moderators
- Review submissions in the Queue  
- **Approve** → applies flair, sends modmail, stores record  
- **Deny** → choose reason, add notes, optionally block  

---

## Stats

Track moderator activity and verification volume.

- **Currently Verified** = users approved right now  
- **Approvals / Denials** = actions during the selected time range  

*Note: Counts may change due to removals, expirations, or cleanup.*

---

## Permissions

- **Manage Users** is required for queue access  
- Settings can be restricted to config-level moderators  
- Only full-permission mods can update the app or access install settings  

---

## Data & Retention

- Pending / denied records: **45 days**  
- Approved users: **90-day rolling retention**  
- Audit logs: **45 days**  

Data may also be removed earlier in the following cases:
- Users delete their account  
- Users remove their own verification  
- Moderators purge records  

### Automatic Cleanup

VouchX automatically cleans up stale or invalid data on a regular basis.

This includes:
- Removing expired verification records  
- Cleaning up deleted or suspended accounts  
- Removing expired audit entries  
- Maintaining accurate verification status  

These background processes help ensure data is kept up to date and not retained longer than necessary.

---

## Changelog

Full changelog:  
[https://www.reddit.com/r/vouchx/wiki/changelog/](https://www.reddit.com/r/vouchx/wiki/changelog/)


### v1.4.1

#### New Features

- Photo Instructions now support multiple languages: English, Spanish, and French, Configured in **Mod Panel > Photo Instructions**
- History & Audit records now include links to view submitted photos for approved verifications
- Added batch queue actions for moderators
- Added a user scoring system that assigns an advisory grade — Spam Risk, Limited History, Standard, or Established — to each pending verification, shown as a badge on the queue card. Grades are derived from account signals, with a per-signal breakdown available in the account details "stats" on the pending car
- Added a Content Creator badge that flags pending submissions whose Reddit profile links to a known content-creator platform (informational only; does not affect the grade)
- Added an optional setting to automatically deny submissions from shadowbanned accounts, Configurable in Install Settings (off by default). 
- Added optional auto-archive support for pending-user modmail replies, Configurable in **Install Settings**
- Added Markdown helper controls and placeholder insertion menus to:
  - Photo Instructions
    - Added `{{username}}` placeholder to display the viewing user as `u/username`
    - Added Android-specific “scroll down” pill message to help users find the full instructions
    - Added “Caps” helper button to transform selected text to ALL CAPS
  - Modmail template inputs

#### Back-End / Technical Changes

- Improved performance for flair and moderator lookups
- Updated to Devvit 0.12.24
- Added global blocklist support
- Corrected verified-record retention behavior so the intended ninety (90) day retention window is now applied

---

### v1.3.9

Critical Fix: resolves occasional mod lookup breaking behavior

Updates/Performance Improvements:
- Block on denial faster repsponse time
- Adding the Verification hub now auto pins the post
- Additional Tooltips added for user guidence
- Updated to devvit 0.12.17