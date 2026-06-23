# VouchX

VouchX is a moderator-reviewed photo verification app for Reddit communities.

It gives your subreddit a dedicated **Verification Hub** for member submissions and a private **moderator panel** for reviewing requests, applying flair, managing records, and tracking activity.

---

## What VouchX Provides

- Photo verification submissions through a dedicated hub
- Moderator review queue with locking, filtering, and Peer Review
- Approval and denial workflows with automated modmail
- Verification flair integration
- Verification history, audit records, and blocked-user management
- Custom photo instructions, templates, translations, and themes
- Moderator statistics and automatic data cleanup

---

## Documentation and Help

Full setup guides, moderator instructions, and configuration details:

[https://www.reddit.com/r/vouchx/wiki/guide/](https://www.reddit.com/r/vouchx/wiki/guide/)

Demo:

[https://www.reddit.com/r/vouchx](https://www.reddit.com/r/vouchx/)

---

## Quick Setup

VouchX includes a guided setup wizard and a one-time moderator panel tour.

1. Install VouchX and review the app install settings.
2. Open your subreddit, select the three-dot menu (`...`) at the top of the page, and choose **Create Verification Hub (VouchX)**.
3. Open the new Verification Hub post and select **Mod Panel**.

The setup wizard will guide you through the remaining required settings.

To configure VouchX manually instead:

4. Open **Settings > General** and select the approval flair VouchX should apply. A valid approval flair is required before requests can be reviewed.
5. Configure:
   - Whether verification submissions are enabled
   - The number of required photos
   - Your community’s photo instructions
   - Optional Spanish, French, and Portuguese (Brazil) translations
   - Optional posting or commenting unlock messaging, if your community enforces those requirements separately
6. Review and customize the modmail templates.
7. Test the complete submission and review process using a non-moderator account.

Once setup is complete, your community can begin accepting verification requests.

---

## How It Works

### Members

Members can:

- Open the community’s Verification Hub
- Review the community’s photo requirements
- Submit the required number of photos
- Track the status of a pending request
- Withdraw a request before it is reviewed
- Submit again after a denial unless they are blocked
- Remove their own verification after approval

### Moderators

Moderators can:

- Review pending requests from the queue
- Inspect and swipe between submitted photos
- View previous-denial information
- Lock a request while reviewing it
- Request Peer Review and exchange moderator-only notes
- Approve a request and apply the configured verification flair
- Deny a request using a configured reason and optional notes
- Approve or deny multiple eligible requests at once
- Block members from submitting new verification requests
- Search verification history and moderator actions
- Reopen eligible denied requests for another review
- Revoke an existing verification

Approval and denial actions can automatically send modmail, create moderator notes, and add history and audit records.

---

## Moderator Statistics

VouchX provides statistics for the selected date range, including:

- **Currently Verified** members
- Approvals and denials
- Reopened requests
- Active moderators
- Per-moderator activity
- **90% Decided Within** decision-time reporting
- Denial-reason breakdowns

Some statistics rely on newer audit metadata and may not include older records.

Counts may also change when members remove verification, records expire, accounts are deleted, or automatic cleanup occurs.

---

## Permissions

- Moderators need Reddit’s **Manage Users** permission to open and use the moderator panel.
- Communities can limit the panel’s **Settings** tab to moderators with configuration-level access.
- App install settings and app updates are available only to moderators with the required Reddit installation or configuration permissions.
- Moderators without Settings access can still use permitted areas such as the queue, history, blocked users, and statistics.

---

## Data and Retention

VouchX stores the records needed to operate the verification workflow, including verification status, review history, audit activity, blocked-user records, and subreddit configuration.

VouchX does not directly store copies of uploaded image files. It stores the media URLs returned by Reddit’s Devvit upload system.

Current retention periods include:

- Pending, denied, removed, and other non-approved verification records: **45 days**
- Approved verification records: **rolling 180-day retention**
- Audit records: **45 days**, unless purged sooner

Data may be removed sooner when:

- A member withdraws a pending request
- A member removes their own verification
- A member deletes their Reddit account
- Reddit reports an account as deleted or suspended
- A moderator uses an available purge action
- A record becomes invalid or reaches the end of its retention period

### Automatic Maintenance

VouchX runs regular maintenance to:

- Validate approved users
- Repair missing verification flair when enabled
- Clean up records for deleted or suspended accounts
- Remove expired verification and audit records
- Maintain the indexes used by the moderator panel

These processes help keep verification status accurate and prevent records from being retained longer than necessary.

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

