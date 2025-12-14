# Coding Standards Compliance - Refactoring Plan

*Analysis completed: December 2025*
*Based on: coding-standards.md v4.4*

---

## Executive Summary

A comprehensive audit of the GSD Task Manager codebase identified **8 source files** that require refactoring to meet coding standards compliance. The primary issues are:

1. **Functions exceeding 30-line limit** (8 violations)
2. **Nesting depth > 3 levels** (4 violations)
3. **Magic numbers without named constants** (15+ instances)

All files are within the 350-400 line limit. No critical naming issues were found.

---

## Files Requiring Refactoring

### Priority 1: Critical Function Length Violations

| File | Function | Lines | Limit | Action |
|------|----------|-------|-------|--------|
| `lib/sync/engine/coordinator.ts` | `sync()` | 256 | 30 | Split into phase functions |
| `components/sync/encryption-passphrase-dialog.tsx` | `handleSubmit()` | 113 | 30 | Extract validation and setup helpers |
| `lib/filters.ts` | `applyFilters()` | 100 | 30 | Decompose into filter strategy functions |
| `worker/src/handlers/auth.ts` | `login()` | 119 | 30 | Extract device management |
| `worker/src/handlers/auth.ts` | `register()` | 82 | 30 | Extract database operations |
| `lib/sync/health-monitor.ts` | `check()` | 65 | 30 | Extract individual health checks |
| `components/task-card.tsx` | memo comparison | 54 | 30 | Extract to separate module |
| `components/share-task-dialog.tsx` | `formatTaskDetails()` | 41 | 30 | Split into formatters |

### Priority 2: Nesting Depth Violations

| File | Location | Depth | Max | Action |
|------|----------|-------|-----|--------|
| `components/sync/encryption-passphrase-dialog.tsx` | Lines 66-149 | 5 | 3 | Flatten with early returns |
| `components/sync/sync-auth-dialog.tsx` | Lines 35-85 | 4 | 3 | Extract conditional logic |
| `lib/sync/engine/coordinator.ts` | Lines 138-185 | 4 | 3 | Extract error handling |
| `lib/sync/health-monitor.ts` | Lines 84-142 | 4 | 3 | Extract check functions |

### Priority 3: Magic Numbers

| File | Line | Value | Suggested Constant |
|------|------|-------|-------------------|
| `components/sync/encryption-passphrase-dialog.tsx` | 59 | `12` | `PASSPHRASE_MIN_LENGTH` |
| `components/sync/encryption-passphrase-dialog.tsx` | 138 | `1000` | `AUTO_SYNC_DELAY_MS` |
| `components/share-task-dialog.tsx` | 117,120,130,136 | `3000` | Use `TOAST_DURATION.SHORT` |
| `components/sync/sync-auth-dialog.tsx` | 59 | `500` | `OAUTH_CALLBACK_DELAY_MS` |
| `components/sync/sync-auth-dialog.tsx` | 120 | `600` | `STATUS_REFRESH_DELAY_MS` |
| `lib/filters.ts` | 123,132 | `7 * 24 * 60 * 60 * 1000` | Use `TIME_UNITS.WEEK` |
| `worker/src/handlers/auth.ts` | 69,200,248,278 | `60 * 60 * 24 * 7` | Use `TTL.SESSION` |
| `lib/sync/background-sync.ts` | 72 | `10000` | `INITIAL_SYNC_DELAY_MS` |

---

## Detailed Refactoring Plans

### 1. `lib/sync/engine/coordinator.ts` (sync method: 256 lines)

**Current:** Monolithic `sync()` method handling push, pull, and conflict resolution.

**Proposed:**
```typescript
// Extract to separate private methods
private async executePushPhase(): Promise<PushResult | null>
private async executePullPhase(): Promise<PullResult | null>
private async handleConflicts(conflicts: Conflict[]): Promise<void>
private async handleAuthError(error: Error): Promise<boolean>

// Main sync becomes orchestrator (~30 lines)
async sync(): Promise<SyncResult> {
  const pushResult = await this.executePushPhase();
  const pullResult = await this.executePullPhase();
  if (pullResult?.conflicts) {
    await this.handleConflicts(pullResult.conflicts);
  }
  return this.buildSyncResult(pushResult, pullResult);
}
```

### 2. `components/sync/encryption-passphrase-dialog.tsx` (handleSubmit: 113 lines)

**Current:** Single function handling validation, new user setup, existing user verification, and sync queueing.

**Proposed:**
```typescript
// Extract to helper functions
function validatePassphrase(passphrase: string, confirmPassphrase: string, isNewUser: boolean): string | null
async function setupNewUserEncryption(passphrase: string): Promise<void>
async function initializeExistingUserEncryption(passphrase: string, serverSalt: string): Promise<void>
async function queueTasksForInitialSync(): Promise<{ count: number }>

// handleSubmit becomes orchestrator (~25 lines)
const handleSubmit = async () => {
  const validationError = validatePassphrase(passphrase, confirmPassphrase, isNewUser);
  if (validationError) { setError(validationError); return; }

  if (isNewUser) {
    await setupNewUserEncryption(passphrase);
  } else {
    await initializeExistingUserEncryption(passphrase, serverSalt);
  }
  await queueTasksForInitialSync();
  onOpenChange(false);
};
```

### 3. `lib/filters.ts` (applyFilters: 100 lines)

**Current:** Sequential filter chain with inline logic.

**Proposed:**
```typescript
// Individual filter functions
const filterByQuadrants = (tasks: Task[], quadrants: string[]) => ...
const filterByStatus = (tasks: Task[], status: string) => ...
const filterByTags = (tasks: Task[], tags: string[], matchMode: string) => ...
const filterByDueDateRange = (tasks: Task[], from: Date, to: Date) => ...
const filterByOverdue = (tasks: Task[]) => ...
const filterByRecurring = (tasks: Task[]) => ...
const filterByRecentlyAdded = (tasks: Task[]) => ...
const filterByRecentlyCompleted = (tasks: Task[]) => ...
const filterBySearch = (tasks: Task[], query: string) => ...

// Compose with pipeline pattern
export function applyFilters(tasks: Task[], criteria: FilterCriteria): Task[] {
  return [
    filterByQuadrants,
    filterByStatus,
    filterByTags,
    filterByDueDateRange,
    filterByOverdue,
    filterByRecurring,
    filterByRecentlyAdded,
    filterByRecentlyCompleted,
    filterBySearch
  ].reduce((result, filter) => filter(result, criteria), tasks);
}
```

**Also:** Replace `7 * 24 * 60 * 60 * 1000` with `TIME_UNITS.WEEK` from `lib/constants.ts`.

### 4. `worker/src/handlers/auth.ts` (register: 82 lines, login: 119 lines)

**Current:** Monolithic handlers with inline database operations.

**Proposed:**
```typescript
// lib/auth/session.ts - Extract session constants
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// lib/auth/device-management.ts - Extract device logic
export async function createOrUpdateDevice(env, userId, deviceId, deviceName): Promise<Device>
export async function validateDevice(env, userId, deviceId): Promise<boolean>

// login() becomes ~40 lines
export async function login(c: Context): Promise<Response> {
  const credentials = await validateLoginRequest(c);
  const user = await authenticateUser(env, credentials);
  const device = await createOrUpdateDevice(env, user.id, credentials.deviceId, credentials.deviceName);
  const session = await createSession(env, user.id, device.id);
  return c.json({ token: session.token, expiresAt: session.expiresAt });
}
```

### 5. `lib/sync/health-monitor.ts` (check: 65 lines)

**Current:** Single method checking config, stale ops, token, and connectivity.

**Proposed:**
```typescript
// Already has checkStaleOperations, checkTokenExpiration, checkServerConnectivity
// Just need to extract the main check logic

private async checkConfigurationHealth(): Promise<HealthIssue[]>
private async checkQueueHealth(): Promise<HealthIssue[]>

async check(): Promise<HealthReport> {
  const issues: HealthIssue[] = [];
  issues.push(...await this.checkConfigurationHealth());
  issues.push(...await this.checkQueueHealth());
  issues.push(...await this.checkStaleOperations());
  issues.push(...await this.checkTokenExpiration());
  issues.push(...await this.checkServerConnectivity());
  return { timestamp: Date.now(), issues };
}
```

### 6. `components/task-card.tsx` (memo comparison: 54 lines)

**Current:** Inline memo comparison function with dependency checking.

**Proposed:**
```typescript
// lib/task-card-memo.ts
export function areTaskPropsEqual(prev: TaskCardProps, next: TaskCardProps): boolean {
  if (!shallowEqual(prev, next, SIMPLE_PROPS)) return false;
  if (!areDependenciesEqual(prev, next)) return false;
  if (!areBlockingTasksEqual(prev, next)) return false;
  return true;
}

function shallowEqual(prev, next, keys: string[]): boolean { ... }
function areDependenciesEqual(prev, next): boolean { ... }
function areBlockingTasksEqual(prev, next): boolean { ... }
```

### 7. `components/share-task-dialog.tsx` (formatTaskDetails: 41 lines)

**Current:** Single function building all task detail sections.

**Proposed:**
```typescript
// Extract section formatters
function formatHeader(task: Task): string[]
function formatMetadata(task: Task): string[] // due date, quadrant, recurrence
function formatSubtasks(task: Task): string[]
function formatTags(task: Task): string[]

function formatTaskDetails(task: Task): string {
  const lines = [
    ...formatHeader(task),
    ...formatMetadata(task),
    ...formatSubtasks(task),
    ...formatTags(task)
  ];
  return lines.filter(Boolean).join('\n');
}
```

**Also:** Replace `3000` with `TOAST_DURATION.SHORT` from `lib/constants.ts`.

### 8. `components/sync/sync-auth-dialog.tsx` (nesting depth: 4)

**Current:** useEffect with deeply nested conditionals.

**Proposed:**
```typescript
// Extract initialization logic
async function initializeSyncStatus(config: SyncConfig): Promise<SyncStatus>
async function initializeEncryption(config: SyncConfig): Promise<void>

useEffect(() => {
  async function loadStatus() {
    if (!mounted) return;
    const config = await getSyncConfig();
    if (!shouldProcessConfig(config)) return;

    const status = await initializeSyncStatus(config);
    setSyncStatus(status);

    if (needsEncryptionInit(config)) {
      await delay(OAUTH_CALLBACK_DELAY_MS);
      await initializeEncryption(config);
    }
  }
  loadStatus();
}, []);
```

---

## Constants to Add

### `lib/constants/encryption.ts` (new file)
```typescript
export const ENCRYPTION_CONFIG = {
  PASSPHRASE_MIN_LENGTH: 12,
  AUTO_SYNC_DELAY_MS: 1000,
};
```

### `lib/constants/ui.ts` (additions)
```typescript
export const UI_DELAYS = {
  OAUTH_CALLBACK_DELAY_MS: 500,
  STATUS_REFRESH_DELAY_MS: 600,
  INITIAL_SYNC_DELAY_MS: 10000,
};
```

### `worker/src/config.ts` (ensure TTL usage)
```typescript
// Already defined - just use consistently:
export const TTL = {
  SESSION: 60 * 60 * 24 * 7, // 7 days
  ...
};
```

---

## Implementation Order

1. **Create git branch**: `refactor/coding-standards-compliance`
2. **Add constants first** (no breaking changes)
3. **Refactor files in order of impact**:
   - `lib/filters.ts` (isolated, easy test coverage)
   - `components/share-task-dialog.tsx` (simple extraction)
   - `components/task-card.tsx` (extract memo logic)
   - `lib/sync/health-monitor.ts` (already partially extracted)
   - `worker/src/handlers/auth.ts` (critical path, needs care)
   - `components/sync/encryption-passphrase-dialog.tsx` (complex)
   - `lib/sync/engine/coordinator.ts` (most complex)
   - `components/sync/sync-auth-dialog.tsx` (nesting fix)
4. **Run tests after each file** (`pnpm test`)
5. **Run typecheck** (`pnpm typecheck`)
6. **Commit incrementally**

---

## Verification Checklist

After refactoring, verify:
- [ ] All functions ≤30 lines
- [ ] No nesting >3 levels
- [ ] No magic numbers (use constants)
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] No breaking API changes

---

## Files Already Compliant

The following files passed the audit:
- `components/matrix-board/index.tsx` (345 lines) - Component length acceptable
- `lib/notification-checker.ts` (311 lines) - Minor issues, acceptable
- `worker/src/index.ts` (298 lines) - PASS
- `packages/mcp-server/src/analytics/metrics.ts` (296 lines) - PASS
- `components/notification-settings-dialog.tsx` (279 lines) - PASS
- `components/smart-view-selector.tsx` (272 lines) - PASS
- `lib/sync/crypto.ts` (268 lines) - PASS

---

*Plan Version 1.0 | Generated by Claude Code*
