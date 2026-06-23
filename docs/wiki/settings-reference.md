# Settings Reference

VouchX has two configuration layers:

1. install settings for the subreddit installation
2. moderator-panel settings stored by the app for that subreddit

## Install settings

These live in the subreddit app installation settings.

### Verifications disabled message

- Shown to members when submissions are turned off
- If left blank, the app falls back to its default disabled message
- Maximum length: 200 characters

### Max denials before auto-block

- Controls when denied users are automatically blocked from new submissions
- Default: `3`
- `0` disables automatic denial-count blocking
- Must be `0` or a whole number of `2` or greater

### Automatically repair verification flair

- Default: on
- When enabled, VouchX checks approved users' live flair when they open the hub, no more than once every 24 hours
- If the verification flair was removed or changed, VouchX attempts to restore it
- Existing flair that still matches the configured CSS matcher is not replaced

### Auto-archive pending verification modmail

- Default: on
- Archives pending verification modmail conversations and user replies before a moderator approval or denial is made

### Auto-deny shadowbanned accounts

- Default: off
- When enabled, VouchX automatically denies a new submission if Reddit reports the account as shadowbanned
- The denial is logged as automated and sends shadowban appeal guidance
- Automated shadowban denials do not increment the denial-count auto-block threshold
- When off, shadowbanned submissions remain in the queue for manual review

### Enable multiple approval flairs

- Default: off
- When enabled, moderators can configure up to two additional approval flairs in `Settings -> General`
- Queue approvals can then choose which configured approval flair to apply

### Show user advisory score badge

- Default: on
- Controls whether pending profile cards show the advisory score badge based on account signals
- Account details remain available when the badge is off

### Show content creator badge

- Default: on
- Controls whether pending profile cards show a content creator badge when account links match known adult creator platforms

### Show photo instructions before verification submission

- Default: on
- When enabled, users see configured Photo Requirements after clicking `Submit Verification` and before uploading photos
- If no instructions are configured, users proceed directly to acknowledgements and upload

### Restrict Settings tab to mods with config/settings access

- Default: off
- When enabled, only moderators with config/settings access can see and use the Settings tab
- Review queue access is unchanged for moderators with `Manage Users`

### Purge audit log data older than (days)

- Used by the moderator menu action `Purge Audit Log`
- `0` means purge all audit entries
- Any positive number means purge only entries older than that many days

### Denial Reason 1-4 Label

- These are the moderator-facing names for the four denial slots
- If a label is blank, that reason is hidden from the review UI
- Hidden reasons also hide their matching template fields in `Settings -> Templates`
- Maximum length: 48 characters per label

## Settings -> General

### Verifications enabled

- Turns member submissions on or off
- When off, members see the disabled message from install settings

### Approval flair

- Required before the queue can be processed
- Choose the mod-only user flair VouchX should apply to approved users
- Manual template-ID input is available when the desired flair is not listed
- The app validates selected template IDs against Reddit flair templates when saved
- The app hides queue review cards until this is configured

Tip: moderators should copy this from Reddit desktop `Mod tools` -> `Look and Feel` -> `User flair`.

### Flair CSS matcher

- This allows moderators to recognize alternate flair CSS classes that should still count as verified.
- Matching is substring-based. If the configured value appears anywhere in the flair CSS class, it matches.
- Example: a matcher of `verifieduser` matches `verifieduser1`, `verifieduser_MVP`, and `moderator_verifieduser`.
- Optional fallback for verified-status detection
- Verified status uses OR logic:
  - flair template ID match
  - CSS substring match

### Additional approval flairs

- Available only when `Enable multiple approval flairs` is on in install settings
- Up to two additional approval flairs can be configured
- Moderators choose among configured approval flairs when approving a request

### Required verification photos

- Controls whether the submit form asks for 1, 2, or 3 images

### Verification requirement messaging

- `Show posting unlock step` and `Show commenting unlock step` only change member-facing copy
- VouchX does not enforce posting or commenting access
- Enable these only if the subreddit already enforces those requirements through AutoModerator or another mod tool

## Settings -> Photo Instructions

Photo Instructions control the member-facing `Photo Requirements` view.

### Languages

- English is the fallback
- Optional Spanish, French, and Portuguese (Brazil) fields add language choices when they have content
- `Default instruction language` controls which language opens first
- If the selected default is empty, VouchX falls back to the next available instruction language

### Formatting

Instructions support Reddit Markdown, including bold, italics, links, quotes, headings, line breaks, bullet lists, and numbered lists.

Supported placeholders:

- `{{username}}`
- `{{subreddit}}`
- `{{days}}`
- `{{today}}`

`{{days}}` already includes the unit, for example `3 days`. `{{today}}` renders the viewer's local date.

## Settings -> Templates

The templates tab controls modmail content.

Required fields:

- modmail subject
- pending turnaround days
- pending body
- approval header
- approval body
- denial header
- revocation header
- revocation body
- one denial body for every enabled denial reason

Supported placeholders:

- `{{username}}`
- `{{mod}}`
- `{{subreddit}}`
- `{{date submitted}}`
- `{{denial_notes}}` for denial templates
- `{{reason}}` for revocation templates
- `{{days}}`
- `{{today}}`

Template notes:

- `{{denial_notes}}` inserts the optional moderator notes entered during denial
- The `Auto-append moderator denial notes` toggle appends denial notes automatically unless the denial header or body already uses `{{denial_notes}}`
- `{{days}}` already includes the unit, for example `3 days`
- `{{today}}` uses the date when the message is generated
- approval, denial, and revocation headers are rendered as a bold header block in modmail replies

## Settings -> Themes

Moderators can:

- choose a preset theme
- enable custom colors
- override primary, accent, and background colors

Themes affect the member-facing hub and photo requirements presentation. The moderator workspace keeps its own interface styling.
