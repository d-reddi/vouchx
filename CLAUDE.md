Agent guidance for this repo lives in [AGENTS.md](AGENTS.md). Read it and follow it.

It is the single source of truth (so it can't drift from a duplicate). Key point:
`src/core.ts` is a pure re-export barrel; all logic lives in focused modules under
`src/core/`. Import internal helpers from their owning module, never from the barrel.
