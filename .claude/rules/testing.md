---
name: testing
description: Testing setup, gotchas, and TDD workflow rules. Loads when editing tests or test setup.
paths:
  - tests/**
  - vitest.setup.ts
  - vitest.config.ts
  - playwright.config.ts
  - packages/mcp-server/src/__tests__/**
---

## Test Runner

- **Use `bun run test`**, NOT `bun test`. `bun test` invokes Bun's built-in runner; `bun run test` delegates to vitest via package.json scripts.
- Watch mode: `bun run test:watch`
- Coverage: `bun run test -- --coverage` (target ≥80% statements/lines/functions, ≥75% branches).

## Test Layout

- `tests/ui/` — UI/component tests (React Testing Library)
- `tests/data/` — data logic, schemas, mappers; most sync tests live in `tests/data/sync/`
- `tests/sync/` — a few older sync tests, such as the engine and coordinator suites
- `tests/pb/` — PocketBase hooks and migrations (at-rest encryption, OAuth redirect, session revoke, account lifecycle, feedback controls)
- `tests/e2e/` — Playwright (auto-starts dev server via `playwright.config.ts`)
- `packages/mcp-server/src/__tests__/` — MCP server tests

## Type Checking

- `tsconfig.json` leaves `tests/` out, so the Vitest suites have their own program, `tsconfig.tests.json`. Run `bun run typecheck:tests`; CI runs it in the `typecheck` job.
- That program loads Vitest's globals and jest-dom's Vitest matchers. The app's program loads neither, so keep test types out of `tsconfig.json`.
- The MCP package has its own: `bun run --cwd packages/mcp-server typecheck:tests`, in the `mcp-coverage` job.
- Build task records with `createMockTask` and sync configs with `createMockSyncConfig` from `tests/fixtures`, so a newly required field needs one fix in the fixture.

## Testing Gotchas

- **`fake-indexeddb`** is auto-imported in `vitest.setup.ts` — no per-test setup needed.
- **`localStorage`** and `sessionStorage` are replaced in `vitest.setup.ts` with an in-memory store, because jsdom under Bun gets a broken stub. Both `removeItem(key)` and `clear()` work on the replacement.
- **`lib/sync/` tests**: most mock the client wrapper with `vi.mock('@/lib/sync/pocketbase-client')`. Only `tests/data/sync/pocketbase-client.test.ts` mocks the SDK with `vi.mock('pocketbase')`. Follow the pattern in existing sync tests.
- **E2E**: each test gets a fresh browser context, and specs that use the `clearIndexedDB` fixture also delete the database first. Root URL redirects to the about page on first load.
- Use `data-testid` attributes for stable Playwright selectors.

## TDD Workflow (Default)

1. **Red** — write a failing test that describes the expected behavior.
2. **Green** — write the minimum implementation that passes.
3. **Refactor** — clean up while keeping tests green.

Apply TDD for: new components/functions, bug fixes (reproduce-first), behavior-changing refactors.
Skip for: pure CSS, renames/moves with no logic change, docs.
