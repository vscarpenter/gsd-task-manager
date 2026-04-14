# GSD Task Manager — Task Tracker

---

## Resuming From Here (2026-04-14)

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

