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
| `flags.ts` | 2nd-review flag state + internal flag notes on pending records |
| `moderator-access.ts` | Viewer identity, moderator permission lookups/caches, access assertions, hub moderator UI state |
| `blocking.ts` | Blocked-user storage, denial counts, block/unblock, global blocklist readers |
| `submission.ts` | `submitVerification`, user grading/scoring, content-creator detection, pending account snapshot |
| `review-actions.ts` | Approve/deny/reopen/cancel, batch review, auto-deny shadowban, moderator removal |
| `modmail.ts` | Modmail send/archive, mod notes, denial template rendering |
| `flair.ts` | Approval flair config, template validation, viewer flair snapshots, verification flair checks |
| `search.ts` | Pending/approved/history/audit search, moderator stats |
| `dashboard.ts` | Hub/mod dashboard loaders, state payload builders (`toHubState` / `toModPanelState`) |
| `onboarding.ts` | Per-moderator onboarding completion tracking for the mod panel walkthrough |
| `settings.ts` | Runtime config, settings save handlers, validators, configurable deny reasons |
| `theme.ts` | Theme presets + color derivation |
| `retention.ts` | Validation scheduling, retention reconcile, history prune, audit purge (scheduled jobs) |
| `purge.ts` | User data deletion, pending withdrawal |
| `update-notice.ts` | Release metadata, moderator update notices |

The client UI lives in `src/client/` (`hub-app.js`, `mod-panel.js`,
`mod-panel.css`, etc.) and is a separate bundle — it talks to the server only
over the HTTP routes defined in `src/index.ts`, never by importing `src/core`.

The mod panel setup/onboarding wizard lives in `src/client/mod-panel.html`,
`src/client/mod-panel.js`, and `src/client/mod-panel.css`. Server state for the
wizard flows through `DashboardData` / `ModPanelStatePayload`
(`requiresInitialSetup`, `needsOnboarding`) and `/api/mod/onboarding/complete`;
per-moderator completion storage belongs in `src/core/onboarding.ts`. Keep
wizard debug controls production-safe: `wizardDebugMode` is a manual boolean
debug switch, and forced mode should stay `null` in production.

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
