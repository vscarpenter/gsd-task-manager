# GSD Task Manager — Task Tracker

---

## Resuming From Here (2026-04-28)

### Just Completed — Phase 1 + Phase 3 of v9 cleanup
Single commit on `claude/infallible-neumann-68a882`:
- Deleted 6 unambiguously dead files (zero importers anywhere): `components/ui/sheet.tsx`, `components/ui/slider.tsx`, `components/inline-task-form.tsx`, `components/notification-permission-prompt.tsx`, `components/smart-view-pills.tsx`, `lib/z-index.ts`
- Removed `@radix-ui/react-slider` dep (only consumer was deleted slider.tsx)
- Bumped `postcss` 8.5.8 → 8.5.10 + added override (CVE GHSA-qx2v-qp2m-jg93 cleared; `bun audit` now clean)
- Bumped version 8.7.23 → 8.7.24

Verification:
- `bun audit` — 0 vulnerabilities
- `bun typecheck` — clean
- `bun lint` — 6 warnings (unchanged from baseline)
- `bun run test` — 2088 passed (5 pre-existing edit-drawer failures unrelated)
- `bun run build` — static export OK

### Active — Code review 2026-04-28 follow-ups
Full review at `tasks/code-review-2026-04-28.md`.

**Phase 2 (BLOCKED on user decision):** ~30 v8 components orphaned by v9 single-matrix refactor. CLAUDE.md still describes some as features (command palette, bulk multi-select, smart-view 1-9 shortcuts). Need per-cluster decisions: delete vs resurrect. See section 1A and Phase 2 decision table in the review doc.

**Phase 3 deferred items:**
- [ ] Add `: React.ReactElement` return type to ~45 live exported components — defer until AFTER Phase 2 to avoid touching files that may be deleted
- [ ] Bump `lucide-react` 1.7.0 → 1.12.x (5 minor versions) — separate PR with visual smoke test for icon renames
- [ ] Write ADR `docs/adr/0011-v9-single-matrix-refactor.md`

**Phase 4 (carryover from April 22 audit):** unit tests for sync engine + tasks/crud + MCP write handlers.

**Phase 3 items NOT applicable (false positives in agent reports):**
- 4 `any` casts already have justification comments + eslint-disable directives
- `lib/db.ts` 353 lines is within "approximately 350-400" tolerance; splitting Dexie migrations is risky for marginal gain

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

