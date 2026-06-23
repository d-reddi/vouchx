# Moderator Quick Start

This page is for first-time setup.

## Before you begin

- Install VouchX in the target subreddit.
- Make sure at least one moderator has `Manage Users` so they can review verifications.
- Create the mod-only user flair you want approved members to receive.
- If you want to open install settings from inside the panel, use a moderator account with install/config access.

## Setup flow

### 1. Create the verification hub post

1. Open the subreddit moderator menu.
2. Run `Create Verification Hub (VouchX)`.
3. Choose the post title or keep the default `Photo Verification Hub`.
4. The app creates an NSFW custom post and opens it.

### 2. Open the moderator panel

1. Open the new verification hub post.
2. Click `Mod Panel`.
3. If you do not see the button, confirm the account has `Manage Users`.
4. If the setup guide appears, follow it. The guide can be minimized, and it returns you to the queue when completed.

### 3. Configure verification settings first

Open `Settings -> General` and save these before processing the queue:

- `Select the flair to apply to approved users`: choose the mod-only approval flair VouchX should apply. Use manual template-ID input only if the flair is not listed.
- `Required verification photos` (# of photos defaults to 2)
- Optional advanced `Flair CSS match` for legacy or external verification detection
- Optional posting/commenting unlock messaging if your subreddit already enforces those rules outside VouchX
- `Verifications enabled`

Important: the pending queue is hidden until a valid approval flair is saved.

### 4. Add photo instructions

Open `Settings -> Photo Instructions` and save the user-facing requirements.

- English is the fallback language.
- Optional Spanish, French, and Portuguese (Brazil) versions add language choices in the Photo Requirements view.
- Choose the default language that opens first.
- Instructions support Reddit Markdown and placeholders such as `{{username}}`, `{{subreddit}}`, `{{days}}`, and `{{today}}`.

### 5. Set install settings

Open the subreddit app install settings and review:

- `Verifications disabled message`
- `Max denials before auto-block`: default 3; set 0 to disable auto-block
- `Automatically repair verification flair`: default on
- `Auto-archive pending verification modmail`: default on
- `Auto-deny shadowbanned accounts`: default off
- `Enable multiple approval flairs`: default off
- `Show user advisory score badge`: default on
- `Show content creator badge`: default on
- `Show photo instructions before verification submission`: default on
- `Restrict Settings tab to mods with config/settings access`: default off
- `Purge audit log data older than (days)`: default 30; set 0 to purge all audit entries when using the menu action
- `Denial Reason 1 Label`: (Default) Altered or edited image
- `Denial Reason 2 Label`: (Default) Unclear image
- `Denial Reason 3 Label`: (Default) Did not follow instructions
- `Denial Reason 4 Label`: (Default) Other

If a denial label is blank, that denial reason and its template field disappear from the moderator panel.

## 6. Customize modmail templates

Open `Settings -> Templates` and set:

- modmail subject and pending body
- approval header and body
- denial header and per-reason denial bodies
- whether moderator denial notes should be auto-appended to denial modmail
- revocation header and body
- pending turnaround days

All template fields are required for enabled features.

## 7. Optional: choose a theme

Open `Settings -> Themes` to pick a preset or enable custom colors.

## 8. Test the flow

Run one full submission with a **non-moderator** account:

1. Open the hub post as the test account.
2. Click `Photo Requirements`.
3. Click `Submit Verification`.
4. Accept all acknowledgements and upload the required photos.
5. Return to the moderator panel and verify that the request appears in `Queue`.
6. Approve or deny the request and confirm flair, modmail, mod note, and history behavior.

## Launch checklist

- approval flair saved
- required photo count matches your policy
- photo instructions are complete
- denial reason labels are configured
- templates are reviewed
- Peer Review and batch-review expectations are clear to your moderator team
- at least one moderator can process the queue

## Appendix: Create the Verification User Flair

Use this only if the subreddit does not already have a verification flair you want VouchX to apply.

1. Open **Mod Tools**.
2. Under **Settings**, select **Look and Feel**.
3. Click **User Flair**.
4. Click **Create**.
5. Enter the **Flair Text** and optionally add emojis.
6. Choose a flair color.
7. Enable **For mods only** so only moderators can assign the flair.
8. Leave the CSS class empty for the primary verification flair unless you have a specific fallback use case.
9. Click **Save**.
10. Hover over the created flair, click **Copy ID** if manual entry is needed, or choose the flair from `Select the flair to apply to approved users` in VouchX.
