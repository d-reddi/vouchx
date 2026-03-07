# NSFW Verify (Devvit)

NSFW Verify is a Reddit verification app for communities that need a moderator-reviewed photo verification process.
It now uses the current Devvit Web post model: an inline launch screen, an expanded verification hub entrypoint, and a web-backed moderator panel.

It includes:
- A Devvit Web verification post with an inline launch card and expanded hub
- A user-facing verification hub (submit, track status, withdraw pending, remove verification)
- A moderator panel (review queue, history, blocked users, settings, templates, themes)
- Flair + modmail automation
- Account validation checks for approved users
- Automatic data retention

## For Community Members

### What users can do
- Submit verification photos from the verification post
- Confirm they are 18+ before submitting
- Upload the number of required photos set by moderators (`1`, `2`, or `3`)
- See current status in the post:
- `Verified`
- `Pending review`
- `Pending re-review`
- `Not verified`
- Withdraw a pending submission
- Remove their own verification (self-removal)

### What users see when submission is unavailable
- If submissions are disabled by moderators:
- `Verifications are temporarily disabled. Please check back soon.`
- If the user is blocked:
- `You cannot submit a verification request.`

### What happens after submission
- Moderators review the submission
- User receives update modmail from the subreddit
- On approval, user flair is applied based on moderator settings

## For Moderators

### Getting started
- Create the verification post from subreddit menu:
- `Create Verification Hub (NSFW)`
- This creates a Devvit Web custom post that opens from an inline launch screen into the full verification hub
- Open moderator tools from the post:
- `Open Moderator Panel`
- Access is limited to moderators with Manage Users style permissions

### Moderator panel tabs

#### Pending
- Live filter by username
- SLA quick filters (`All`, `<24h`, `24-72h`, `>72h`)
- Lock/unlock claims to coordinate reviews
- Approve or deny submissions
- Denials support a reason and optional notes

#### Blocked
- Search blocked users
- Manually block users
- Unblock users
- Auto-block occurs after repeated denials (threshold: `3`)

#### History
The History tab has 3 views:

- `Records`:
- Search by username prefix and date range
- Reopen denied records for re-review

- `Approved`:
- Empty username query shows recent approved records (default date range: last 30 days)
- Username query rules:
- `0 chars`: show recent approved records
- `1-2 chars`: no backend search; UI shows hint: `Type at least 3 characters to search.`
- `3+ chars`: fast prefix search (`startsWith`, not contains)
- Supports paging with `Load More`

- `Audit`:
- Search audit events by username, actor, and date range
- Supports paging with `Load More`

#### Settings
- Enable/disable verifications
- Set required photo count (`1-3`)
- Configure flair template ID
- Approvals require a valid flair template ID
- Optional CSS matcher for verified-state detection
- View storage usage estimate

#### Templates
- Manage modmail subject/body templates for:
- Pending
- Approved
- Denied (per reason)
- Removal
- Supports placeholders like `{{username}}`, `{{mod}}`, `{{subreddit}}`, `{{date submitted}}`, `{{reason}}`, `{{days}}`

#### Themes
- Choose preset themes
- Optional custom primary/accent colors
- Live preview before saving

## Verification and Moderation Behavior

- Approved users are periodically revalidated (about every 30 days)
- Validation is batched and due-based to avoid scanning all users
- If a user is confirmed deleted/suspended, verification data is removed from active indexes
- Approved username search uses prefix matching only (`startsWith`)

## Data and Retention

### What is stored
- Verification records
- Pending/approved/history/audit indexes
- Per-user latest/pending pointers
- Block list + denial counters
- Subreddit configuration

### Retention rules
Retention rules are in place to maintain compliance with Reddit Dev Rules
- History/verification records that are not approved:
- Retained for 180 days (fixed)

- Audit entries:
- Retained for 180 days (fixed)

- Approved verification records:
- Retained for 365 days of inactivity (sliding), this allows users who take a break from your sub to still return verified.
- A verified user opening/rendering the app counts as activity for the purposes of post veririficaiton expiry extension.

### Additional moderator menu action
- `Purge Audit Log` (subreddit menu item) - this will remove all "audit" trails through the # of days set in the install settings.  Reccomended days: 3 to avoid abuse of this function. 
