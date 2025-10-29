# Remaining Refactoring Tasks

This document outlines the remaining work to fully comply with coding standards after Phase 1 & 2 completion (PR #50).

## Summary

**Completed**: Phase 1 & 2 (Security fixes, user guide, sync engine, structured logging, worker handlers, bulk operations)
**Remaining**: Phase 3-5 (Large files, code quality improvements, nice-to-haves)
**Total Effort**: ~46 hours (~10 days)

---

## HIGH PRIORITY 🔴 (Files still over 300 lines)

### 1. **lib/tasks.ts** (555 lines)
**Issue**: Large file with multiple responsibilities

**Recommendation**: Extract into modules:
- `lib/tasks/crud.ts` - Core create/update/delete/toggle
- `lib/tasks/subtasks.ts` - Subtask operations (addSubtask, deleteSubtask, toggleSubtask)
- `lib/tasks/dependencies.ts` - Dependency operations (addDependency, removeDependency, removeDependencyReferences)
- `lib/tasks/import-export.ts` - Import/export logic
- `lib/tasks.ts` - Re-export for backward compatibility

**Effort**: 6 hours

**Implementation Notes**:
- Maintain backward compatibility with re-export pattern
- Each module should be <200 lines
- Ensure all imports use `@/lib/tasks` (existing pattern)
- Update tests to import from new locations as needed

---

### 2. **packages/mcp-server/src/write-ops.ts** (494 lines)
**Issue**: Large file with operation handlers

**Recommendation**: Extract into:
- `packages/mcp-server/src/write-ops/task-operations.ts` - Task CRUD
- `packages/mcp-server/src/write-ops/subtask-operations.ts` - Subtask management
- `packages/mcp-server/src/write-ops/dependency-operations.ts` - Dependency management
- `packages/mcp-server/src/write-ops.ts` - Main orchestrator/re-export

**Effort**: 4 hours

**Implementation Notes**:
- Follow same pattern as sync/oidc handler splits
- Each operation type should be independently testable
- Maintain MCP tool registration pattern

---

### 3. **components/settings-dialog.tsx** (454 lines)
**Issue**: Multiple settings sections in one file

**Recommendation**: Split into:
- `components/settings/settings-dialog.tsx` - Main wrapper (dialog shell)
- `components/settings/sync-settings.tsx` - Sync configuration section
- `components/settings/notification-settings.tsx` - Notification settings section
- `components/settings/data-management.tsx` - Import/export section
- `components/settings/appearance-settings.tsx` - Theme/appearance section

**Effort**: 4 hours

**Implementation Notes**:
- Similar pattern to user-guide split
- Each section receives props from parent
- Preserve all existing functionality
- Each section should be <150 lines

---

### 4. **components/matrix-board.tsx** (590 lines, down from 635)
**Issue**: Still over limit despite bulk operations extraction

**Recommendation**: Further extract:
- Create `lib/use-matrix-dialogs.ts` - Custom hook for dialog state management
- Create `lib/use-drag-and-drop.ts` - Drag-and-drop logic
- Extract filter/search logic to helper functions

**Effort**: 4 hours

**Implementation Notes**:
- Target: Reduce to <400 lines
- Extract state management to custom hooks
- Keep component focused on rendering

---

## MEDIUM PRIORITY 🟠

### 5. **Magic Numbers Throughout Codebase**

**Files affected**:

**components/task-form.tsx:48-65** - Time generation
```typescript
// Before:
for (let hour = 0; hour < 24; hour++) {
  for (let minute = 0; minute < 60; minute += 15) {

// After:
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const TIME_SLOT_INTERVAL = 15; // minutes

for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
  for (let minute = 0; minute < MINUTES_PER_HOUR; minute += TIME_SLOT_INTERVAL) {
```

**packages/mcp-server/src/tools.ts:344-345** - Hardcoded limits
```typescript
// Before:
lastVectorClock: {},
sinceTimestamp: 1,
limit: 100,

// After:
const SYNC_FETCH_ALL_TIMESTAMP = 1; // Epoch + 1ms fetches all tasks
const MAX_TASK_FETCH_LIMIT = 100; // Worker API limit

lastVectorClock: {},
sinceTimestamp: SYNC_FETCH_ALL_TIMESTAMP,
limit: MAX_TASK_FETCH_LIMIT,
```

**Recommendation**: Create `lib/constants.ts` additions or inline constants with comments

**Effort**: 4 hours

---

### 6. **TODOs Without Ticket Numbers**

**Remaining**:
- ✅ ~~`components/sync-debug-installer.tsx:13`~~ - Already fixed in Phase 1
- `packages/mcp-server/src/tools.ts:193` - "Add dedicated stats endpoint to Worker"

**Action**:
- Create GitHub issue for stats endpoint feature
- Link issue number in TODO comment
- Or implement/remove TODO

**Effort**: 1 hour

---

### 7. **`any` Type Usage**

**Locations**:
- `lib/sync/engine/coordinator.ts:77, 194, 301`
  ```typescript
  // Before:
  private logDebug(message: string, data?: any): void
  } catch (error: any) {

  // After:
  private logDebug(message: string, data?: unknown): void
  } catch (error: unknown) {
  ```

- `lib/sync/debug.ts:93-94` - Window extensions
  ```typescript
  // Before:
  (window as any).debugSyncQueue = debugSyncQueue;

  // After:
  declare global {
    interface Window {
      debugSyncQueue: typeof debugSyncQueue;
      clearStuckOperations: typeof clearStuckOperations;
    }
  }
  window.debugSyncQueue = debugSyncQueue;
  ```

**Recommendation**: Replace with `unknown` and proper type guards, or define proper interfaces

**Effort**: 3 hours

---

### 8. **Complex Nesting (>3 levels)**

**Locations**:
- `components/matrix-board.tsx:282-306` - handleDragEnd function
  - Could be improved with early returns
  - May be resolved when extracting drag-and-drop logic (task #4)

- `lib/sync/engine/coordinator.ts:180-229` - Nested try-catch for 401 handling
  ```typescript
  // Recommendation: Extract to retry wrapper function
  async function withTokenRefresh<T>(
    operation: () => Promise<T>,
    onTokenExpired: () => Promise<void>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isTokenExpiredError(error)) {
        await onTokenExpired();
        return await operation();
      }
      throw error;
    }
  }
  ```

**Effort**: 4 hours

---

## LOW PRIORITY 🟢

### 9. **Date Utility Extraction**

**Location**: `components/task-form.tsx`

**Functions to extract**:
- `isoToDateInput(iso: string | undefined): string`
- `isoToTimeInput(iso: string | undefined): string`
- `dateTimeInputToIso(date: string, time: string): string | undefined`

**Recommendation**:
- Create `lib/date-utils.ts`
- Move functions there for reusability
- Import in task-form and any other components needing date conversions

**Effort**: 2 hours

---

### 10. **Missing Test Coverage**

**Areas needing tests**:

**lib/sync/engine/coordinator.ts**:
- 401 retry flow (token refresh → retry)
- Backoff logic with priority override
- Multi-phase sync coordination

**lib/sync/engine/conflict-resolver.ts**:
- Edge cases (tie-breaking on identical timestamps)
- Invalid vector clock handling

**worker/src/handlers/sync/push.ts**:
- Concurrent edit conflicts
- Soft-delete recovery scenarios

**components/matrix-board.tsx**:
- Bulk operation failures
- Drag-and-drop edge cases

**Effort**: 12 hours

**Implementation Notes**:
- Target: 85%+ coverage for critical sync paths
- Use vitest with mocked dependencies
- Focus on error paths and edge cases

---

### 11. **Decrypt Failure Metrics**

**Location**: `packages/mcp-server/src/tools.ts:399-402`

**Current code**:
```typescript
} catch (error) {
  console.error(`Failed to decrypt task ${encryptedTask.id}:`, error);
  // Skip tasks that fail to decrypt
}
```

**Recommendation**:
- Add counter for decrypt failures
- Track which task IDs fail
- Include in stats endpoint response
- Log aggregate metrics

**Effort**: 2 hours

---

## Prioritized Roadmap

### **Phase 3: Remaining Large Files** (~18 hours, ~4 days)
Focus on bringing remaining files under 300-line limit

1. ✅ Split `lib/tasks.ts` (6h)
2. ✅ Split `packages/mcp-server/src/write-ops.ts` (4h)
3. ✅ Split `components/settings-dialog.tsx` (4h)
4. ✅ Further extract from `components/matrix-board.tsx` (4h)

**Success Criteria**:
- All files <350 lines (allowing 17% buffer for orchestrators)
- 100% backward compatibility maintained
- All tests passing
- No new TypeScript errors

---

### **Phase 4: Code Quality** (~12 hours, ~2.5 days)
Improve code maintainability and type safety

5. ✅ Extract magic numbers to constants (4h)
6. ✅ Replace `any` types with proper types (3h)
7. ✅ Reduce complex nesting with early returns (4h)
8. ✅ Add TODO tickets or resolve (1h)

**Success Criteria**:
- No magic numbers in loops or conditions
- No usage of `any` type (except intentional `unknown`)
- Max 3 levels of nesting throughout
- All TODOs have ticket references

---

### **Phase 5: Nice-to-Haves** (~16 hours, ~3.5 days)
Optional improvements for code excellence

9. ✅ Extract date utilities (2h)
10. ✅ Improve test coverage to 85%+ (12h)
11. ✅ Add decrypt failure metrics (2h)

**Success Criteria**:
- Reusable utility modules
- 85%+ test coverage on critical paths
- Monitoring/metrics for failure scenarios

---

## Total Remaining Effort

- **Phase 3** (High Priority): ~18 hours (~4 days)
- **Phase 4** (Medium Priority): ~12 hours (~2.5 days)
- **Phase 5** (Low Priority): ~16 hours (~3.5 days)
- **Grand Total**: ~46 hours (~10 days for 1 person)

---

## Current Status

✅ **Completed** (PR #50):
- Phase 1: Critical file splitting (user guide, sync engine, security)
- Phase 2: Structured logging, worker handler splitting, bulk operations

🔄 **In Progress**: None

⏳ **Next Up**: Phase 3 - Split remaining large files

---

## Implementation Guidelines

When implementing these refactorings:

1. **Always maintain backward compatibility**
   - Use re-export patterns
   - Don't change public API signatures
   - Test imports from existing code paths

2. **Follow established patterns**
   - Modular directory structure (e.g., `lib/tasks/`, `components/settings/`)
   - Re-export in main file for backward compatibility
   - Each module <200 lines (target)

3. **Test after each change**
   - Run `pnpm typecheck` after refactoring
   - Run `pnpm test` to ensure no regressions
   - Verify backward compatibility manually

4. **Document changes**
   - Update CLAUDE.md with new file structure
   - Add JSDoc comments to extracted modules
   - Update this file when tasks are completed

5. **Create focused PRs**
   - One phase per PR (e.g., "Phase 3: Split remaining large files")
   - Include before/after metrics
   - Document test results and verification

---

## Questions?

For questions or discussion about these refactorings, refer to:
- `coding-standards.md` - Coding standards reference
- `CLAUDE.md` - Project architecture and guidelines
- PR #50 - Example of comprehensive refactoring PR

---

Last Updated: 2025-10-29
Status: Phase 1-2 Complete, Phase 3-5 Pending
