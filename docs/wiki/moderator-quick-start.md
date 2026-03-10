# Moderator Quick Start

This page is for first-time setup.

## Before you begin

- Install VouchX in the target subreddit.
- Make sure at least one moderator has `Manage Users` so they can review verifications.
- Create the user flair you want approved members to receive. You will need its flair template ID.
- If you want to open install settings from inside the panel, use a moderator account with `All` permissions.

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

### 3. Configure verification settings first

Open `Settings -> General` and save these before processing the queue:

- `Flair template ID to set`: paste the template ID for the verification flair you want VouchX to apply. If you do not already have a verification flair, use the appendix at the end of this page to create one first.
- `Required verification photos` (# of photos defaults to 2)
- `Photo Instructions` (Add instructions for users to follow for your verification.)
- `Verifications enabled`

Important: the pending queue is hidden until a valid flair template ID is saved.

### 4. Set install settings

Open the subreddit app install settings and review:

- `Purge Audit Log days`: (Default) 3
- `Verifications disabled message`: (Default) Verifications are temporarily disabled.  Please check back soon.
- `Denial Reason 1 Label`: (Default) Altered or edited image
- `Denial Reason 2 Label`: (Default) Unclear image
- `Denial Reason 3 Label`: (Default) Did not follow instructions
- `Denial Reason 4 Label`: (Default) Other

If a denial label is blank, that denial reason and its template field disappear from the moderator panel.

## 5. Customize modmail templates

Open `Settings -> Templates` and set:

- modmail subject and pending body
- approval header and body
- denial header and per-reason denial bodies
- revocation header and body
- pending turnaround days

All template fields are required for enabled features.

## 6. Optional: choose a theme

Open `Settings -> Themes` to pick a preset or enable custom colors.

## 7. Test the flow

Run one full submission with a **non-moderator** account:

1. Open the hub post as the test account.
2. Click `Photo Instructions`.
3. Click `Submit Verification`.
4. Accept all acknowledgements and upload the required photos.
5. Return to the moderator panel and verify that the request appears in `Queue`.
6. Approve or deny the request and confirm flair, modmail, mod note, and history behavior.

## Launch checklist

- flair template ID saved
- required photo count matches your policy
- photo instructions are complete
- denial reason labels are configured
- templates are reviewed
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
10. Hover over the created flair, click **Copy ID**, and paste that value into `Flair template ID to set` in VouchX.
