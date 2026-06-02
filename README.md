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
   - Photo requirements  (Optional Translation for Spanish, French, Portuguese (Brazil) )
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


### v1.5.1

#### UI Changes

- Updated the Verification Hub with a more modern, easier-to-understand interface, including larger text, clearer timelines, and improved mobile spacing.
- Mod Panel UI overhaul: Queue cards now show multiple photos on mobile, card details are simplified, and actions are easier to scan.
- Denial flow improved: denial reason and moderator notes are shown after pressing Deny the first time, reducing clutter on queue cards.
- Settings experience streamlined with cleaner navigation, lighter section structure, unified theme styling, and improved template editing.
- Photo instructions are now optimized for mobile review, with improved language picker behavior and better use of available space.
- Added optional verification requirement setting for communicating sub-level posting / commenting restrictions.
- Updated VouchX branding with the new VX logo treatment for the hub, loading state, and app/profile icon.
- Improved the hub loading experience with a branded loading state for inline Reddit views.

#### Technical Changes

- Updated VouchX to Devvit 0.13.0 and the current Devvit Web app structure.
- Improved handling of transient Reddit/Devvit transport errors, including GOAWAY, cancelled calls, and retry-exhausted responses.
- Improved moderator permission lookup resilience with retry behavior before falling back to cached permissions.
- Updated queue lock TTL behavior.

---

### v1.4.4

#### New Features

- Photo Instructions now support English, Spanish, French, and Portuguese (Brazil), configurable in **Mod Panel → Photo Instructions** (translation required)
- History & Audit records now include links to submitted photos for approved verifications
- Added batch queue actions for moderators
- Added advisory user scoring badges for pending verifications (Spam Risk, Limited History, Standard, Established) based on account signals including overall & subreddit karma, previous denials, verified email, Reddit Premium, shadowban status, and recent activity. Individual signal results are available in the pending card **Stats** section to help moderators make informed decisions, configurable in Install Settings *(enabled by default)*
- Added Content Creator badge for users who may be adult content creators, configurable in Install Settings *(enabled by default)*
- Added optional automatic denial of shadowbanned accounts, configurable in Install Settings *(disabled by default)*
- Added optional auto-archive support for pending-user modmail replies, configurable in Install Settings *(enabled by default)*
- Added Markdown helper controls and placeholder insertion menus to photo instructions and modmail templates

#### Photo Instructions Improvements

- Added `{{username}}` placeholder support (`u/username`)
- Added Android-specific “scroll down” helper pill
- Added “Caps” helper button for ALL CAPS formatting

#### Mod Panel Improvements

- Desktop Mod Panel now supports expanded full-screen view

#### Back-End / Technical Changes

- Improved performance for flair and moderator lookups
- Updated to Devvit 0.12.24
- Added global blocklist support
- Corrected verified-record retention behavior so the intended ninety (90) day retention window is now applied