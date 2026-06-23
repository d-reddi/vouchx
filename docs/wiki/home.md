# VouchX Help

VouchX is a moderator-reviewed photo verification app for Reddit communities. Members submit photos in a verification hub post, moderators review them in a dedicated panel, and the app tracks history, blocks, templates, flair, stats, and cleanup automatically.

Use this wiki in this order:

1. Start with [Moderator Quick Start](./moderator-quick-start.md) if you are setting up VouchX for a subreddit.
2. Read [Member Guide](./member-guide.md) if you want the end-user flow.
3. Read [Moderator Guide](./moderator-guide.md) for daily queue handling, blocking, history, and revocations.
4. Use [Settings Reference](./settings-reference.md) for field-by-field configuration details.
5. Check [Troubleshooting](./troubleshooting.md) for permission issues, blocked submissions, reopen limits, mobile photo-instruction behavior, and retention behavior.

## At a glance

### Members

- Open the verification hub post.
- Read the photo requirements. Communities can publish English, Spanish, French, and Portuguese (Brazil) instructions.
- Confirm the submission acknowledgements.
- Upload the required number of photos.
- Wait for moderator review, withdraw a pending request, or remove an approved verification.

### Moderators

- Use the subreddit menu item `Create Verification Hub (VouchX)` to create the post.
- Open the post and click `Mod Panel`.
- Follow the setup guide when it appears. It walks through initial settings, then each moderator gets a one-time panel tour.
- Configure the approval flair before trying to review the queue.
- Review queue submissions, batch-review multiple cards, request Peer Review, manage blocked users, search history, view stats, and customize settings, instructions, templates, and themes.

## Important prerequisites

- The review panel is only available to moderators with `Manage Users`.
- The install settings link is only shown to moderators with install/config access. Communities can also restrict the Settings tab to config-level moderators.
- Queue review cards are hidden until a valid approval flair is saved in `Settings -> General`.
- Denial reasons come from install settings. If a denial label is blank, that reason is hidden from the review and template UI.
- VouchX runs as a Devvit Web app using Reddit API access, Devvit media uploads, realtime updates, and Redis-backed app storage.

## Related pages

- Terms and Conditions and Privacy Policy are separate legal pages already linked inside the app.
