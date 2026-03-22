# VouchX

VouchX is a Devvit app for **photo-based verification workflows** on Reddit. It gives members a guided submission flow and gives moderators a queue-driven review panel with audit history, templates, and automated maintenance.

- **Member UI:** inline verification hub post
- **Moderator UI:** queue, history, blocked users, and settings panels
- **Automation:** flair application/reconciliation, modmail templates, retention cleanup, scheduled validation

---

## Core Capabilities

### Member-side

- Submit 1–3 verification photos (configurable by moderators).
- Optional “show instructions before submit” gate.
- Live status refresh while the hub is open.
- Resubmission flow after denial.
- Self-service withdraw (pending) and self-remove (approved).

### Moderator-side

- Pending queue with claim locking to prevent double actions.
- Approve / deny with configurable modmail templates.
- Optional banned-user approval confirmation (approval can unban first when confirmed).
- Reopen denied cases (when photos are still available).
- Blocked-user management + denial-based auto-block threshold.
- Searchable history views (records, approved, audit).
- Per-item account stats modal (account age, karma, ban status, prior denials).

### Flair system

- Primary approval flair template ID support.
- Optional **multiple approval flairs** (2nd/3rd choices) when enabled in install settings.
- Per-approval flair selection in queue actions.
- Verification detection checks:
  - template ID match
  - optional flair CSS substring match
  - text fallback (primary cached text + additional configured flair texts when template ID is absent)
- Optional automatic flair repair/reconciliation for approved users.

### Ops & reliability

- Daily scheduled reconciliation/cleanup job.
- 45-day history/audit retention logic.
- Sliding retention for approved records with controlled TTL bumps.
- Update notice system for moderators (supports normal vs critical notices and dismissal behavior).
- Realtime refresh signals for hub/mod panel without broadcasting user payloads.

---

## Quick Start (Moderators)

1. Install **VouchX** in your subreddit.
2. Use moderator menu action **Create Verification Hub (VouchX)**.
3. Open the post and launch **Mod Panel**.
4. In **Settings → General**:
   - enable verifications,
   - choose an approval flair (or enter template ID manually),
   - set required photo count,
   - configure photo instructions.
5. Optionally configure **Templates** and **Themes** tabs.

Once saved, users can submit immediately.

---

## Moderator Menu Actions

- **Create Verification Hub (VouchX)**
  - Creates a new NSFW verification hub post.
- **Purge Audit Log**
  - Purges audit records using subreddit install setting `mod_menu_audit_purge_days` (0 = purge all).
- **Remove Verification Hub Post**
  - Removes the current app-owned verification post.

---

## Configuration

VouchX uses both **install settings** (subreddit/global) and **panel-managed runtime settings**.

### Subreddit install settings

- `verifications_disabled_message`
- `max_denials_before_block`
- `auto_flair_reconcile_enabled`
- `multiple_approval_flairs_enabled`
- `show_photo_instructions_before_submit`
- `settings_tab_requires_config_access`
- `mod_menu_audit_purge_days`
- `deny_reason_1_label` … `deny_reason_4_label`

### Global install settings (release notice metadata)

- `play_latest_release_version`
- `play_latest_release_title`
- `play_latest_release_notes`
- `play_latest_release_link`
- `play_latest_release_severity`

Legacy `latest_release_*` aliases are also supported.

### Panel settings (stored per subreddit)

- Verification workflow (enabled toggle, flair setup, CSS matcher, required photo count, instructions)
- Modmail templates (pending, approval, denial, removal)
- Denial reason templates + denial notes behavior
- Theme preset + color overrides

---

## Template Placeholders

### Photo instructions

- `{{subreddit}}`
- `{{days}}`

### Modmail templates

- `{{username}}`
- `{{mod}}`
- `{{subreddit}}`
- `{{date submitted}}`
- `{{days}}`
- Denial templates additionally support `{{denial_notes}}` (and legacy alias `{{reason}}`).

---

## Data & Retention

Stored data includes verification records, indexes, blocked entries, denial counters, config, and audit entries. Uploaded images themselves are not stored by the app; only returned media URLs are persisted.

Retention defaults:

- History records: **45 days**
- Audit records: **45 days**
- Verified record retention window: **45 days** (sliding behavior)

---

## Development

### Scripts

- `npm run dev` — launch local playtest
- `npm run build` — Vite build
- `npm run check` — TypeScript type-check
- `npm test` — Node test suite (`src/core.test.ts`)
- `npm run deploy` — build + upload via Devvit CLI

### Project structure (high level)

- `src/core.ts` — verification domain logic, storage, moderation workflows
- `src/index.ts` — API routes / server wiring
- `src/main.tsx` — Devvit menu items, triggers, scheduler job registration
- `webroot/` — hub + mod panel front-end assets
- `devvit.json` — app manifest, permissions, and settings schema

---

## Legal

- [Privacy Policy](./PRIVACY_POLICY.md)
- [Terms of Service](./TERMS_OF_SERVICE.md)
- [License](./LICENSE)
