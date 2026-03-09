# Settings Reference

VouchX has two configuration layers:

1. install settings for the subreddit installation
2. moderator-panel settings stored by the app for that subreddit

## Install settings

These live in the subreddit app installation settings.

### Purge Audit Log days

- Used by the moderator menu action `Purge Audit Log`
- `0` means purge all audit entries
- Any positive number means purge only entries older than that many days

### Verifications disabled message

- Shown to members when submissions are turned off
- If left blank, the app falls back to its default disabled message
- Maximum length: 200 characters

### Denial Reason 1-4 Label

- These are the moderator-facing names for the four denial slots
- If a label is blank, that reason is hidden from the review UI
- Hidden reasons also hide their matching template fields in the `Templates` tab
- Maximum length: 48 characters per label

## Verification Settings tab

### Verifications enabled

- Turns member submissions on or off
- When off, members see the disabled message from install settings

### Flair template ID to set

- Required before the queue can be processed
- Must look like a valid Reddit flair template ID
- The app hides pending review cards until this is configured

Tip: moderators should copy this from Reddit desktop `Mod tools` -> `Look and Feel` -> `User flair`.

### Flair CSS matcher

- This allows moderators to set flairs that still show "verified" for users. Use cases may be special flairs for certain users, etc. 
- Flair is a CSS wild card. i.e., if any flair has a CSS class containing "verifieduser" then it will match. Wildcard matches "verifieduser1", "verifieduser_MVP" etc. 
- Optional fallback for verified-status detection
- Verified status uses OR logic:
  - flair template ID match
  - CSS wildcard match

### Required verification photos

- Controls whether the submit form asks for 1, 2, or 3 images

### Photo Instructions

- Shown to members in the `Photo Instructions` modal
- Supports simple markdown
- Supported placeholders:
  - `{{subreddit}}`
  - `{{days}}`

## Templates tab

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
- `{{reason}}`
- `{{days}}`

Template notes:

- `{{reason}}` inserts the optional moderator notes entered during denial
- `{{days}}` already includes the unit, for example `3 days`
- approval, denial, and revocation headers are rendered as a bold header block in modmail replies

## Themes tab

Moderators can:

- choose a preset theme
- enable custom colors
- override primary, accent, and background colors

Themes affect both the member hub and moderator panel presentation.
