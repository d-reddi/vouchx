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

Onboarding wizard automatically runs through setup.  

Manual Steps:
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
- **Decision Time & Reason usage** = how long it takes to action verifications

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


### v1.5.8

#### New Features
- Added **Denied Before** and **Denied ×N** badges to queue cards. Select a badge to view details from previous denials.
- Added **Peer Review**, allowing moderators to request a second opinion and exchange moderator-only review comments.
- Added support for **Block Notes**.
- Added new moderator statistics:
  - **90% Decided Within** decision-time tracking
  - Denial breakdowns by reason

#### Improvements
- Submissions with multiple photos can now be browsed by swiping left or right in the enlarged image viewer.
- Removed **Terms Accepted** and **Age Confirmed** timestamps from queue cards to reduce clutter. This information remains stored for audit and tracking purposes.
- Improved the Android photo-instructions flow, including a confirmation prompt when instructions were reviewed recently.
- Improved wizard completion behavior, added an exit option to prevent navigation loops, and added support for introducing newly released features.
- Improved audit-record search performance for communities with larger histories.
- Renamed **Approved Records** to **Verified Users**.
- Fixed photo-instruction scrolling on iOS 27.

---

### v1.5.3

#### Critical Fix:
- Fixes a Cron job name mismatch that prevented the nightly user validation reconcile job from running.

#### Other Changes:

- Fixes an issue where the auto flair repair could silently skip approved users verified before VouchX v1.3.0
- TTL for newly approved records extended to 180 days to better support members who browse infrequently. Records for previously approved users are unaffected.
- New Setup and Moderator onboarding wizard. 

