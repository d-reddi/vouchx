# VouchX Help

VouchX is a moderator-reviewed photo verification app for Reddit communities. Members submit photos in a verification hub post, moderators review them in a dedicated panel, and the app tracks history, blocks, templates, flair, and cleanup automatically.

Use this wiki in this order:

1. Start with [Moderator Quick Start](./moderator-quick-start.md) if you are setting up VouchX for a subreddit.
2. Read [Member Guide](./member-guide.md) if you want the end-user flow.
3. Read [Moderator Guide](./moderator-guide.md) for daily queue handling, blocking, history, and revocations.
4. Use [Settings Reference](./settings-reference.md) for field-by-field configuration details.
5. Check [Troubleshooting](./troubleshooting.md) for permission issues, blocked submissions, reopen limits, and retention behavior.

## At a glance

### Members

- Open the verification hub post.
- Read the photo instructions.
- Confirm the submission acknowledgements.
- Upload the required number of photos.
- Wait for moderator review, withdraw a pending request, or remove an approved verification.

### Moderators

- Use the subreddit menu item `Create Verification Hub (VouchX)` to create the post.
- Open the post and click `Open Moderator Panel`.
- Configure the flair template ID before trying to review the queue.
- Review pending submissions, manage blocked users, search history, and customize messages and themes.

## Important prerequisites

- The review panel is only available to moderators with `Manage Users`.
- The install settings link is only shown to moderators with `All` permissions.
- The pending queue is hidden until a valid flair template ID is saved in `Verification Settings`.
- Denial reasons come from install settings. If a denial label is blank, that reason is hidden from the review and template UI.

## Related pages

- Terms and Conditions and Privacy Policy are separate legal pages already linked inside the app.
