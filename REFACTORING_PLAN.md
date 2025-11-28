# Coding Standards Compliance - Refactoring Plan

*Generated: 2025-11-28*
*Based on: coding-standards.md v4.4*

---

## Executive Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| File Size (≤300 lines) | ⚠️ Needs Work | 5 files exceed limit |
| Function Size (≤30 lines) | ⚠️ Needs Work | 8+ critical, 10+ medium |
| Magic Numbers | ⚠️ Needs Work | ~40 instances |
| Code Duplication | ⚠️ Needs Work | 10 patterns (300-450 lines) |
| Nesting Depth (≤3 levels) | ✅ Good | 2-3 minor issues |
| TODOs with Tickets | ✅ Good | 1 missing ticket |
| Console Statements | ⚠️ Needs Work | 175 occurrences |
| Test Coverage | ⚠️ Needs Work | 17 failing tests |

**Overall Compliance Score: 7/10**

---

## Priority 1: Critical (File Size Violations)

These files exceed the 300-line limit and require immediate modularization.

### 1.1 `lib/sync/oauth-handshake.ts` (389 lines)
**Priority: HIGH | Effort: Medium**

**Issues:**
- 89 lines over limit
- `ensureInitialized()` function is 72 lines
- 20 console statements (should use logger)

**Refactoring Plan:**
1. Extract OAuth state machine into `lib/sync/oauth/state-machine.ts`
2. Extract popup management into `lib/sync/oauth/popup-manager.ts`
3. Extract event handling into `lib/sync/oauth/event-handler.ts`
4. Replace console statements with structured logger

**Target Structure:**
```
lib/sync/oauth/
├── index.ts              # Re-exports (backward compat)
├── state-machine.ts      # OAuth flow state management
├── popup-manager.ts      # Popup window handling
├── event-handler.ts      # Message event processing
└── types.ts              # OAuth-specific types
```

---

### 1.2 `components/matrix-board/index.tsx` (360 lines)
**Priority: HIGH | Effort: Medium**

**Issues:**
- 60 lines over limit
- Complex state management mixed with rendering
- Multiple responsibilities

**Refactoring Plan:**
1. Extract keyboard shortcut handling to `use-matrix-shortcuts.ts`
2. Extract URL parameter handling to `use-url-actions.ts`
3. Extract selection state to existing `lib/bulk-operations.ts`
4. Keep render logic in main component

**Target Structure:**
```
components/matrix-board/
├── index.tsx             # Main render component (~200 lines)
├── use-matrix-shortcuts.ts  # Keyboard shortcuts hook
├── use-url-actions.ts       # URL parameter handling
└── types.ts              # Component-specific types
```

---

### 1.3 `components/sync/encryption-passphrase-dialog.tsx` (338 lines)
**Priority: HIGH | Effort: Medium**

**Issues:**
- 38 lines over limit
- `handleSubmit()` is 114 lines
- 4 console statements

**Refactoring Plan:**
1. Extract `handleSubmit` logic into `use-passphrase-form.ts` hook
2. Extract passphrase validation to `lib/sync/passphrase-validation.ts`
3. Create `PassphraseStrengthIndicator` sub-component
4. Replace console statements with structured logger

---

### 1.4 `lib/sync/engine/coordinator.ts` (333 lines)
**Priority: MEDIUM | Effort: Low**

**Issues:**
- 33 lines over limit (already modularized in v5.6.1)
- Some helper functions could be further extracted

**Refactoring Plan:**
1. Move status formatting helpers to `lib/sync/engine/formatters.ts`
2. Extract event emission logic to `lib/sync/engine/events.ts`
3. Target: <280 lines

---

### 1.5 `lib/notification-checker.ts` (311 lines)
**Priority: MEDIUM | Effort: Low**

**Issues:**
- 11 lines over limit
- 4 console statements

**Refactoring Plan:**
1. Extract time calculation helpers to `lib/notifications/time-helpers.ts`
2. Replace console statements with structured logger
3. Target: <280 lines

---

## Priority 2: High (Function Size Violations)

Functions exceeding 30 lines that need decomposition.

### 2.1 `lib/db.ts` - Constructor (197 lines)
**Priority: HIGH | Effort: Medium**

**Issue:** Database migration logic is one massive constructor.

**Refactoring Plan:**
1. Create `lib/db/migrations/` directory
2. Extract each version migration to separate file:
   - `v1-initial.ts`, `v2-filters.ts`, etc.
3. Use migration runner pattern

**Example:**
```typescript
// lib/db/migrations/index.ts
export const migrations = [
  { version: 1, migrate: v1Migration },
  { version: 2, migrate: v2Migration },
  // ...
];
```

---

### 2.2 `components/task-card.tsx` - Component (210 lines)
**Priority: HIGH | Effort: Medium**

**Issue:** Single component handling tags, subtasks, dependencies, actions.

**Refactoring Plan:**
1. Extract `TaskCardTags` sub-component
2. Extract `TaskCardSubtasks` sub-component
3. Extract `TaskCardDependencies` sub-component
4. Extract `TaskCardActions` sub-component
5. Keep orchestration in main component

---

### 2.3 `components/filter-panel.tsx` - Component (243 lines)
**Priority: MEDIUM | Effort: Medium**

**Issue:** Multiple filter sections in one component.

**Refactoring Plan:**
1. Extract `StatusFilterSection` component
2. Extract `QuadrantFilterSection` component
3. Extract `TagFilterSection` component
4. Extract `DateFilterSection` component
5. Use composition in main panel

---

### 2.4 `worker/src/handlers/sync/push.ts` - push() (170+ lines)
**Priority: HIGH | Effort: Medium**

**Issue:** Complex loop with nested conditionals for operation types.

**Refactoring Plan:**
1. Extract `handleDeleteOperation()` function
2. Extract `handleCreateOperation()` function
3. Extract `handleUpdateOperation()` function
4. Use strategy pattern for operation routing

---

### 2.5 `components/sync/oauth-buttons.tsx` - handleOAuth() (104 lines)
**Priority: MEDIUM | Effort: Low**

**Issue:** Complex async logic with popup management.

**Refactoring Plan:**
1. Extract popup dimension constants
2. Extract popup positioning logic to utility
3. Simplify error handling with helper functions

---

## Priority 3: Medium (Magic Numbers)

Convert hardcoded values to named constants.

### 3.1 Create Schema Constants
**File:** `lib/constants/schema.ts`

```typescript
export const SCHEMA_LIMITS = {
  SUBTASK_ID_MIN_LENGTH: 4,
  SUBTASK_TITLE_MAX_LENGTH: 100,
  TASK_TITLE_MAX_LENGTH: 80,
  TASK_DESCRIPTION_MAX_LENGTH: 600,
  TAG_MAX_LENGTH: 30,
  DEPENDENCY_ID_MIN_LENGTH: 4,
  DEFAULT_REMINDER_MINUTES: 15,
} as const;
```

---

### 3.2 Create HTTP Status Constants
**File:** `packages/mcp-server/src/constants/http.ts`

```typescript
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;
```

---

### 3.3 Create UI Constants
**File:** `lib/constants/ui.ts`

```typescript
export const UI_TIMING = {
  STATUS_POLL_INTERVAL_MS: 500,
  AUTH_CHECK_INTERVAL_MS: 2000,
  AUTO_RESET_TIMEOUT_MS: 3000,
  HEALTH_CHECK_INTERVAL_MS: 5 * 60 * 1000,
} as const;

export const OAUTH_POPUP = {
  WIDTH: 500,
  HEIGHT: 600,
} as const;

export const TIME_PICKER = {
  INCREMENT_MINUTES: 15,
  HOURS_12: 12,
  MINUTES_PER_HOUR: 60,
} as const;
```

---

### 3.4 Create Security Constants (Worker)
**File:** `worker/src/constants/security.ts`

```typescript
export const CORS_CONFIG = {
  MAX_AGE_SECONDS: 86400,      // 24 hours
  HSTS_MAX_AGE_SECONDS: 31536000,  // 1 year
} as const;

export const CRYPTO_BUFFER = {
  SALT_BYTES: 32,
  ID_BYTES: 16,
  STATE_TOKEN_LENGTH: 32,
} as const;

export const JWT_CONFIG = {
  APPLE_EXP_SECONDS: 3600,  // 1 hour
} as const;
```

---

### 3.5 Consolidate Rate Limit Constants
**Issue:** Rate limit values duplicated in middleware and config.

**Action:** Update `worker/src/middleware/rate-limit.ts` to import from `worker/src/config.ts`.

---

## Priority 4: Medium (Code Duplication)

Extract common patterns to reduce 300-450 lines of duplication.

### 4.1 Database Helper Functions
**File:** `lib/db-helpers.ts`

```typescript
export async function getOrCreateSetting<T>(
  table: Dexie.Table<T, string>,
  id: string,
  defaults: T
): Promise<T>;

export async function updateSetting<T>(
  table: Dexie.Table<T, string>,
  id: string,
  updates: Partial<T>,
  schema: z.ZodSchema<T>
): Promise<void>;
```

**Applies to:**
- `lib/notifications/settings.ts`
- `lib/archive.ts`
- `lib/smart-views.ts`
- `lib/sync/config/get-set.ts`

---

### 4.2 Worker Error Handler Middleware
**File:** `worker/src/middleware/error-handler.ts`

```typescript
export function wrapHandler<T>(
  handler: (ctx: Context) => Promise<Response>
): (ctx: Context) => Promise<Response> {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (error) {
      // Centralized error handling
    }
  };
}
```

**Applies to:** All handlers in `worker/src/handlers/`

---

### 4.3 Vector Clock Parser
**File:** `worker/src/handlers/sync/helpers.ts` (add function)

```typescript
export function parseVectorClock(raw: string | null): VectorClock {
  if (!raw) return {};
  return JSON.parse(raw) as VectorClock;
}
```

---

### 4.4 Dialog State Hook
**File:** `lib/hooks/use-dialog-state.ts`

```typescript
export function useDialogState() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return { isLoading, setIsLoading, error, setError, mounted };
}
```

**Applies to:** 4+ dialog components

---

### 4.5 Sync Operation Enqueue Helper
**File:** `lib/sync/enqueue-helper.ts`

```typescript
export async function enqueueSyncIfEnabled(
  operation: SyncOperationType,
  taskId: string,
  record: TaskRecord | null,
  clock: VectorClock
): Promise<void>;
```

**Applies to:**
- `lib/tasks/crud/create.ts`
- `lib/tasks/crud/update.ts`
- `lib/tasks/crud/delete.ts`

---

## Priority 5: Low (Console Statement Cleanup)

Replace 175 console statements with structured logging.

### 5.1 Frontend (lib/) - 131 occurrences

**High-priority files (10+ occurrences):**
| File | Count | Action |
|------|-------|--------|
| `lib/sync/oauth-handshake.ts` | 20 | Replace with logger |
| `lib/sync/health-monitor.ts` | 17 | Replace with logger |
| `lib/sync/background-sync.ts` | 17 | Replace with logger |
| `lib/sync/debug.ts` | 16 | Keep (debug utility) |
| `lib/sync/sync-coordinator.ts` | 12 | Replace with logger |
| `lib/sync/queue-optimizer.ts` | 10 | Replace with logger |

**Action:** Use existing `lib/logger.ts` with appropriate contexts.

---

### 5.2 Components - 44 occurrences

**High-priority files:**
| File | Count | Action |
|------|-------|--------|
| `components/sync/oauth-buttons.tsx` | 8 | Replace with logger |
| `components/oauth-callback-handler.tsx` | 7 | Replace with logger |
| `components/pwa-register.tsx` | 6 | Keep (PWA debug) |
| `components/pwa-update-toast.tsx` | 6 | Keep (PWA debug) |

---

## Priority 6: Low (Testing & Documentation)

### 6.1 Fix Failing Tests (17 tests)
**Files with failures:**
- `tests/ui/matrix-board.test.tsx` - 12 failures
- 1 other test file - 5 failures

**Root causes to investigate:**
- Timer-related issues (fake timers)
- Async state updates
- Mock configuration

---

### 6.2 Add Missing Ticket to TODO
**File:** `packages/mcp-server/src/tools/sync-status.ts:26`

```typescript
// Current:
// TODO: Add dedicated stats endpoint to Worker for more detailed task metadata

// Should be:
// TODO #XX: Add dedicated stats endpoint to Worker for more detailed task metadata
```

**Action:** Create GitHub issue and update comment.

---

## Implementation Timeline

### Phase 1: Critical File Refactoring (Priority 1)
**Estimated effort:** 4-6 hours
1. `oauth-handshake.ts` modularization
2. `matrix-board/index.tsx` decomposition
3. `encryption-passphrase-dialog.tsx` extraction
4. `coordinator.ts` cleanup
5. `notification-checker.ts` cleanup

### Phase 2: Function Decomposition (Priority 2)
**Estimated effort:** 4-6 hours
1. `lib/db.ts` migration refactoring
2. `task-card.tsx` sub-components
3. `filter-panel.tsx` section components
4. `push.ts` operation handlers

### Phase 3: Constants Extraction (Priority 3)
**Estimated effort:** 2-3 hours
1. Create constant files
2. Update all magic number references
3. Verify no regressions

### Phase 4: Duplication Removal (Priority 4)
**Estimated effort:** 3-4 hours
1. Database helper functions
2. Error handler middleware
3. Vector clock parser
4. Dialog state hook
5. Sync enqueue helper

### Phase 5: Cleanup (Priorities 5-6)
**Estimated effort:** 2-3 hours
1. Console statement replacement
2. Fix failing tests
3. Add TODO tickets

---

## Files at Risk (250-300 lines)

These files are at or near the limit and should be monitored:

| File | Lines | Risk |
|------|-------|------|
| `lib/filters.ts` | 300 | **AT LIMIT** |
| `packages/mcp-server/src/analytics/metrics.ts` | 296 | High |
| `components/share-task-dialog.tsx` | 294 | High |
| `packages/mcp-server/src/tools/handlers/system-handlers.ts` | 292 | High |
| `worker/src/index.ts` | 291 | High |
| `components/task-card.tsx` | 291 | High |
| `worker/src/handlers/auth.ts` | 289 | Medium |
| `components/sync/sync-auth-dialog.tsx` | 280 | Medium |

**Recommendation:** Any additions to these files should trigger immediate refactoring.

---

## Verification Checklist

After each refactoring phase:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (excluding known failures)
- [ ] `pnpm build` succeeds
- [ ] No new console statements added
- [ ] All imports still work (backward compatibility)
- [ ] File sizes are within limits

---

*Document Version 1.0 | Generated by Claude Code*
