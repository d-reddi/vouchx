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
[https://www.reddit.com/r/vouchx/wiki/demo/](https://www.reddit.com/r/vouchx/wiki/demo/)

---

## Quick Setup

1. Install VouchX in your subreddit  
2. Run **Create Verification Hub (VouchX)** from the mod menu  
3. Open the hub post → click **Mod Panel**  
4. In **Settings > General**, set your primary approval flair (**required**)  
5. Configure:
   - Submissions on/off  
   - Photo requirements  
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

### v1.3.9

Critical Fix: resolves occasional mod lookup breaking behavior

Updates/Performance Improvements:
- Block on denial faster repsponse time
- Adding the Verification hub now auto pins the post
- Additional Tooltips added for user guidence
- Updated to devvit 0.12.17

---

### v1.3.4

- Multiple approval flairs (optional — enable in Install Settings)
- Banned member indicator in the pending queue
- Automatically unban users on approval (useful for previously banned applicants)
- Option to block users directly on denial
- Total subreddit karma added to the "Stats" popup
- New Stats page with status totals and current verified user count
- Tooltips added across settings and templates for better guidance
- Initial Hub Create now pins app.
- Fixed error when approving deleted or suspended users
- Fixed potential moderator lookup issue affecting permissions
- Improved Modmail handling reliability
- Improved flair application and consistency
- Improved mod panel refresh behavior
- Improved contrast for the young account badge
- Increased user retention to 90 days to allow time away before removal from verified records (privacy policy updated)
- Backend: improved error handling and logging

---

### v1.2.1

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