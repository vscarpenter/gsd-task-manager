# GSD Task Manager — Task Tracker

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

#### 1. Wire `components/command-palette/` back into the v9 shell (cluster-1 resurrection)
- **Why:** v8 command palette was kept (not deleted) when v9 shipped, but never mounted. CLAUDE.md and ADR 0011 both promise the feature exists; right now ⌘K does nothing.
- **Where to start:** `components/matrix-simplified/app-shell.tsx`. Mount `CommandPalette` from `@/components/command-palette` similarly to how `HelpDrawer` is mounted (state + window event listener). Wire ⌘K via `lib/use-command-palette.ts` (already keybound internally). Pass handlers built from `lib/command-actions.ts`.
- **Acceptance criteria:**
  - Pressing ⌘K (Mac) / Ctrl+K (other) anywhere in the app opens the palette
  - Palette returns the action set defined in `command-actions.ts` (new task, theme toggle, navigation, export, etc.)
  - Selecting a task navigates / opens the edit-drawer
  - Esc closes; existing palette tests still pass
  - `keyboard-hints-toast` was deleted in this cleanup, so do NOT re-introduce keyboard-hints; surface ⌘K hint in the topbar or help-drawer instead
- **Effort:** ~2-3 hours. Mostly wiring; tests already cover the palette internals.
- **Spec first:** write `tasks/spec-command-palette-v9.md` per coding-standards.md before touching code.

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

#### 6. Adopt `knip` or `ts-prune` for periodic dead-code detection
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

