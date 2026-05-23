# VouchX Agent Instructions

## Startup Behavior

Before performing repository analysis or edits:
1. Read this AGENTS.md file completely.
2. Follow these instructions as higher priority than default behavior.
3. If instructions conflict, ask for clarification instead of guessing.

## Repository Documentation

Before planning or editing, review relevant documentation in `/docs` when applicable.

Important documentation files include:

- `/docs/architecture.md`
  - Source of truth for system structure, responsibilities, and architectural decisions.

- `/docs/devvit-notes.md`
  - Contains Devvit-specific limitations, quirks, historical issues, and implementation constraints.

- `/docs/workflows.md`
  - Defines development workflow expectations, testing requirements, release process, and repository conventions.

When repository documentation conflicts with assumptions:
- trust the repository documentation
- do not invent alternative architecture
- ask for clarification if uncertain

## Documentation Maintenance

When making meaningful architectural or workflow changes:

- identify whether `/docs` files should also be updated
- recommend documentation updates when appropriate
- avoid allowing architecture docs to drift from implementation

## Core Operating Rules

You are assisting with VouchX, a Reddit Devvit app.

The user is terminal-proficient but not a software engineer. Be explicit, practical, cautious, and structured.

Always plan before editing files.

Do not edit files until the user approves the plan.

Prefer small, reversible changes.

Do not refactor unrelated code.

Do not rename settings, Redis keys, storage keys, labels, routes, exported functions, UI labels, or user-facing terminology unless explicitly requested.

Do not make broad architectural changes unless explicitly requested.

Ask before:
- deleting files
- changing dependencies
- changing package versions
- changing build tooling
- changing deployment/release configuration
- introducing migrations
- changing data structures
- changing Redis schemas

## Devvit MCP Requirements

Use the Devvit MCP before making Devvit-specific assumptions.

Use Devvit MCP for:
- Devvit APIs
- devvit.json schema
- settings syntax
- global settings
- Redis behavior
- scheduler behavior
- permissions
- mod actions
- modmail APIs
- uploads
- forms
- web views
- app review constraints
- installation behavior
- playtest behavior
- Devvit limitations
- logging questions

Do not generate placeholder implementations for unsupported Devvit capabilities.

If Devvit does not support a requested feature:
  - explain the limitation
  - propose realistic alternatives

Never invent Devvit APIs.

Never assume historical Devvit behavior is still current.

If Devvit MCP results are incomplete or ambiguous:
- say so clearly
- explain uncertainty
- avoid guessing

## Planning Requirements

Before making edits, always provide:

1. Summary of the request
2. Devvit MCP findings (if relevant)
3. Files likely affected
4. Proposed implementation plan
5. Risks and edge cases
6. Commands/tests that will be run afterward

- Do not assume missing context.
- If implementation intent is ambiguous, ask clarifying questions before editing.
- Prefer asking over guessing when behavior changes may affect moderation workflows.

Then STOP and wait for approval.

Do not begin editing until approval is given.

## Editing Rules

When approved to edit:

- Make the smallest effective change.
- Preserve existing patterns and architecture.
- Prefer existing helper functions over introducing abstractions.
- Keep naming conventions consistent.
- Keep UI terminology consistent with existing app wording.
- Avoid introducing new settings unless necessary.
- Avoid introducing new dependencies unless necessary.
- Do not silently remove safeguards or validations.
- Avoid changing unrelated formatting/style across files.
- Limit edits to files directly related to the approved task.
- Do not modify unrelated files even if improvements are identified.
- If additional issues are discovered:
  - report them separately
  - do not silently fix them
- Preserve existing moderator workflow expectations unless explicitly changing UX behavior.
- Avoid introducing additional clicks, confirmations, or workflow friction unless requested.
- Preserve backward compatibility unless explicitly approved otherwise.

## VouchX Known Architecture

- VouchX is a Reddit Devvit verification workflow app.
- It uses Devvit Web plus Express and vanilla JS surfaces.
- It includes:
  - verification hub
  - moderator panel
  - queues
  - templates
  - settings
  - audit/history records
  - flair assignment/reconciliation
  - modmail integration
  - verification workflows

- `flairTemplateId` is the authoritative approval flair template field.
- Existing setting names and Redis keys must be preserved unless migration is explicitly approved.
- The app contains safety guards around missing configuration and flair validation.
- Redis/storage behavior may be per-subreddit install; verify Devvit-specific assumptions before relying on them.
- Stats page terminology:
  - "Currently Verified" = current state after removals/expirations
  - "Approvals" = action counts within selected range

## Testing Rules

- Passing builds do not guarantee behavioral correctness.
- For workflow-related changes:
  - identify expected runtime behavior
  - explain what should be manually tested
  - identify likely edge cases

After edits, always run:

```bash
npm run check
```

Then run:

```bash
npm run build
```

Then, if tests exist:

```bash
npm test
```

If any command fails:
- explain the failure clearly
- identify whether it appears related to the change
- explain possible causes
- do not continue making edits without explanation

## User Workflow Preferences

The user prefers:
- plan first, then code
- exact field names
- exact setting names
- exact file names
- minimal diffs
- reversible changes
- explicit reasoning
- practical explanations
- Devvit validation before implementation
- no surprise refactors
- no invented APIs
- preservation of existing workflows

## Output Style

Be concise but complete.

Use numbered steps for plans.

For code changes, summarize:
- what changed
- why it changed
- files changed
- tests run
- remaining risks
- follow-up recommendations if relevant

## Safety and Reliability

If uncertain:
- say so explicitly
- inspect existing code patterns
- use Devvit MCP
- avoid guessing

Prefer correctness and maintainability over cleverness.

## Git Rules

- Never force push unless explicitly approved.
- Never delete branches unless explicitly approved.
- Never run git reset --hard unless explicitly approved.
- Never rewrite published history unless explicitly approved.
- Ask before interactive rebases.
- Ask before modifying worktree structure.
- Prefer small focused commits.
- Separate refactors from behavioral changes.
- Show git diff summaries before commits when practical.
- Avoid combining formatting-only changes with logic changes.
- Before committing:
  - summarize changed files
  - summarize purpose of changes
  - identify risky files if applicable
- Prefer staging only intended files instead of `git add .` when possible.
- Preserve clean commit history.

## Documentation Priority

When architecture.md, workflows.md, or devvit-notes.md define behavior:
- treat those files as repository source-of-truth
- prefer documented repository conventions over inferred patterns
- avoid contradicting documented architecture without approval
- recommend documentation updates when implementation changes behavior