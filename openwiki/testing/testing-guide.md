# Testing Guide

The project uses **Vitest + React Testing Library** for unit/component/data tests and
**Playwright** for end-to-end tests. The MCP server has its own separate Vitest suite.

Config: `/vitest.config.ts`, `/vitest.setup.ts`, `/playwright.config.ts`. Team conventions:
`/.claude/rules/testing.md`.

---

## Running tests

```bash
bun run test          # Vitest (run once)  — NOT `bun test`
bun run test:watch    # Vitest watch mode
bun run test:e2e      # Playwright (auto-starts dev server)
bun run test:e2e:ui   # Playwright UI mode
```

> **Critical gotcha:** use `bun run test`, not `bun test`. `bun test` runs Bun's built-in
> runner instead of Vitest and will not behave correctly.

---

## Vitest (`/vitest.config.ts`)

- `globals: true`, `environment: "jsdom"`, `setupFiles: ./vitest.setup.ts`, `@` alias → repo
  root.
- Excludes `node_modules`, `dist`, `.claude/worktrees`, **`packages/mcp-server`** (its own
  suite), and `tests/e2e/**`.
- **Coverage** is disabled by default (enable with `--coverage`). Thresholds:
  statements **80**, lines **80**, functions **80**, branches **75**. Coverage includes
  `lib/`, `components/`, `app/`, `scripts/` and excludes barrels, config, `types.ts`, and
  `components/ui/**` (shadcn wrappers).

### Setup (`/vitest.setup.ts`)

- `fake-indexeddb/auto` is imported globally — **no per-test IndexedDB setup** is needed.
- In-memory `localStorage`/`sessionStorage` polyfills (Bun's jsdom stub lacks `clear()` /
  `removeItem()`), a `matchMedia` mock, `isContentEditable` polyfill, and Radix `Tooltip`
  mocked to fragments. Console noise (act warnings, dialog a11y, sync logs) is suppressed.

---

## Playwright (`/playwright.config.ts`)

- `testDir: ./tests/e2e`, `baseURL: http://localhost:3000`; auto-starts `bun run dev`
  (reused locally, fresh in CI).
- Runs Chromium, Firefox, WebKit. CI: `retries: 2`, `workers: 1`, `forbidOnly: true`. Traces
  on first retry; screenshots/video on failure.
- E2E notes: IndexedDB is cleared between tests; the root URL redirects to `/about` on first
  load; use `data-testid` selectors for stability. See `/tests/e2e/README.md`.

---

## Test layout (`/tests/`)

| Directory | Focus |
| --- | --- |
| `tests/ui/` | Component tests (RTL) |
| `tests/data/` | Data logic, schemas, mappers, hooks (with `analytics/`, `hooks/`, `notifications/`, `sync/`, `tasks/` subdirs) |
| `tests/sync/` | Sync engine, coordinator, health, retry, error categorizer |
| `tests/pb/` | PocketBase at-rest encryption (crypto, adapter, migration) |
| `tests/e2e/` | Playwright specs + `fixtures/`, `helpers/`, `pages/` (page objects) |
| `tests/utils/`, `tests/fixtures/` | Shared test helpers/fixtures |

`tests/suite-hygiene.test.ts` is a meta-test guarding suite health. MCP server tests live in
`packages/mcp-server/src/__tests__/`.

---

## TDD workflow (`/.claude/rules/testing.md`)

Default **Red → Green → Refactor**. Apply for new components/functions, bug fixes
(reproduce-first), and behavior-changing refactors. Skip for pure CSS, renames/moves with no
logic change, and docs-only changes.

---

## Gotchas

- **`bun run test`, not `bun test`.**
- **`fake-indexeddb`** is auto-imported — don't set up IndexedDB yourself in tests.
- **`localStorage.clear()` doesn't work** under Bun/jsdom — use `localStorage.removeItem(key)`
  in `beforeEach`.
- **Sync tests mock the SDK** via `vi.mock('pocketbase')`.
- **Coverage** is off by default; the helper `/scripts/test-coverage.sh` runs Vitest with
  coverage and checks lines ≥ 80%.

---

## Which tests to run for a change

- Domain/data changes (`/lib/tasks/`, `/lib/*.ts`, schema, db) → `tests/data/`.
- Sync changes (`/lib/sync/`) → `tests/sync/` + `tests/data/sync/`.
- UI changes (`/components/`, `/app/`) → `tests/ui/` and relevant `tests/e2e/` specs.
- MCP server (`/packages/mcp-server/`) → its own suite from within that package.
- Agent-pipeline scripts/workflows (`/scripts/*.cjs`, `/scripts/{builder,triage}-run.sh`,
  release workflows) → `tests/data/pipeline-workflows.test.ts` plus the matching root-level
  specs (`tests/{builder-run,triage-run,failing-agent-prs,telemetry-metrics,extract-run-tokens,prev-release-tag,parse-risk-tier}.test.ts`).
  See [Agent pipeline](../operations/agent-pipeline.md).
