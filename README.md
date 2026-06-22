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

Follow the onboarding wizard that runs through the steps below:

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
- Approved users: **180-day rolling retention**  
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


### v1.5.6

#### New Features
- Added a Denial tag to queue cards. Tap it to view the most recent denial details.
- Added Peer Review, allowing moderators to flag a submission for a second opinion. Moderators can exchange review comments that are visible only to the moderation team.
- Added Block Notes support.
- Added new statistics:
  - Average approval time tracking
  - Denials by reason

#### Improvements
- When a submission contains multiple photos, you can now swipe left or right while viewing an enlarged image to move between photos.
- Removed Terms Accepted and Age Confirmed timestamps from queue cards to reduce clutter. This information is still retained internally for auditing and tracking purposes.
- Improved Android photo instructions behavior.
- Fixed wizard completion behavior, added exit button to prevent loops and added support for new features in wizard.
- Search behavior for audit records improved for subs with larger history
- Renamed Approved Records to "Verified Users"

---

### v1.5.3

#### Critical Fix:
- Fixes a Cron job name mismatch that prevented the nightly user validation reconcile job from running.

#### Other Changes:

- Fixes an issue where the auto flair repair could silently skip approved users verified before VouchX v1.3.0
- TTL for newly approved records extended to 180 days to better support members who browse infrequently. Records for previously approved users are unaffected.
- New Setup and Moderator onboarding wizard. 

---

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

