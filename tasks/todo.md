# GSD Task Manager — Task Tracker

---

## In progress — 2026-05-31: Smart-view strip overflow → "More" menu

**Problem:** `SmartViewStrip` renders 10 pills in a single `overflow-x-auto` row with a hidden scrollbar. The last pills clip off-screen with no affordance (see screenshot). User chose the **"More" overflow menu** fix.

**Tier:** Standard (one component subtree, no new public contract; real measurement logic → test-first).

**Design:**
- "All tasks" pill pinned inline first. As many view pills as fit render inline; the rest collapse into a Radix `DropdownMenu` triggered by a "More ▾" button.
- Measurement via a hidden, `aria-hidden` ghost row rendering all pills at natural width → read offsetWidths → pure greedy `computeVisibleViewCount()` decides the inline count. Recompute on mount + `ResizeObserver`.
- Reuse `components/ui/dropdown-menu.tsx` (Radix → free keyboard nav / focus / Escape / click-outside / `role=menu`).
- If the active view lives in the overflow set, mark the "More" button active so users see their filter is still applied.

**Files:**
- `components/matrix-simplified/use-smart-view-overflow.ts` — pure `computeVisibleViewCount` + `useSmartViewOverflow` hook.
- `components/matrix-simplified/smart-view-strip.tsx` — rewrite to use the hook + ghost + More menu.
- `tests/ui/smart-view-strip.test.tsx` — pure-fn algorithm cases + render/interaction tests.

**Acceptance:**
- [x] No pill clips off-screen at any container width; overflow pills are reachable via the More menu.
- [x] Selecting a view (inline or in menu) applies it; "All tasks" clears.
- [x] Active overflow view reflected on the More button.
- [x] Ghost layer is `aria-hidden` + `inert`; no duplicate buttons for AT.
- [x] `computeVisibleViewCount` covered: all-fit, none-fit, exact boundary, reserve-more boundary, empty.

**Review (2026-05-31 — done):**
- Implemented test-first (red/green/refactor): pure `computeVisibleViewCount` + presentational `SmartViewOverflowMenu` + strip behaviors + a faked-layout test driving the real measurement path.
- Verified in **real Chromium** (the gate jsdom can't own): at 1400px → 8 inline + "More (2)"; at 760px → 4 inline + "More (6)"; menu reveals overflow views w/ icons; selection applies; active-overflow filter surfaced in the More button's accessible name; **no horizontal page scrollbar** (scrollWidth === clientWidth).
- a11y-reviewer: 0 blocking. Fixed IMPORTANT (`role="group"` on the pill row — `aria-label` on a bare div is dropped by AT) + nit (comment on `aria-current` vs `aria-pressed`).
- Graceful degradation: unmeasured/zero-width container → show all inline (fixed a broken matrix-simplified test that relied on inline pills under jsdom's no-layout).
- Coverage: strip 96% / hook 95% (both >80% DoD). Full suite 1920 pass, typecheck 0, lint 0.
- Files: `smart-view-strip.tsx` (rewrite), `use-smart-view-overflow.ts` (new), `tests/ui/smart-view-strip.test.tsx` (new).
- **Not committed** — awaiting user go-ahead.

---

## Pending plan — 2026-05-18: GitHub Actions CI/CD deploy pipeline

Move dev + prod app deploys off laptops into GitHub Actions (OIDC, no long-lived keys), wire the `typecheck`/`lint`/`test`/`build` PR status checks already declared in `REPOSITORY_SETTINGS.md`, and gate CloudFront infra changes behind manual approval. 5-phase rollout, one PR per phase.

Full plan: `docs/superpowers/plans/2026-05-18-github-ci-deploy-pipeline.md`

Status: **Proposed — awaiting review.** Open decisions in §7 of the plan.

---

## Pending plan — 2026-05-18: Codex adversarial review fixes

5-PR plan addressing silent data-loss paths in sync/MCP/import.
Full plan: `docs/superpowers/plans/2026-05-18-codex-adversarial-review-fixes.md`

PR order (low risk → high):
1. PR1 — sync history `status='partial'` (Finding 5)
2. PR2 — replace import queues remote deletes (Finding 4)
3. PR3 — pull cursor clamp + overlap window (Finding 3)
4. PR4 — push LWW timestamp guard (Finding 1, **critical**)
5. PR5 — MCP `updateTask` fresh read + preflight check (Finding 2)

---

## Follow-ups from PR1 (Codex Finding #5 review) — 2026-05-18

- [ ] Render `failedCount` and `partialSyncs` in `app/(sync)/sync-history/page.tsx` (currently written but not displayed). Add a "Partial" stat tile and a "{failedCount} failed" line on partial rows.
- [ ] Status-driven coloring for the error pill on partial rows (line ~225-229) — currently hardcoded red regardless of status.
- [ ] Consolidate the three `recordSync{Success,Error,Partial}` writers into one helper or normalize their signatures (positional vs. options-object).

---

## Active task — 2026-05-14: Apply Inkwell Design System (1.3.1)

**Goal:** Make Inkwell 1.3.1 the canonical token + component source, wired through Tailwind v4's official integration. Eliminate the v3-style `tailwind.config.ts` as a competing styling system. Preserve GSD-specific tokens (quadrants, status, custom type scale) and the 1.5px border identity.

**Source of truth:** `https://github.com/vscarpenter/inkwell` `main` — `agent-instructions.md`, `DESIGN_SYSTEM.md`, `TAILWIND.md`, `inkwell-{tokens,components,theme}.css`.

### Findings from audit

- GSD already uses Inkwell-style tokens (`--ivory`, `--paper`, `--slate`, `--accent`) and applies Inkwell component classes (`.btn`, `.badge`, `.input`).
- Old monolithic Inkwell shim (`public/css/tokens.css`, 929 lines) is loaded via a `<link>` tag, *outside* Tailwind v4. Modern Inkwell ships as a 3-file split with an official `@theme` integration.
- `tailwind.config.ts` redeclares Inkwell tokens v3-style via `@config` — the competing system the user wants eliminated.
- `borderWidth: { DEFAULT: "1.5px" }` is load-bearing: bare `border` utility is used widely. Must preserve.
- Quadrant + status tokens are GSD-specific (not in Inkwell). Must migrate to `@theme` block.
- Dynamic class construction: none. All `bg-quadrant-*` / `bg-status-*` are static string literals. v4 scanner picks them up.
- A few hardcoded hex anti-patterns: `.overdue-task`, `complete-flash`, dialog `bg-black/40`.

### Plan (checkable items)

- [ ] Vendor Inkwell 1.3.1 into the bundler's reach (`app/css/inkwell-tokens.css`, `app/css/inkwell-components.css`, `app/css/inkwell-theme.css`).
- [ ] Refresh the public-facing copy at `public/css/{inkwell,tokens,inkwell-tokens,inkwell-components}.css` to match 1.3.1 (for any external consumer or service-worker cache).
- [ ] In `app/globals.css`: replace `@config "../tailwind.config.ts"` with `@import "./css/inkwell-theme.css";`. Add GSD-specific tokens (quadrant, status, custom type scale) inside a `@theme` block. Preserve the 1.5px border default via `@utility border { border-width: 1.5px; }`. Remove duplicate bridge aliases where Inkwell already provides the token.
- [ ] Remove the `<link rel="stylesheet" href="/css/inkwell.css">` from `app/layout.tsx` — Inkwell is now bundled via PostCSS.
- [ ] Delete `tailwind.config.ts` (no longer referenced).
- [ ] Anti-pattern sweep: replace hardcoded hex in `.overdue-task`, `complete-flash` with Inkwell tokens. Switch dialog overlay from `bg-black/40` to `var(--backdrop)`.
- [ ] Verify: `bun typecheck`, `bun lint`, `bun run test`, manual visual smoke test of the matrix shell in light + dark.

### Anti-goals (out of scope for this PR)

- Rewriting `.redesign-scope` / `.matrix-card` / `.rd-*` CSS into Inkwell classes — app-specific layer, not competing system.
- Migrating `border` → `border-hair` codebase-wide (preserved as project-specific override).
- Touching MCP server, sync engine, or any non-styling code.

---

## Resuming From Here (2026-04-28)

### Just Completed — v9 cleanup (Phases 1, 2, 3) on `claude/infallible-neumann-68a882`
Two commits, one PR:

**Commit 1 (Phases 1+3):** 6 unambiguously dead files removed; `@radix-ui/react-slider` dep dropped; `postcss` 8.5.8 → 8.5.10 + override (CVE GHSA-qx2v-qp2m-jg93 cleared); version 8.7.23 → 8.7.24.

**Commit 2 (Phase 2):** ~30 v8 surface files removed per user's per-cluster decisions. Cluster outcomes:
- Command palette: kept (resurrect later)
- Smart-view 1-9 shortcuts, smart-view UI, bulk multi-select, filter panel, settings modal, user-guide modal + wizard, modular task-form, tag inputs, share-task-dialog, matrix empty/skeleton states: deleted
- Cluster 11 split: `task-timer` and `import-dialog` kept (still wired); `snooze-dropdown`, `task-description`, `reset-everything-dialog` initially flagged dead but **restored after re-verification** — they're imported by `task-card-*.tsx` / `data-management.tsx`. Audit had a transitive-import gap (lazy/nested usage). `keyboard-hints-toast` deleted (truly dead).
- ADR 0011 written; CLAUDE.md updated.
- Version bumped 8.7.24 → 8.8.0 (substantial cleanup).

Verification on Phase 2 commit:
- `bun audit` — 0 vulnerabilities
- `bun typecheck` — clean
- `bun lint` — 5 warnings (1 fewer than baseline; unused-eslint-disable in deleted block)
- `bun run test` — 1773 passed (5 pre-existing edit-drawer failures unrelated; 315 fewer total because dead-code tests removed)
- `bun run build` — static export OK

PR: https://github.com/vscarpenter/gsd-task-manager/pull/238

### Open follow-ups

Each item below is sized to be a single self-contained PR. Pick any one cold and start.

#### 1. Wire `components/command-palette/` back into the v9 shell (cluster-1 resurrection) — ✅ DONE 2026-05-24
- Spec: `tasks/spec-command-palette-v9.md`.
- Implementation: added `showSmartViews` prop to `CommandPalette`, new `lib/use-shell-command-handlers.ts`, mounted palette in `AppShell`. Smart-view actions suppressed in v9 per ADR 0011.
- Tests: new `tests/ui/app-shell.test.tsx` (5 tests). Full suite: 1893 passing.
- Deferred: topbar ⌘K hint chip; deep-link export/import (handlers currently route to `/settings`); surfacing the new-task event listener on the matrix page (currently routes to `/?action=new-task` which the matrix already handles).

#### 2. Add explicit return types to live exported components
- **Why:** April 22 audit + 2026-04-28 review both flagged this. Standard requires `: React.ReactElement` (or `: JSX.Element`) on every exported component function. ~45 sites missing.
- **Where to start:** `components/matrix-simplified/*.tsx`, `components/task-card/*.tsx`, `components/settings-page/*.tsx`, `components/dashboard/*.tsx`, `components/about/*.tsx`, root-level live components. Skip `components/ui/*` (mostly typed via Radix already).
- **Acceptance criteria:**
  - Every exported component declared with `function Foo(...)` or `const Foo = (...) =>` has an explicit return type
  - `bun typecheck` clean; no behavior change
- **Effort:** ~2 hours, mechanical.
- **Tip:** can be split into 2-3 PRs by directory if the diff feels too large.

#### 3. Bump `lucide-react` 1.7.0 → 1.12.x
- **Why:** 5 minor versions behind. Risk: icon renames or removals between minors.
- **Where to start:** `package.json` dep + `bun install`. Then grep all `lucide-react` imports across `components/` for icons that may have been renamed in 1.8-1.12 release notes.
- **Acceptance criteria:**
  - All current icon imports still resolve
  - Visual smoke check: matrix view, capture-bar, edit-drawer, settings page, task card all render their icons
  - `bun typecheck` clean, tests pass, build succeeds
- **Effort:** ~30 min if no renames; ~1 hr if a few icons need renaming.
- **Anti-goal:** do NOT bundle other dep bumps — keep this isolated for easy revert if visual regression appears.

#### 4. Phase 4 — unit tests for critical untested modules (carryover from April 22 audit)
- **Why:** These modules can silently corrupt user data or fail sync. They had no unit tests before this PR and still don't.
- **Where to start:**
  - `lib/sync/pb-push.ts` (push engine; mock PocketBase; test happy path + auth fail + 429 + network error)
  - `lib/sync/pb-pull.ts` (pull engine; test merge with LWW timestamps + conflict resolution)
  - `lib/tasks/crud/{create,update,delete}.ts` (only barrel-tested today; need direct unit tests with cascade scenarios)
  - `packages/mcp-server/src/tools/handlers/write-handlers.ts` (external agents executing untested mutations)
- **Acceptance criteria:**
  - Each module has ≥80% line coverage (per project threshold in `vitest.config.ts`)
  - Tests are behavior-named, follow Arrange-Act-Assert, include both positive and negative cases
  - TDD enforced: write red test before implementation tweaks (per `.claude/commands/tdd`)
- **Effort:** ~14 hours total. Can split into 4 PRs (one per module group).

#### 5. Investigate the 5 pre-existing `tests/ui/edit-drawer.test.tsx` timeouts
- **Why:** These predate this PR (visible in baseline before any changes) but they fail every CI run. Either fix or delete.
- **Where to start:** `tests/ui/edit-drawer.test.tsx`. All 5 failures are `Test timed out in 5000ms.` — likely an unresolved promise or missing `await act()` around state-setting effects in `components/matrix-simplified/edit-drawer.tsx` (which already has a lint warning at line 62 about `setState in effect`).
- **Acceptance criteria:**
  - Either the tests pass deterministically (root-cause fix in component or test) or the tests are deleted with a short note in commit message
- **Effort:** ~1-2 hours debugging.

#### 6. E2E test gaps left by v9 surface removal (2026-05-11)
- **Why:** The original `tasks/e2e-testing-spec.md` was written generically and assumes UI affordances that v9 removed (per ADR 0011). The implemented suite covers the v9 surface; the items below are gaps **by design**, not omissions.
- **Smart views (`smart-views.spec.ts` from spec § Test Stubs):** Not implementable. v9 deleted the smart-view pinning UI, the 1-9 keyboard shortcuts, and the `useSmartViewShortcuts` hook. The Dexie `smartViews` table is retained for data continuity but has no entry point in the UI. **Action:** revisit if smart views are ever resurrected (similar to the planned command-palette resurrection in #1 above).
- **Search by subtask (`search.spec.ts` stub):** Search filter logic includes subtask titles in the haystack (covered by unit tests), but v9's edit drawer exposes no subtask editor — only a count badge on task cards. To exercise this end-to-end, either resurrect a subtask editor or seed subtasks via JSON import in a fixture.
- **Archive navigation:** The `/archive` route exists and is reachable from `Settings → Archive → View archive`, but that link is conditional on `archivedCount > 0`. Direct `page.goto('/archive')` works but doesn't validate the user-facing path. To cover this, the test would need to seed archived tasks first (via import, or by completing a task and triggering auto-archive with a backdated `completedAt`).
- **Effort to close:** ~3-4 hours, but blocked on UI decisions for smart views and subtasks.

#### 7. Adopt `knip` or `ts-prune` for periodic dead-code detection
- **Why:** This PR's audit used regex grep against import paths and **missed 5 transitive/lazy imports** (documented in ADR 0011's audit-gap section). A TS-compiler-API-based tool would catch them. Without one, the next "v10 refactor without cleanup" will need another manual review.
- **Where to start:** evaluate `knip` (more comprehensive, knows Next.js conventions) vs `ts-prune` (smaller, simpler). Add as a dev dep with config that:
  - Whitelists Next.js conventional entrypoints (`app/**/page.tsx`, `app/**/layout.tsx`, `next.config.ts`, etc.)
  - Whitelists test entrypoints
  - Whitelists `lazy()` and `dynamic()` imports
- **Acceptance criteria:**
  - `bun knip` (or equivalent) runs in CI and reports 0 findings on a clean checkout
  - Future dead code surfaces automatically
  - Optionally: add a Stop hook in `.claude/settings.json` to run it weekly per coding-standards.md guidance
- **Effort:** ~1 hour to install + configure + tune. Worth doing before the next v10/refactor cycle.

---

## Previous: Resuming From Here (2026-04-14)

### Recently Completed
- UX review implementation phases 1-3 (April 2026)
- Pre-launch checklist fixes
- Coding standards alignment updates

### Active Work — Coding Standards Compliance Sprint

Comprehensive audit completed against `coding-standards.md`. 24 issues identified.

**P1 — Critical:**
- [x] Fix 4 failing tests (`localStorage.clear` — replaced with targeted `removeItem` calls + added Storage polyfill in vitest.setup.ts)
- [ ] Add tests for 5 sync module files (background-sync, pb-auth, pb-realtime, pocketbase-client, notifications)
- [ ] Increase lib/db.ts coverage from 28% to 80%

**P2 — High:**
- [ ] Refactor TaskForm (245-line function → focused sub-components)
- [ ] Refactor FilterPanelComponent (272-line function → focused sub-components)
- [x] Replace `window.alert()` with `toast.error()` in smart-view-selector.tsx
- [ ] Write 6 missing ADRs (docs/adr/0004–0009): PWA, MCP, analytics, notifications, BFS algorithm, smart views
- [ ] Add tests for settings components (currently 0% coverage)
- [ ] Add tests for lib/reset-everything.ts (currently 0% coverage)
- [ ] Add tests for command palette (currently 0% coverage)

**P3 — Medium:**
- [ ] Add explicit return types to 15+ exported functions in lib/analytics/*, lib/archive.ts
- [ ] Create .claude/ directory (agent definitions + slash commands)
- [ ] Create root .env.example
- [ ] Document package.json dep rationale in CLAUDE.md
- [ ] Increase time-tracking CRUD coverage from 25% to 80%

**P4 — Low:**
- [x] Add `aria-label` to recurrence icon (task-card-actions.tsx:48)
- [ ] Extract magic numbers to named constants in lib/constants.ts
- [ ] Promote April 2026 audit lessons to CLAUDE.md
- [ ] Split multi-concept tests into single-assertion tests
- [ ] Add basic tests for About page + User Guide components

### Blockers
None currently.

### Next Session Starting Point
1. Run `bun run test -- --coverage` to see coverage delta
2. Resume sync module tests (`p1-sync-module-coverage`) — use `vi.mock('pocketbase')` pattern from existing tests
3. Check any outstanding agent results from current sprint

---

## Archived: UX Review (April 2026) — Complete ✅

**Review Date:** 2026-04-01 | **Source:** External UX review of gsd.vinny.dev

### Phase 1 — Quick Wins ✅
- [x] Simplify empty state with progressive disclosure
- [x] Add `destructive` button variant + migrate 4 components
- [x] Fix "Search..." ellipsis to "Search"
- [x] Add keyboard shortcut hints to header tooltips
- [x] WCAG AA contrast fix on accent color

### Phase 2 — Medium Effort ✅
- [x] Improve navigation hierarchy
- [x] Undo coverage audit (archive + smart view delete)
- [x] Touch targets increased to 44px minimum on mobile
- [x] "Saved locally" indicator for non-sync users

### Phase 3 — Polish ✅
- [x] Typography audit — already well-constrained
- [x] Card consistency audit — Matrix + Archive use TaskCard
- [x] Smart View language clarification (info tooltip)

---

## Follow-ups from PR5 (Codex Finding #2 review) — 2026-05-18

- [ ] Decompose `updateTask` (~126 lines) and `bulkUpdateTasks` (~149 lines) in `packages/mcp-server/src/write-ops/`. Suggested extractions: `buildUpdatedTask(currentTask, input)`, `diffChanges(currentTask, input)`, `writeOneWithPreflight(...)`. Both are well over the 40-line standard.
- [ ] Unify the conflict surface: have `bulk-operations.ts` catch `ConflictError` from a shared `writeOneWithPreflight` helper and push `err.taskId` to `conflicts`. Eliminates the duplicated `if (preflight.clientUpdatedAt !== X)` comparison and gives one definition of "conflict."
- [ ] Verify whether PocketBase rate-limits all requests or only writes. If all requests, the bulk preflight doubles request count but the throttle only sleeps between iterations — may still trip 429s on large bulks. Either apply throttle to both preflight and write, or document the assumption.
- [ ] Pre-existing `findPBRecordId` in `helpers.ts` has the same silent-error-swallowing flaw fixed in PR5 for `fetchSinglePBTaskFresh`. Apply the same `status === 404` discrimination there.
- [ ] Add lessons.md entry: MCP write-path test fixtures didn't catch the original stale-spread bug because mocks never went stale between calls. Future tests should exercise the read→write timeline, not just data shapes.

