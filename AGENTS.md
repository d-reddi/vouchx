# Working with this repo

VouchX is a Reddit Devvit Web app (Devvit Web + Express + vanilla JS + Redis):
a verification hub with moderator workflows.

The server-side business logic used to live in one ~10k-line file, `src/core.ts`.
It has been split into focused modules under `src/core/`. **Work with this
structure — do not re-merge the modules back into one file.**

## Architecture

- **`src/core.ts` is a pure re-export barrel.** It contains no logic, only
  `export { ... } from './core/X.ts'` lines. It defines the public API that the
  Express server (`src/index.ts`) imports via `./core.js`.
- **All logic lives in `src/core/*.ts`.** Each file owns one domain:

| Module | Owns |
| --- | --- |
| `types.ts` | All shared type/interface declarations |
| `constants.ts` | Config constants (retention windows, setting names, default message templates, TTLs) |
| `normalize.ts` | Pure utils: username/subreddit sanitizers, version compare, timestamps, `errorText`, `dedupeNonEmpty`, reddit-error classifiers, `getCurrentSubredditNameCompat` |
| `keys.ts` | All Redis key builders |
| `records.ts` | Verification record read/write, user pointers, global indexes, audit-log storage, storage metering |
| `locks.ts` | Redis locks + pending-claim state |
| `flags.ts` | Peer Review state + internal review notes on pending records |
| `moderator-access.ts` | Viewer identity, moderator permission lookups/caches, access assertions, hub moderator UI state |
| `blocking.ts` | Blocked-user storage, denial counts, block/unblock, global blocklist readers |
| `submission.ts` | `submitVerification`, user grading/scoring, content-creator detection, pending account snapshot |
| `review-actions.ts` | Approve/deny/reopen/cancel, batch review, auto-deny shadowban, moderator removal |
| `modmail.ts` | Modmail send/archive, mod notes, denial template rendering |
| `flair.ts` | Approval flair config, template validation, viewer flair snapshots, verification flair checks |
| `search.ts` | Pending/approved/history/audit search, moderator stats |
| `dashboard.ts` | Hub/mod dashboard loaders, state payload builders (`toHubState` / `toModPanelState`) |
| `onboarding.ts` | Per-moderator onboarding completion tracking and versioned feature-education packs for the mod panel wizard |
| `settings.ts` | Runtime config, settings save handlers, validators, configurable deny reasons |
| `theme.ts` | Theme presets + color derivation |
| `retention.ts` | Validation scheduling, retention reconcile, history prune, audit purge (scheduled jobs) |
| `purge.ts` | User data deletion, pending withdrawal |
| `update-notice.ts` | Release metadata, moderator update notices |

The client UI lives in `src/client/` (`hub-app.js`, `mod-panel.js`,
`mod-panel.css`, etc.) and is a separate bundle — it talks to the server only
over the HTTP routes defined in `src/index.ts`, never by importing `src/core`.

The mod panel setup/onboarding/feature wizard lives in `src/client/mod-panel.html`,
`src/client/mod-panel.js`, and `src/client/mod-panel.css`. Server state for the
wizard flows through `DashboardData` / `ModPanelStatePayload`
(`requiresInitialSetup`, `needsOnboarding`, `newFeaturePacks`) and
`/api/mod/onboarding/complete` / `/api/mod/feature-education/complete`;
per-moderator onboarding and feature-education completion storage belongs in
`src/core/onboarding.ts`. Wizard mode priority is **setup > onboarding >
features**: setup suppresses onboarding/features, and onboarding suppresses
feature packs. Completing setup/onboarding also marks current feature packs
complete so new moderators do not see back-to-back tours. Feature-education
completion keys are per subreddit/moderator/pack and expire after the long TTL
in `FEATURE_EDUCATION_COMPLETION_TTL_DAYS`; the normal onboarding completion
key stays durable. Keep feature packs in `CURRENT_FEATURE_EDUCATION_PACKS` long
enough for slow-updating communities to catch up, and remove old packs only
after their `retainUntilAtLeast` version has passed. Keep wizard debug controls
production-safe: `wizardDebugMode` is a manual boolean debug switch, and forced
mode should stay `null` in production.

## Current product behavior

- The moderator-facing name for the old flag / second-review workflow is
  **Peer Review**. Keep user-facing copy on that term. Internal names such as
  `reviewFlag`, `flagPending`, and `setPendingFlagState` may remain for storage
  and API compatibility; do not churn them without a dedicated migration.
- Peer Review is **not a lock**. Any moderator who can normally act on the
  request may approve, deny, clear Peer Review, or add Peer Review notes,
  subject only to the existing pending-claim lock rules. Approve/deny actions
  clear Peer Review state.
- While a request is in Peer Review, hide the normal Lock/Unlock controls and
  show **Clear Peer Review**. Do not show stale 24-hour hold, force-unlock, or
  note-only language for Peer Review.
- Peer Review requests stay prioritized at the top of the pending queue. When
  multiple requests are in Peer Review, sort them by `flaggedAt`, oldest first,
  until they are resolved, cleared, or removed from pending.
- Pending queue cards should not show the Terms & Age confirmation row. The
  acknowledgement timestamp still must be stored and can appear in record
  details/history/modmail audit copy, but it is redundant with Submitted on the
  pending card.
- Previous-denial details belong behind the clickable `Denied before` /
  `Denied xN` badge on the pending card. Do not duplicate the full previous
  denial detail block in the Stats card.
- Moderator Stats decision quality uses P90 decision time, shown as
  **90% Decided Within** with the sample count beside it. Compute P90 with the
  nearest-rank method from timed approve/deny audit entries. Show
  `Not enough data yet` until there are at least 10 timed decisions in the
  selected range. Do not use average or median as the primary SLA metric.
  Older audit entries without timing metadata are excluded from timing stats.
  Denial-reason breakdowns also come from audit metadata recorded going forward.

## Import rules

- Inside a module, import dependencies **directly from the owning module**:
  `import { getRecord } from './records.ts'`, types from `./types.ts`,
  constants from `./constants.ts`, shared helpers from
  `../shared/global-usernames.ts`.
- **Never import from `../core.ts` inside a module.** The barrel is only for
  external consumers (`src/index.ts`, `src/core.test.ts`). Reach an internal
  helper through its owning module, not the barrel.
- The Devvit runtime (`redis` / `reddit` / `settings`) is passed in as the
  `context` **parameter** — it is not imported. Keep that pattern.

## Adding or changing code

- Put new functions in the module that matches their domain.
- If a function must be public (used by `src/index.ts`), also add it to the
  re-export list in `src/core.ts`.
- Keep `src/core.ts` logic-free — it is the barrel only.

## Verify after every change (all must pass)

```
npm run check     # tsc --noEmit
npm test          # node --test src/core.test.ts (full suite)
npm run build     # vite build (client + server bundles)
```
