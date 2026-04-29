# Code Review & Standards Audit

**Date:** 2026-04-28
**Branch:** `claude/infallible-neumann-68a882`
**Audited against:** `coding-standards.md` v13
**Scope:** dead-code removal + standards compliance

---

## Executive summary

The April 22 audit graded the codebase A/A-. Since then, the **v9 single-matrix refactor** (commits `cc5c85e`, `912de38`, `616d90e`, `0296f94`, etc.) shipped a simpler UI but did not remove the v8 components it replaced. The largest finding of this review is **~30 orphaned files** in `components/` and `lib/` that have no production importers — only tests still exercise them.

| Category | Status | Δ since 2026-04-22 |
|---|---|---|
| Dead code | **NEW: ~30 files orphaned by v9 refactor** | regression |
| File/function size | A+ (3 borderline files) | unchanged |
| Type safety | A- (4 unjustified `any`, ~45 components missing return types) | unchanged |
| Tests | B+ (sync/CRUD modules still untested at unit level) | unchanged |
| Security | A (1 PostCSS moderate CVE) | new CVE |
| A11y | A | unchanged |
| Dependencies | A- (postcss <8.5.10, lucide-react 5 minors behind) | new |
| ADRs | A (10 ADRs; 0 gaps for v9 refactor) | regression |
| Hooks/observability | A | unchanged |

---

## 1. Dead code (verified)

Method: for each candidate, grepped `app/`, `components/`, `lib/`, `packages/` for import paths AND symbol names. Files listed below have **zero production importers** — only tests (or nothing) reference them.

### 1A. v8 UI surface superseded by v9 — DECISION REQUIRED

These are documented in CLAUDE.md as features (command palette, bulk operations, smart-view pills, etc.) but the v9 simplified shell does not mount them. Either CLAUDE.md is stale and these should be deleted, or the v9 refactor is incomplete and these need to be re-wired.

**Components (root-level, prod=0):**
| File | Tests still using it | Notes |
|---|---|---|
| `components/command-palette.tsx` (re-export) | 0 | wrapper |
| `components/command-palette/` (whole dir: `index.tsx`, `command-group.tsx`, `command-item.tsx`, `task-item.tsx`) | 2 test files | ⌘K palette |
| `components/settings-dialog.tsx` (re-export) | 0 | wrapper |
| `components/settings/settings-dialog.tsx` | 1 test file | modal version (replaced by `settings-page/`) |
| `components/user-guide-dialog.tsx` | 1 test file | replaced by v9 `help-drawer` |
| `components/inline-task-form.tsx` | 0 | replaced by v9 `capture-bar` |
| `components/notification-permission-prompt.tsx` | 0 | unused banner |
| `components/smart-view-pills.tsx` | 0 | header smart-view chips |
| `components/smart-view-selector.tsx` | 1 test file | smart-view picker |
| `components/save-smart-view-dialog.tsx` | 1 test file | |
| `components/bulk-actions-bar.tsx` | 1 test file | multi-select toolbar |
| `components/bulk-tag-dialog.tsx` | 1 test file | |
| `components/filter-bar.tsx` | 1 test file | v8 filter bar |
| `components/filter-panel.tsx` | 1 test file | v8 filter panel |
| `components/filter-popover.tsx` | 1 test file | imports `filter-due-date.tsx` |
| `components/filter-due-date.tsx` | 0 | only used by dead filter-popover |
| `components/keyboard-hints-toast.tsx` | 1 test file | |
| `components/matrix-empty-state.tsx` | 1 test file | replaced by v9 inline state |
| `components/matrix-skeleton.tsx` | 1 test file | replaced by v9 inline state |
| `components/import-dialog.tsx` | 1 test file | (export still works through settings) |
| `components/share-task-dialog.tsx` (re-export) | 0 | wrapper |
| `components/share-task-dialog/` (dir: `index.tsx`, `format-task-details.ts`, `share-tab-content.tsx`) | 0 | full subtree |
| `components/reset-everything-dialog.tsx` | 0 | |
| `components/snooze-dropdown.tsx` | 0 | |
| `components/task-description.tsx` | 0 | replaced by v9 edit-drawer inline |
| `components/task-timer.tsx` | 0 | |
| `components/task-form/` (dir: `index.tsx`, `use-task-form.ts`, `validation.ts`) | 2 test files | replaced by v9 capture-bar + edit-drawer |
| `components/task-form-dependencies.tsx` | 0 | only imported by dead `task-form/` |
| `components/task-form-subtasks.tsx` | 0 | only imported by dead `task-form/` |
| `components/task-form-tags.tsx` | 0 | only imported by dead `task-form/` |
| `components/tag-autocomplete-input.tsx` | 0 | |
| `components/tag-multiselect.tsx` | 0 | |
| `components/toggle-pill.tsx` | 0 | |
| `components/ui/sheet.tsx` | 0 | unused Radix sheet |
| `components/ui/slider.tsx` | 0 | unused Radix slider |

**Lib modules (prod=0):**
| File | Notes |
|---|---|
| `lib/bulk-operations.ts` | extracted from old MatrixBoard; no callers |
| `lib/confetti.ts` | only `canvas-confetti` consumer; both can go together |
| `lib/db-helpers.ts` | |
| `lib/matrix-filters.ts` | v8 filter logic |
| `lib/pwa-detection.ts` | |
| `lib/use-matrix-dialogs.ts` | hook for old MatrixBoard dialogs |
| `lib/use-smart-view-shortcuts.ts` | 1-9 number-key shortcuts (replaced?) |
| `lib/use-command-palette.ts` | hook for command palette (dead) |
| `lib/z-index.ts` | |

**Dependencies that become removable if the above goes:**
- `canvas-confetti` (1.9.4) + `@types/canvas-confetti` — only used by `lib/confetti.ts`
- `cmdk` (1.1.1) — only used by `components/command-palette/`
- `@radix-ui/react-slider` (1.3.6) — only used by `components/ui/slider.tsx`
- Verify before removing: `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu` (likely still used by remaining dialogs/menus)

### 1B. Unambiguously safe to remove

These have no production AND no test references:
- `lib/z-index.ts` (no test even)
- `components/ui/sheet.tsx`
- `components/ui/slider.tsx`
- `components/inline-task-form.tsx`
- `components/notification-permission-prompt.tsx`
- `components/smart-view-pills.tsx`

### 1C. Stale documentation

CLAUDE.md describes as active features things that are no longer present in production code:
- "Command Palette — Global ⌘K/Ctrl+K shortcut" (dead)
- "Smart Views — Pin up to 5 smart views to header (keyboard shortcuts 1-9, 0 to clear)" (dead — `use-smart-view-shortcuts.ts` orphaned)
- "Bulk Operations" / `bulk-actions-bar.tsx`, `bulk-tag-dialog.tsx` (dead)
- "iOS-style Settings — Redesigned settings with grouped layout and modular sections" — replaced by `settings-page/` (still alive but description is for old `settings-dialog`)

CLAUDE.md and `components/user-guide/*` documentation reference shortcuts (`⌘K`, "command palette", number-key smart views) that don't work in production.

---

## 2. Standards compliance gaps

### 2A. Type safety (HIGH)

Unjustified `any` in production:
- `components/install-pwa-prompt.tsx:40` — Safari `navigator.standalone` cast (no comment)
- `lib/db.ts:141, 322, 328` — Dexie `modify()` callbacks (need a one-line comment)

Missing return types on ~45 exported React components. Spec requires explicit return types on all function signatures. Examples: `SmartViewSelector`, `FilterPanel`, `AppFooter`, `InstallPwaPrompt`. Many of these are in dead components — fixing only the live ones is cheaper.

### 2B. File size (LOW — borderline)

- `lib/db.ts` — 353 lines. Schema migrations (versions 1-13) inline. Extracting to `lib/db-migrations.ts` would drop it under 250.
- `components/smart-view-selector.tsx` — 335 lines. Likely deleted as part of dead-code removal.
- `packages/mcp-server/src/write-ops/task-operations.ts` — 328 lines. Legitimate complexity.

### 2C. Test coverage gaps (HIGH for live code)

After dead code is removed, the remaining gaps from the prior April audit still apply:
- `lib/sync/pb-push.ts`, `pb-pull.ts`, `pb-sync-helpers.ts` — push/pull engine has no unit tests
- `lib/sync/sync-provider.tsx`, `lib/sync/config/{enable,disable,reset,get-set}.ts`
- `lib/tasks/crud/*` — only barrel-tested, not unit-tested
- `packages/mcp-server/src/tools/handlers/{write,system,read,analytics}-handlers.ts`
- `lib/schema.ts`, `lib/quadrants.ts` — pure logic, easy wins

If we remove the dead code listed in section 1, we also delete a meaningful number of tests. Net coverage % should rise (we drop tested-but-dead code from both numerator and denominator) but verify with `bun run test -- --coverage` after removal.

### 2D. Security (MEDIUM)

`bun audit`: 1 moderate vulnerability — `postcss <8.5.10` (XSS via unescaped `</style>`, GHSA-qx2v-qp2m-jg93). Currently pinned at `8.5.8`. Fix: bump to `8.5.10+` in root `package.json`.

### 2E. Dependencies (LOW)

- 29 packages have minor updates available
- `lucide-react` is 5+ minor versions behind (1.7.0 → 1.12.0)
- All deps pinned (no floating ranges) — compliant
- `overrides` block in root `package.json` is documented and serves security purpose — keep

### 2F. ADRs (LOW)

10 ADRs exist for major decisions. Missing:
- ADR for v9 single-matrix refactor (architectural pivot — should be 0011)
- ADR for static-export deployment (lower priority)
- ADR for OAuth provider selection (lower priority)

### 2G. Magic numbers (LOW)

Two `150ms` timeouts could be extracted:
- `components/inline-task-form.tsx:156` (will be deleted)
- `components/pwa-update-toast.tsx` had a flagged line, but I could not reproduce the finding — likely a false positive

---

## 3. Phased remediation plan

Each phase is an independent PR that can ship without the others.

### Phase 1 — Confirm-and-delete unambiguous dead code
**Scope:** Files in section **1B** only. No CLAUDE.md changes needed.
**Files removed:** 6 files + 1 dependency check
- `components/ui/sheet.tsx`, `components/ui/slider.tsx`
- `components/inline-task-form.tsx`, `components/notification-permission-prompt.tsx`, `components/smart-view-pills.tsx`
- `lib/z-index.ts`
- Drop `@radix-ui/react-slider` from `package.json` (used only by deleted slider.tsx)

**Verification:** `bun run test && bun typecheck && bun lint && bun run build`
**Risk:** Very low. None of these files have any importers.

### Phase 2 — Decision point: v9 surface area
**Action required from user, not Claude.** Before deleting the v8 components in section **1A**, decide for each cluster:

| Feature cluster | Files | Decision |
|---|---|---|
| Command palette (⌘K) | `components/command-palette/*`, `lib/use-command-palette.ts` | **resurrect or delete?** |
| Smart-view pinning + 1-9 shortcuts | `components/smart-view-pills.tsx`, `lib/use-smart-view-shortcuts.ts` | **delete (already in 1B for pills)** or rewire? |
| Bulk multi-select | `components/bulk-actions-bar.tsx`, `bulk-tag-dialog.tsx`, `lib/bulk-operations.ts` | resurrect or delete? |
| Filter panel | `components/filter-{bar,panel,popover,due-date}.tsx`, `lib/matrix-filters.ts` | delete (v9 has no filter UI) |
| Settings modal | `components/settings-dialog.tsx`, `components/settings/settings-dialog.tsx` | delete (use `settings-page/`) |
| User-guide modal | `components/user-guide-dialog.tsx` | delete (v9 uses help-drawer) |
| Task-form modular | `components/task-form/*`, `task-form-{deps,subtasks,tags}.tsx` | delete (v9 capture-bar + edit-drawer) |
| Share / snooze / timer / description | `components/share-task-dialog/*`, `snooze-dropdown.tsx`, `task-timer.tsx`, `task-description.tsx`, `reset-everything-dialog.tsx`, `import-dialog.tsx` | per-feature decision |
| Empty/skeleton states | `components/matrix-{empty-state,skeleton}.tsx` | delete |
| Old hooks | `lib/use-matrix-dialogs.ts`, `lib/db-helpers.ts`, `lib/pwa-detection.ts`, `lib/confetti.ts` | delete |

**For "delete" path:** also remove paired tests and update CLAUDE.md to remove obsolete feature claims.
**For "resurrect" path:** open a separate spec/issue per feature; do not bundle with cleanup.

### Phase 3 — Standards fixes (independent of phases 1-2)
- [ ] Add justification comments to 4 unjustified `any` casts (15 min)
- [ ] Add `: React.ReactElement` return type to all live exported components (~2 hr; do AFTER phase 2 to avoid touching dead files)
- [ ] Bump `postcss` override to `>=8.5.10` (5 min) — addresses CVE
- [ ] Bump `lucide-react` to latest 1.12.x (15 min, scan for breaking icon renames)
- [ ] Extract `lib/db.ts` schema migrations to `lib/db-migrations.ts` (~30 min)

### Phase 4 — Test gap fill (largest)
Pick top-5 untested critical modules and add tests TDD-style. From April audit:
- [ ] `lib/sync/pb-push.ts`
- [ ] `lib/sync/pb-pull.ts`
- [ ] `lib/tasks/crud/{create,update,delete}.ts`
- [ ] `packages/mcp-server/src/tools/handlers/write-handlers.ts`

Defer remaining ~20 untested modules to follow-up tickets.

### Phase 5 — ADR for v9 (15 min)
Write `docs/adr/0011-v9-single-matrix-refactor.md` documenting:
- Decision: collapse 4-quadrant grid + filter panel + command palette into single matrix + capture bar
- Consequences: simpler UX, ~30 components removed
- Alternatives considered: keep v8 with feature flag, do nothing

---

## 4. Verification commands

After each phase:
```bash
bun run test              # vitest, must pass
bun typecheck             # no errors
bun lint                  # no errors
bun run build             # static export must succeed
bun run test -- --coverage   # confirm coverage didn't drop on live code
```

Phase 1 should produce a single ~6-file PR that's trivial to review. Phase 2 should be split per-feature-cluster (one PR per row of the decision table) so each cleanup is independently reviewable and revertable.

---

*Generated by code review agent — verified via grep, not just LLM inference.*
