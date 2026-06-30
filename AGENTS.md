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
| `modmail.ts` | Modmail send/archive, mod notes, `sendModNotification` (standalone mod-notification), denial template rendering |
| `flair.ts` | Approval flair config, template validation, viewer flair snapshots, verification flair checks |
| `search.ts` | Pending/approved/history/audit search, moderator stats |
| `dashboard.ts` | Hub/mod dashboard loaders, state payload builders (`toHubState` / `toModPanelState`) |
| `onboarding.ts` | Per-moderator onboarding completion tracking and versioned feature-education packs for the mod panel wizard |
| `settings.ts` | Runtime config, settings save handlers, validators, configurable deny reasons |
| `theme.ts` | Theme presets + color derivation |
| `retention.ts` | Validation scheduling, retention reconcile, history prune, audit purge (scheduled jobs) |
| `purge.ts` | User data deletion, pending withdrawal |
| `update-notice.ts` | Release metadata, moderator update notices |
| `broadcast.ts` | Developer modmail broadcast: host-sub wiki-log read/write, per-install poll + delivery, version & announcement-opt-out filtering, local idempotency, staggered poll scheduling |

The client UI lives in `src/client/` (`hub-app.js`, `mod-panel.js`,
`mod-panel.css`, etc.) and is a separate bundle — it talks to the server only
over the HTTP routes defined in `src/index.ts`, never by importing `src/core`.

The mod panel setup/onboarding/feature wizard lives in `src/client/mod-panel.html`,
`src/client/mod-panel.js`, `src/client/mod-panel.css`, and the shared pure state
helpers in `src/client/wizard-state.js` (covered by
`src/client/wizard-state.test.js`). Server state for the wizard flows through
`DashboardData` / `ModPanelStatePayload`
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

The **developer console** lives in `src/client/hub-app.js` / `hub-ui.css` as an
in-hub modal (not a separate entrypoint), gated by the `developer_ui_usernames`
global setting and surfaced via the `developerPanel` hub-state payload. It has
two tabs — **Broadcast Modmail** and **Global Blocklist** — and talks to the
`/api/dev/broadcast/*` routes (developer-gated server-side via `requireDeveloper`,
independent of the client gate). Its message formatting toolbar mirrors the mod
panel's photo-instructions helpers.

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
- Filtered History and Audit searches must deep-scan beyond the first Redis
  page using the shared bounded batch, entry-cap, and time-budget constants.
  Do not make moderators select **Load more** merely because a match is older
  than the initial candidate window. Returned offsets must advance by consumed
  live entries after stale-index cleanup; **Load more** is the continuation only
  when additional matches remain or a safety bound is reached.
- The developer **modmail broadcast** log lives on `BROADCAST_HOST_SUBREDDIT`'s
  wiki page; the `broadcast_wiki_page` global setting is both the pointer to that
  page and the master kill-switch (empty = no installation reads or sends).
  A broadcast's delivered state is tracked **per installation in Redis, keyed by
  broadcast id — never written back to the shared wiki page.** The version filter
  (`maxVersion`) and the announcement opt-out are evaluated **locally per
  installation** at poll time; there is no central install registry. A max-age
  guard stops freshly installed subs from replaying old broadcasts.
- Broadcast **type** is `announcement` (opt-out via the `app_announcements_enabled`
  install setting, default on) or `notification` (always delivered, ignores the
  setting). Unknown/legacy entries default to `announcement`.
- Authoring (compose/publish/revoke) is allowed only from the host sub
  (`BROADCAST_HOST_SUBREDDIT`) and the dev sub (`BROADCAST_DEV_SUBREDDIT`); both
  read and write the canonical host wiki, not their own. The per-install poll is
  scheduled by `ensureBroadcastPollSchedule` using a per-subreddit staggered cron
  from `broadcastPollCron`; it is cron-aware (cancels and reschedules when the
  cadence changes), so changing the cadence needs no reinstall.
- **Realtime refresh is username-targeted to limit Reddit API fan-out.**
  Mutating routes notify clients via `sendRefreshSignals` /
  `sendFastModRefreshResponse` (`src/index.ts`). The **mod-panel** channel
  (`vouchx_mod_refresh`) always gets a bare broadcast — reviewers want every
  queue change. The **hub** channel (`vouchx_hub_refresh`) is *targeted*: pass
  the affected username(s) for per-user actions (approve / deny / submit /
  withdraw / delete / claim / flag / reopen / remove / block / …; batch passes
  the whole affected-username array in a single send), and omit them only for
  genuinely global changes (settings / templates / theme) that must refresh
  everyone. The client gate is the pure `shouldApplyHubRefreshSignal`
  (`src/client/realtime-filter.js`, covered by
  `src/client/realtime-filter.test.js`): a hub viewer refetches `/api/hub/state`
  only when the signal is global, names them, or they `canReview` (so the hub's
  mod pending-count bubble stays current). **When adding a route that changes one
  user's state, pass that username — a bare broadcast reintroduces the viewer
  fan-out that causes Reddit HTTP 429s.** Matching is case-insensitive; the
  server sends strict-normalized (lowercased) names. Realtime caps are 1 MB/msg
  and 100 sends/sec per installation, and targeting is always a single send, so
  it stays well under.

## Import rules

- Inside a module, import dependencies **directly from the owning module**:
  `import { getRecord } from './records.ts'`, types from `./types.ts`,
  constants from `./constants.ts`, shared helpers from
  `../shared/global-usernames.ts`.
- **Never import from `../core.ts` inside a module.** The barrel is only for
  external consumers (`src/index.ts`, `src/runtime-guards.ts`, and
  `src/core.test.ts`). Reach an internal helper through its owning module, not
  the barrel.
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
npm test          # node --test --experimental-strip-types src/core.test.ts src/client/wizard-state.test.js src/client/realtime-filter.test.js
npm run build     # vite build (client + server bundles)
```

`npm test` runs only the files named in the `package.json` script — when you add
a new client pure-helper test file, add it there too or it will not run.
