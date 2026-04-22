# Coding Standards Audit & Remediation Plan

**Date:** April 22, 2026  
**Audited Against:** `coding-standards.md` (v13)  
**Scope:** All production code in `app/`, `components/`, `lib/`, `packages/`

---

## Executive Summary

The codebase is in **excellent overall health**. No critical security vulnerabilities, no architectural issues, and strong adherence to the majority of coding standards. The primary gaps are **test coverage on critical modules** and **minor type safety improvements**.

| Category | Grade | Violations |
|---|---|---|
| Code Quality (file size, functions, nesting, naming) | **A+** | 0 |
| Type Safety | **A-** | 3 minor |
| Testing | **B+** | 8 modules at 0% coverage |
| Error Handling | **A-** | 5 issues |
| Security | **A** | 0 |
| Accessibility | **A** | 0 |
| Dependencies | **A-** | 1 floating version |
| Configuration | **A** | 0 |
| Architecture & Docs | **A** | 0 |
| Logging & Observability | **A** | 0 |

---

## Detailed Findings

### 1. Code Quality — A+ ✅

**No violations found.** The codebase exemplifies the standards:

- All files under 350 lines (modular split into `lib/sync/`, `lib/analytics/`, `lib/notifications/`, `components/task-form/`, etc.)
- Functions consistently under 40 lines with single responsibility
- Maximum 3 levels of nesting; effective use of early returns and guard clauses
- Zero TODOs without context, zero `console.log` in production code (only in `lib/logger.ts` itself)
- All magic numbers centralized in `lib/constants/`
- Consistent naming: PascalCase (components/types), camelCase (functions), kebab-case (files)

### 2. Type Safety — A-

**TypeScript strict mode is enabled.** Only 3 production `any` usages exist, all justified with comments. Two minor gaps remain:

| Finding | Location | Severity |
|---|---|---|
| 8 custom hooks lack explicit return type annotations | `lib/use-*.ts`, `lib/pwa-detection.ts` | Low |
| 1 `any` without justifying comment | `lib/pwa-detection.ts` ~L13 | Low |
| 0 `@ts-ignore`/`@ts-expect-error` in production | — | ✅ Clean |

**Hooks missing return types:**
- `useErrorHandler()` in `lib/use-error-handler.ts`
- `useErrorHandlerWithUndo()` in `lib/use-error-handler.ts`
- `useAutoArchive()` in `lib/use-auto-archive.ts`
- `useViewTransition()` in `lib/use-view-transition.ts`
- `useCommandPalette()` in `lib/use-command-palette.ts`
- `useMatrixDialogs()` in `lib/use-matrix-dialogs.ts`
- `useDragAndDrop()` in `lib/use-drag-and-drop.ts`
- `getPlatformInfo()` in `lib/pwa-detection.ts`

### 3. Testing — B+

**Overall coverage exceeds targets** (83% statements, 76% branches), but critical modules have zero coverage:

| Module | Coverage | Risk |
|---|---|---|
| `lib/tasks.ts` | **0%** | Core CRUD — highest risk |
| `components/matrix-board.tsx` | **0%** | Main view orchestrator |
| `components/task-card.tsx` | **0%** | Core interactive component |
| `components/command-palette.tsx` | **0%** | Global ⌘K feature |
| `components/app-header.tsx` | **0%** | Navigation shell |
| `components/settings-dialog.tsx` | **0%** | Settings entry point |
| `components/share-task-dialog.tsx` | **0%** | Share feature |
| `components/theme-provider.tsx` | **0%** | Theme context |

**Severely under-tested (<50%):**

| Module | Coverage |
|---|---|
| `components/share-task-dialog/share-tab-content.tsx` | 7% |
| `lib/db.ts` | 28% |
| `components/reset-everything-dialog.tsx` | 33% |
| `components/inline-task-form.tsx` | 36% |
| `components/pwa-update-toast.tsx` | 40% |
| `components/pwa-register.tsx` | 43% |
| `components/bulk-tag-dialog.tsx` | 46% |

**Testing infrastructure is strong:**
- ✅ Factory functions in `tests/fixtures/index.ts` (no copy-pasted fixtures)
- ✅ Behavior-based test names (`should_X_when_Y`)
- ✅ Proper test isolation with `beforeEach` cleanup
- ✅ Mocks at boundaries, not deep in call stacks
- ✅ Arrange-Act-Assert pattern consistently applied

### 4. Error Handling — A-

**Structured logging is best-in-class.** Five issues found:

| Finding | Location | Severity |
|---|---|---|
| `window.alert()` used instead of `toast.error()` | `components/import-dialog.tsx` ~L48 | **High** |
| Empty `catch {}` (silent failure) | `lib/sync/health-monitor.ts` ~L84 | Medium |
| Empty `catch {}` with no logging before fallback | `lib/sync/health-monitor.ts` ~L146 | Medium |
| Empty `catch {}` in CLI validation | `packages/mcp-server/src/cli/validation.ts` ~L59 | Medium |
| Inconsistent error coercion (3 different patterns) | Multiple files across `lib/` | Low |

**What's working well:**
- ✅ `lib/logger.ts` — structured JSON, context prefixes, correlation IDs, secret sanitization
- ✅ `lib/sync/error-categorizer.ts` — pragmatic error classification (transient/auth/permanent)
- ✅ `lib/sync/retry-manager.ts` — exponential backoff (5s → 10s → 30s → 60s → 300s)
- ✅ `formatErrorMessage()` utility for consistent error string extraction
- ✅ All catch blocks use type narrowing (`error instanceof Error`)

### 5. Security — A ✅

**No vulnerabilities found:**

- ✅ Zero `dangerouslySetInnerHTML`
- ✅ Zero `eval()` or `Function()`
- ✅ Zero hardcoded secrets in source
- ✅ All inputs validated with Zod schemas (`.safeParse()` on user-input paths)
- ✅ Dexie provides safe IndexedDB queries (no injection risk)
- ✅ Logger sanitizes tokens, passwords, API keys, credentials, cookies, sessions

### 6. Accessibility — A ✅

**Meets all baseline requirements:**

- ✅ Semantic HTML throughout (`button`, `nav`, `main`, `label`)
- ✅ All interactive elements keyboard-accessible
- ✅ Images have descriptive `alt` text
- ✅ Form inputs have associated `<label>` elements
- ✅ Comprehensive ARIA attributes (`aria-label`, `aria-pressed`, `aria-expanded`, `aria-live`)
- ✅ Focus management via Radix UI Dialog primitives
- ✅ Semantic Tailwind color tokens for dark mode contrast

### 7. Dependencies — A-

| Finding | Location | Severity |
|---|---|---|
| Floating version: `"tailwind-merge": "^3.5.0"` | `package.json` | Medium |
| Missing rationale for `@radix-ui/*`, `date-fns`, `clsx` | `CLAUDE.md` | Low |

**What's working well:**
- ✅ `bun.lock` present and locked
- ✅ `canvas-confetti` pinned to exact `1.9.4`
- ✅ Non-obvious dependencies documented in CLAUDE.md (8 packages with rationale)
- ✅ No unused dependencies (cleaned in April 2026 audit)

### 8. Configuration — A ✅

- ✅ `lib/env-config.ts` — single source of truth for environment detection
- ✅ Smart hostname-based resolution (localhost / staging / production)
- ✅ PocketBase URL via `NEXT_PUBLIC_POCKETBASE_URL` with documented fallback
- ✅ No undocumented hardcoded values in source
- ⚠️ No `.env.example` file (minor documentation gap)

### 9. Architecture & Docs — A ✅

- ✅ **10 ADRs** in `docs/adr/` covering all major decisions
- ✅ **Modular architecture verified:** `lib/sync/` (20 modules), `lib/analytics/` (6), `lib/notifications/` (5)
- ✅ `tasks/todo.md` and `tasks/lessons.md` actively maintained
- ✅ `.claude/agents/` and `.claude/commands/` directories present
- ✅ No feature flags (appropriate for this project size)

### 10. Logging & Observability — A ✅

- ✅ Structured JSON output with timestamps
- ✅ 21+ log contexts defined as union type
- ✅ Environment-aware levels (debug in dev, info+ in production)
- ✅ Correlation ID support via `LogMetadata`
- ✅ Comprehensive secret sanitization (tokens, URLs, passwords, API keys)
- ✅ Logger tested in `tests/data/logger.test.ts`

---

## Remediation Plan

### P0 — Critical (fix immediately, <30 min total)

These violate explicit project rules and should be addressed before the next commit.

#### P0-1: Replace `window.alert()` with `toast.error()`

- **File:** `components/import-dialog.tsx` ~L48
- **Standard:** Accessibility baseline; CLAUDE.md explicit rule ("window.alert() is not accessible")
- **Current:** `window.alert("Import failed. Ensure you selected a valid export file.");`
- **Fix:** Replace with `toast.error("Import failed. Ensure you selected a valid export file.");`
- **Effort:** 5 minutes

#### P0-2: Pin floating dependency version

- **File:** `package.json`
- **Standard:** "Pin dependency versions in lockfiles; never rely on floating ranges in production"
- **Current:** `"tailwind-merge": "^3.5.0"`
- **Fix:** Change to `"tailwind-merge": "3.5.0"`
- **Effort:** 2 minutes

---

### P1 — High (address this sprint, ~2-3 days)

These are test coverage gaps on critical modules. The global coverage target is met, but per the standard: "100% coverage of all acceptance criteria from the spec is required" and these core modules have zero test coverage.

#### P1-1: Add tests for `lib/tasks.ts` (0% → ≥80%)

- **Risk:** Core CRUD operations — highest risk module to be untested
- **Scope:** Test `createTask()`, `updateTask()`, `deleteTask()`, `getTask()`, `listTasks()`
- **Approach:** Use `fake-indexeddb` (already configured), factory fixtures from `tests/fixtures/`
- **Key cases:** Validation failures, recurrence handling, dependency cleanup on delete
- **Effort:** 4-6 hours

#### P1-2: Add tests for `components/task-card.tsx` (0% → ≥80%)

- **Risk:** Most interactive component — renders task state, handles completion, actions
- **Scope:** Render states (completed, snoozed, overdue), action buttons, keyboard interactions
- **Approach:** `@testing-library/react` with mocked task data
- **Effort:** 3-4 hours

#### P1-3: Add tests for `components/matrix-board.tsx` (0% → ≥80%)

- **Risk:** Main view orchestrator — if this breaks, the entire app is unusable
- **Scope:** Quadrant rendering, task distribution, empty states, drag-and-drop
- **Approach:** Render with mocked `useTasks()` hook
- **Effort:** 3-4 hours

#### P1-4: Add tests for `components/command-palette.tsx` (0% → ≥80%)

- **Risk:** Global feature accessible via ⌘K — keyboard-driven users depend on this
- **Scope:** Open/close, search filtering, action execution, keyboard navigation
- **Effort:** 2-3 hours

#### P1-5: Add tests for `components/app-header.tsx` (0% → ≥80%)

- **Scope:** Navigation links, smart view pills, sync button, settings gear
- **Effort:** 2-3 hours

#### P1-6: Add tests for `components/settings-dialog.tsx` (0% → ≥80%)

- **Scope:** Section rendering, navigation between sections
- **Effort:** 2-3 hours

#### P1-7: Improve coverage for `lib/db.ts` (28% → ≥80%)

- **Scope:** Schema migrations, table creation, version upgrade paths
- **Effort:** 2-3 hours

#### P1-8: Improve coverage for `components/share-task-dialog/share-tab-content.tsx` (7% → ≥80%)

- **Scope:** Share URL generation, copy-to-clipboard, tab switching
- **Effort:** 1-2 hours

---

### P2 — Medium (address next sprint, ~1 day)

Type safety and error handling improvements that reduce future risk.

#### P2-1: Add explicit return type annotations to 8 hooks

- **Files:**
  - `lib/use-error-handler.ts` — `useErrorHandler()`, `useErrorHandlerWithUndo()`
  - `lib/use-auto-archive.ts` — `useAutoArchive()`
  - `lib/use-view-transition.ts` — `useViewTransition()`
  - `lib/use-command-palette.ts` — `useCommandPalette()`
  - `lib/use-matrix-dialogs.ts` — `useMatrixDialogs()`
  - `lib/use-drag-and-drop.ts` — `useDragAndDrop()`
  - `lib/pwa-detection.ts` — `getPlatformInfo()`
- **Standard:** "Add type annotations to all function signatures (parameters and return types)"
- **Effort:** 1-2 hours

#### P2-2: Replace untyped `any` with typed narrowing

- **File:** `lib/pwa-detection.ts` ~L13
- **Current:** `(window.navigator as any).standalone`
- **Fix:** `(window.navigator as { standalone?: boolean }).standalone`
- **Standard:** "Never use `any` without a comment explaining why"
- **Effort:** 5 minutes

#### P2-3: Add logging to silent catch blocks

- **Files:**
  - `lib/sync/health-monitor.ts` ~L84 — Add `logger.debug('checkStaleOperations failed', error)` before silent return
  - `lib/sync/health-monitor.ts` ~L146 — Add `logger.debug('checkServerConnectivity failed', error)` before fallback
  - `packages/mcp-server/src/cli/validation.ts` ~L59 — Add logging before fallback
- **Standard:** "Never swallow exceptions"
- **Effort:** 15 minutes

#### P2-4: Standardize error coercion pattern

- **Current state:** Three inconsistent patterns across the codebase:
  - `new Error(String(error))`
  - `error instanceof Error ? error : new Error(String(error))`
  - `error instanceof Error ? error.message : "fallback"`
- **Fix:** Create a shared `toError(unknown): Error` utility in `lib/utils.ts` and migrate usages
- **Effort:** 1 hour

---

### P3 — Low (backlog, address opportunistically)

Documentation improvements that don't affect runtime behavior.

#### P3-1: Create `.env.example`

- **Content:** Document `NEXT_PUBLIC_POCKETBASE_URL`, `NEXT_PUBLIC_BUILD_NUMBER`, `NEXT_PUBLIC_BUILD_DATE`
- **Standard:** "Document every environment variable with its purpose, type, and default value"
- **Effort:** 15 minutes

#### P3-2: Document remaining dependency rationale

- **File:** `CLAUDE.md` → "Non-Obvious Dependencies" section
- **Add rationale for:** `@radix-ui/*` (headless UI primitives, shadcn foundation), `date-fns` (lightweight date manipulation), `clsx` (conditional className utility)
- **Effort:** 15 minutes

#### P3-3: Create `tasks/spec.md` template

- **Standard:** "Write a spec before writing code" — having a ready template reduces friction
- **Effort:** 10 minutes

---

## Effort Summary

| Priority | Items | Estimated Effort | Timeline |
|---|---|---|---|
| **P0 — Critical** | 2 | 10 minutes | Immediate |
| **P1 — High** | 8 | 2-3 days | This sprint |
| **P2 — Medium** | 4 | 3-4 hours | Next sprint |
| **P3 — Low** | 3 | 40 minutes | Backlog |

**Total estimated effort:** ~3.5 days

---

## Strengths to Preserve

These patterns should be maintained and used as examples for future development:

1. **Modular architecture** — `lib/sync/` (20 modules), `lib/analytics/` (6), `lib/notifications/` (5)
2. **Structured logging** — `lib/logger.ts` with context, correlation IDs, secret sanitization
3. **Security posture** — Zod validation on all inputs, no unsafe patterns, no hardcoded secrets
4. **Accessibility** — Radix UI primitives, semantic HTML, ARIA, keyboard navigation
5. **ADR practice** — 10 well-maintained Architecture Decision Records in `docs/adr/`
6. **Test infrastructure** — Factory functions, proper isolation, behavior-based naming, AAA pattern
7. **TypeScript discipline** — Strict mode, minimal justified `any` usage (3 in production)
8. **Constants centralization** — All magic numbers named in `lib/constants/`
9. **Error categorization** — `lib/sync/error-categorizer.ts` for transient/auth/permanent classification
10. **Retry resilience** — Exponential backoff in sync and MCP server modules
