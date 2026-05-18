# Codex Adversarial Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five silent data-loss / observability paths surfaced by the Codex adversarial review of 2026-05-18.

**Architecture:** Five independent PRs landed in dependency order. Each PR ships working, testable software on its own. Conflict semantics stay LWW (ADR 0003) — no protocol redesign.

**Tech Stack:** TypeScript, Next.js 16 App Router, Dexie (IndexedDB), PocketBase SDK 0.26.8, Vitest, Bun.

**Source review:** Codex adversarial review, 2026-05-18 (see chat transcript). Findings 1, 2, 3, 4, 5 map to PRs 4, 5, 3, 2, 1 below — landing order is reversed from severity to land low-risk diagnostics first.

---

## Strategy Decisions (locked before implementation)

1. **Finding 1 (push LWW) — Option (b): index-cached timestamps + accept narrow race.** Extend `fetchRemoteTaskIndex` to carry `client_updated_at`; compare in `pushSingleItem`. Narrow window between index fetch and per-item write remains and is reconciled by realtime SSE + next pull. Rationale: matches ADR 0003 LWW philosophy, keeps push throughput unchanged (one batched fetch already happens today). Per-item fresh fetch (Option a) is explicitly **out of scope** for this plan but may be added later if telemetry shows the race window matters.
2. **Finding 2 (MCP stale write) — targeted single-record fetch.** Replace the cached `listTasks(config)` call site in `updateTask` with a direct PB fetch of one record by `task_id`. Compare `client_updated_at` immediately before PUT; on mismatch, throw a typed `ConflictError`. No cache redesign.
3. **Finding 5 (partial status) — new `"partial"` literal on `SyncHistoryRecord.status`.** Audit every consumer of the union and update icons / colors / stats.
4. **Finding 4 (replace import) — widen Dexie transaction to include `syncQueue`.** Compute `idsToDelete = existingIds − importedIds` inside the transaction; enqueue deletes atomically.
5. **Finding 3 (cursor poisoning) — clamp future timestamps + advance cursor only from applied records + 30s overlap window.**

## Out of Scope

- Conflict resolution UI (which side won, manual reconciliation).
- Vector clocks / CRDTs (ADR 0003 deliberately chose LWW).
- Server-issued monotonic cursors (would require PocketBase server-side changes).
- Realtime `applyRemoteChange` push direction (already LWW-correct).
- MCP cache redesign (only the one stale-read call site is in scope).
- Per-item fresh-fetch upgrade for push (Option a in Finding 1).
- Backfilling existing partial-but-recorded-as-success history rows.

## PR Ordering

| Order | PR | Finding | Scope | Risk |
|-------|----|---------|-------|------|
| 1 | PR1 | F5 (medium) | sync-history status='partial' | Low — supports diagnostics for the rest |
| 2 | PR2 | F4 (high) | Replace import queues deletes | Low — single function, atomic txn |
| 3 | PR3 | F3 (high) | Cursor clamp + overlap | Low — `pb-pull.ts` only |
| 4 | PR4 | F1 (critical) | Push LWW timestamp check | Medium — touches helpers + push |
| 5 | PR5 | F2 (high) | MCP fresh single-record read | Low — MCP package only |

---

## PR1 — Sync history records `partial` status (Finding 5)

**Why first:** Unblocks accurate observability for PRs 2–5. Smallest change. No behavior change to sync engine logic.

**Files:**
- Modify: `lib/types.ts` (extend `SyncHistoryRecord.status` union)
- Modify: `lib/sync-history.ts` (add `recordSyncPartial`, update `getHistoryStats`)
- Modify: `lib/sync/pb-sync-engine.ts:137-156` (call `recordSyncPartial` from `reportPartialFailure`)
- Modify: `app/(sync)/sync-history/page.tsx:20-40` (icon + color for `partial`)
- Test: `tests/data/sync-history.test.ts`
- Test: `tests/data/sync/pb-sync-engine.test.ts`

### Task 1.1: Failing test — `recordSyncPartial` writes status='partial'

- [ ] **Step 1: Add failing test in `tests/data/sync-history.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { recordSyncPartial, getRecentHistory, getHistoryStats } from '@/lib/sync-history';
import { getDb } from '@/lib/db';

describe('recordSyncPartial', () => {
  beforeEach(async () => {
    await getDb().syncHistory.clear();
  });

  it('writes a history record with status="partial"', async () => {
    await recordSyncPartial({
      pushedCount: 3,
      pulledCount: 1,
      failedCount: 2,
      errorMessage: 'rate_limited',
      deviceId: 'dev-1',
      triggeredBy: 'auto',
      duration: 1234,
    });

    const recent = await getRecentHistory(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe('partial');
    expect(recent[0].pushedCount).toBe(3);
    expect(recent[0].pulledCount).toBe(1);
    expect(recent[0].failedCount).toBe(2);
    expect(recent[0].errorMessage).toBe('rate_limited');
  });

  it('increments partialSyncs in stats', async () => {
    await recordSyncPartial({
      pushedCount: 1, pulledCount: 0, failedCount: 1,
      errorMessage: 'oops', deviceId: 'dev-1', triggeredBy: 'auto', duration: 50,
    });

    const stats = await getHistoryStats();
    expect(stats.partialSyncs).toBe(1);
    expect(stats.successfulSyncs).toBe(0);
  });
});
```

- [ ] **Step 2: Run and verify fail**

Run: `bun run test -- tests/data/sync-history.test.ts`
Expected: FAIL — `recordSyncPartial is not a function`, `stats.partialSyncs` undefined.

### Task 1.2: Extend the status union and `SyncHistoryRecord` shape

- [ ] **Step 1: Edit `lib/types.ts` lines 88-99**

```typescript
export interface SyncHistoryRecord {
  id: string;
  timestamp: string;
  status: "success" | "error" | "conflict" | "partial";
  pushedCount: number;
  pulledCount: number;
  conflictsResolved: number;
  /** Items that failed to push in this sync cycle. Only set for status='partial'. */
  failedCount?: number;
  errorMessage?: string;
  duration?: number;
  deviceId: string;
  triggeredBy: "user" | "auto";
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck`
Expected: FAIL at `app/(sync)/sync-history/page.tsx:20-40` exhaustive switches — that file does not yet handle `partial`. Tracked in Task 1.4.

### Task 1.3: Add `recordSyncPartial` + update `getHistoryStats`

- [ ] **Step 1: Add to `lib/sync-history.ts` after `recordSyncError`**

```typescript
/**
 * Record a partial sync — some items pushed, some failed.
 * Distinct from `recordSyncError` (which means the whole sync failed).
 */
export async function recordSyncPartial(args: {
  pushedCount: number;
  pulledCount: number;
  failedCount: number;
  errorMessage: string;
  deviceId: string;
  triggeredBy: 'user' | 'auto';
  duration?: number;
}): Promise<void> {
  const db = getDb();
  const record: SyncHistoryRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: 'partial',
    pushedCount: args.pushedCount,
    pulledCount: args.pulledCount,
    conflictsResolved: 0,
    failedCount: args.failedCount,
    errorMessage: args.errorMessage,
    deviceId: args.deviceId,
    triggeredBy: args.triggeredBy,
    duration: args.duration,
  };

  await db.syncHistory.add(record);
  logger.warn('Sync partial recorded', {
    id: record.id, pushedCount: args.pushedCount, failedCount: args.failedCount,
  });
  await cleanupOldRecords();
}
```

- [ ] **Step 2: Update `getHistoryStats` return type and body (lines 125-153)**

Add `partialSyncs: number` to the return type and `partialSyncs: allRecords.filter(r => r.status === 'partial').length` to the stats object.

- [ ] **Step 3: Run the failing tests**

Run: `bun run test -- tests/data/sync-history.test.ts`
Expected: PASS for both new tests.

### Task 1.4: Update `sync-history/page.tsx` icon + color switches

- [ ] **Step 1: Edit `app/(sync)/sync-history/page.tsx:20-40`**

```typescript
function getStatusIcon(status: SyncHistoryRecord["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle2Icon className="h-5 w-5 text-green-600" />;
    case "error":
      return <XCircleIcon className="h-5 w-5 text-red-600" />;
    case "conflict":
      return <AlertTriangleIcon className="h-5 w-5 text-amber-600" />;
    case "partial":
      return <AlertTriangleIcon className="h-5 w-5 text-orange-600" />;
  }
}

function getStatusColor(status: SyncHistoryRecord["status"]): string {
  switch (status) {
    case "success":
      return "bg-green-50 border-green-200";
    case "error":
      return "bg-red-50 border-red-200";
    case "conflict":
      return "bg-amber-50 border-amber-200";
    case "partial":
      return "bg-orange-50 border-orange-200";
  }
}
```

- [ ] **Step 2: Grep for any other `status === 'success' | 'error' | 'conflict'` exhaustive matches over `SyncHistoryRecord`**

Run: `rg "SyncHistoryRecord\[.status.\]|status === ['\\\"](success|error|conflict)['\\\"]" --type ts --type tsx`
Expected: All hits are either non-exhaustive guards (`if (r.status === 'success')`) or already updated. If any new exhaustive switch is found, extend with `partial`.

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: PASS.

### Task 1.5: Wire `pb-sync-engine.reportPartialFailure` to the new recorder

- [ ] **Step 1: Edit `lib/sync/pb-sync-engine.ts:137-156`**

```typescript
async function reportPartialFailure(
  pushResult: { pushedCount: number; failedCount: number; lastError: string | null },
  pullResult: { pulledCount: number },
  retryManager: ReturnType<typeof getRetryManager>,
  deviceId: string,
  triggeredBy: 'user' | 'auto',
  duration: number,
): Promise<PBSyncResult> {
  const errorMsg = `${pushResult.failedCount} item(s) failed to sync: ${pushResult.lastError}`;
  await retryManager.recordFailure(new Error(errorMsg));
  await recordSyncPartial({
    pushedCount: pushResult.pushedCount,
    pulledCount: pullResult.pulledCount,
    failedCount: pushResult.failedCount,
    errorMessage: pushResult.lastError ?? 'unknown',
    deviceId,
    triggeredBy,
    duration,
  });
  notifySyncError(errorMsg, false);
  return {
    status: 'partial',
    pushedCount: pushResult.pushedCount,
    pulledCount: pullResult.pulledCount,
    failedCount: pushResult.failedCount,
    error: errorMsg,
  };
}
```

Also update the import at the top: `import { recordSyncSuccess, recordSyncError, recordSyncPartial } from '@/lib/sync-history';`.

- [ ] **Step 2: Add engine-level test in `tests/data/sync/pb-sync-engine.test.ts`**

```typescript
it('records partial status when some push items fail', async () => {
  // Arrange: queue 2 items, mock push to return { pushedCount: 1, failedCount: 1, lastError: 'rate_limited' }
  // Mock pull to return { pulledCount: 0, authenticated: true, maxObservedTimestamp: null }
  // Act: await fullSync('auto')
  // Assert: getRecentHistory(1)[0].status === 'partial'
  //         getRecentHistory(1)[0].failedCount === 1
});
```

Follow the existing mock pattern in this file. Use `vi.mock('@/lib/sync/pb-push')` and `vi.mock('@/lib/sync/pb-pull')`.

- [ ] **Step 3: Run all tests**

Run: `bun run test`
Expected: PASS.

### Task 1.6: Commit PR1

- [ ] **Step 1: Bump version (patch)**

Edit `package.json` — bump the patch version per the project's convention.

- [ ] **Step 2: Commit + push + PR**

```bash
git checkout -b fix/sync-history-partial-status
git add lib/types.ts lib/sync-history.ts lib/sync/pb-sync-engine.ts \
        'app/(sync)/sync-history/page.tsx' tests/data/sync-history.test.ts \
        tests/data/sync/pb-sync-engine.test.ts package.json
git commit -m "fix(sync): record partial syncs as status='partial' instead of success

Codex adversarial review finding #5: reportPartialFailure was writing
a success history row, hiding push failures from users. Adds new
status literal, recorder, and UI affordance."
git push -u origin fix/sync-history-partial-status
gh pr create --title "fix(sync): record partial syncs as status='partial'" \
  --body "$(cat <<'EOF'
## Summary
- Adds \`'partial'\` to \`SyncHistoryRecord.status\` union.
- New \`recordSyncPartial\` helper; \`reportPartialFailure\` now calls it.
- \`getHistoryStats\` exposes \`partialSyncs\` count.
- Sync history page renders an orange triangle for partial rows.

## Test plan
- [x] \`bun run test -- tests/data/sync-history.test.ts\`
- [x] \`bun run test -- tests/data/sync/pb-sync-engine.test.ts\`
- [x] \`bun typecheck\` clean
- [ ] Manual: force a partial sync (e.g. throttle PB to 429 after 1 push) and verify the row shows orange.
EOF
)"
```

---

## PR2 — Replace import queues remote deletes (Finding 4)

**Why second:** Isolated to one function. Atomic Dexie transaction. No interaction with the push engine — works whether or not PR4 has landed.

**Files:**
- Modify: `lib/tasks/import-export.ts:112-153`
- Test: `tests/data/import-export-sync.test.ts` (new file)

### Task 2.1: Failing test — replace import enqueues deletes for tasks absent from the import

- [ ] **Step 1: Create `tests/data/import-export-sync.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { importTasks } from '@/lib/tasks/import-export';
import { getSyncQueue } from '@/lib/sync/queue';
import type { ImportPayload, TaskRecord } from '@/lib/types';

function makeTask(id: string, title: string): TaskRecord {
  return {
    id, title, description: '',
    urgent: false, important: false, quadrant: 'not-urgent-not-important',
    completed: false, createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    recurrence: 'none', tags: [], subtasks: [], dependencies: [],
    notificationEnabled: false, notificationSent: false,
  };
}

describe('importTasks replace mode with sync enabled', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.put({
      key: 'sync_config',
      enabled: true,
      userId: 'user-1',
      deviceId: 'dev-1',
      deviceName: 'Test',
      email: null,
      provider: null,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRetryAt: null,
    });
  });

  it('enqueues delete operations for local tasks absent from the imported payload', async () => {
    const db = getDb();
    await db.tasks.bulkAdd([makeTask('keep-1', 'Keep'), makeTask('remove-1', 'Removed')]);

    const payload: ImportPayload = {
      tasks: [makeTask('keep-1', 'Keep'), makeTask('new-1', 'New')],
      exportedAt: '2026-05-18T00:00:00.000Z',
      version: '1.0.0',
    };

    await importTasks(payload, 'replace');

    const queue = await getSyncQueue().getPending();
    const deletes = queue.filter(q => q.operation === 'delete').map(q => q.taskId);
    const creates = queue.filter(q => q.operation === 'create').map(q => q.taskId);

    expect(deletes).toEqual(['remove-1']);
    expect(creates.sort()).toEqual(['keep-1', 'new-1']);
  });

  it('does not enqueue deletes when sync is disabled', async () => {
    const db = getDb();
    await db.syncMetadata.put({
      key: 'sync_config', enabled: false, userId: null, deviceId: 'dev-1',
      deviceName: 'Test', email: null, provider: null, lastSyncAt: null,
      lastSuccessfulSyncAt: null, consecutiveFailures: 0,
      lastFailureAt: null, lastFailureReason: null, nextRetryAt: null,
    });
    await db.tasks.bulkAdd([makeTask('remove-1', 'Removed')]);

    await importTasks({
      tasks: [makeTask('new-1', 'New')],
      exportedAt: '2026-05-18T00:00:00.000Z',
      version: '1.0.0',
    }, 'replace');

    const queue = await getSyncQueue().getPending();
    expect(queue).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `bun run test -- tests/data/import-export-sync.test.ts`
Expected: FAIL on the first test — `deletes` is `[]` because the current code only enqueues creates.

### Task 2.2: Implement atomic replace + queue deletes

- [ ] **Step 1: Replace the `importTasks` body in `lib/tasks/import-export.ts:112-154`**

```typescript
export async function importTasks(payload: ImportPayload, mode: "replace" | "merge" = "replace"): Promise<void> {
  const db = getDb();
  const result = importPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid import data: ${result.error.issues.map(i => i.message).join(", ")}`);
  }
  const parsed = result.data;

  if (parsed.tasks.length > MAX_IMPORT_TASKS) {
    throw new Error(`Import exceeds maximum of ${MAX_IMPORT_TASKS.toLocaleString()} tasks. Please split into smaller files.`);
  }

  const { getSyncConfig } = await import("@/lib/sync/config");
  const { getSyncQueue } = await import("@/lib/sync/queue");
  const { scheduleSyncAfterChange } = await import("@/lib/tasks/crud/helpers");
  const syncConfig = await getSyncConfig();
  const syncEnabled = !!syncConfig?.enabled;
  const queue = getSyncQueue();

  let tasksToCreate: TaskRecord[] = [];
  let taskIdsToDelete: string[] = [];

  await db.transaction("rw", [db.tasks, db.syncQueue], async () => {
    if (mode === "replace") {
      const existingIds = new Set((await db.tasks.toCollection().primaryKeys()) as string[]);
      const importedIds = new Set(parsed.tasks.map(t => t.id));
      taskIdsToDelete = [...existingIds].filter(id => !importedIds.has(id));

      await db.tasks.clear();
      await db.tasks.bulkAdd(parsed.tasks);
      tasksToCreate = parsed.tasks;
    } else {
      const existingTasks = await db.tasks.toArray();
      const existingIds = new Set(existingTasks.map(t => t.id));
      const { tasks: regeneratedTasks, idMap } = regenerateConflictingIds(parsed.tasks, existingIds);
      const tasksToImport = remapTaskReferences(regeneratedTasks, idMap);
      await db.tasks.bulkAdd(tasksToImport);
      tasksToCreate = tasksToImport;
    }

    if (syncEnabled) {
      for (const id of taskIdsToDelete) {
        await queue.enqueue('delete', id, null);
      }
      for (const task of tasksToCreate) {
        await queue.enqueue('create', task.id, task);
      }
    }
  });

  if (syncEnabled) {
    scheduleSyncAfterChange();
  }
}
```

Note: `queue.enqueue` writes via `db.syncQueue.add(...)`. Calling it inside the transaction is safe because the singleton uses the same Dexie instance, and Dexie auto-binds the inner table operation to the active transaction.

- [ ] **Step 2: Run failing tests**

Run: `bun run test -- tests/data/import-export-sync.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the existing import-export test suite for regressions**

Run: `bun run test -- tests/data/sync-and-utils-boost.test.ts` and any other tests that import `importTasks`.
Run: `rg "importTasks|importFromJson" tests/ -l` to confirm coverage.
Expected: PASS.

### Task 2.3: Commit PR2

- [ ] **Step 1: Bump version (patch)**

- [ ] **Step 2: Commit + push + PR**

```bash
git checkout -b fix/import-replace-queues-deletes
git add lib/tasks/import-export.ts tests/data/import-export-sync.test.ts package.json
git commit -m "fix(import): queue remote deletes when replace import removes tasks

Codex adversarial review finding #4: replace mode cleared local
tasks but only enqueued creates, so the next pull resurrected
deleted tasks from PocketBase. Computes the set difference,
enqueues deletes, and widens the Dexie transaction to include
syncQueue for atomicity."
git push -u origin fix/import-replace-queues-deletes
gh pr create --title "fix(import): replace import queues remote deletes" \
  --body "Closes Codex adversarial review finding #4. See plan: docs/superpowers/plans/2026-05-18-codex-adversarial-review-fixes.md"
```

---

## PR3 — Pull cursor poisoning fix (Finding 3)

**Why third:** Self-contained inside `lib/sync/pb-pull.ts`. Doesn't depend on PR4. Improves the safety net for everything else.

**Files:**
- Modify: `lib/sync/pb-pull.ts`
- Test: `tests/data/sync/pb-pull.test.ts` (new file — current sync tests live in `tests/data/sync/`)

### Strategy

Three changes:
1. Clamp future timestamps to `now + 5min` when computing the cursor — anything beyond is treated as bogus clock skew.
2. Advance the cursor only from **applied** records (validated + LWW-survived), not from all fetched records or invalid ones.
3. Use a 30s overlap window: persist `cursor = maxAppliedTimestamp - 30_000ms` and use `>=` instead of `>` in the filter, with dedup via local task comparison.

### Task 3.1: Failing test — bogus future timestamp does not poison the cursor

- [ ] **Step 1: Create `tests/data/sync/pb-pull.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecordModel } from 'pocketbase';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return {
    ...actual,
    fetchRemoteTaskIndex: vi.fn(async () => ({ index: new Map(), fetchSucceeded: true })),
    getCurrentUserId: vi.fn(() => 'user-1'),
  };
});

import { pullRemoteChanges } from '@/lib/sync/pb-pull';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function pbRecord(taskId: string, clientUpdatedAt: string): RecordModel {
  return {
    id: `rec-${taskId}`,
    collectionId: 'tasks',
    collectionName: 'tasks',
    created: '2026-05-18T00:00:00.000Z',
    updated: '2026-05-18T00:00:00.000Z',
    task_id: taskId,
    title: 'T',
    description: '',
    urgent: false,
    important: false,
    completed: false,
    client_updated_at: clientUpdatedAt,
    client_created_at: '2026-05-18T00:00:00.000Z',
    device_id: 'other-device',
    owner: 'user-1',
  } as unknown as RecordModel;
}

describe('pullRemoteChanges cursor clamping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps year-3000 timestamps to now+5min when computing the cursor', async () => {
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [pbRecord('t1', '3000-01-01T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(maxObservedTimestamp).not.toBeNull();
    expect(new Date(maxObservedTimestamp!).getTime()).toBeLessThanOrEqual(fiveMinFromNow + 1000);
  });

  it('does not include invalid (un-applied) records in the cursor', async () => {
    const badRecord = pbRecord('t1', '2099-12-31T00:00:00.000Z');
    // Force `pocketBaseToTaskRecord` to reject by stripping a required field.
    delete (badRecord as Record<string, unknown>).title;

    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [badRecord, pbRecord('t2', '2026-05-18T00:00:00.000Z')]),
      }),
    });

    const { maxObservedTimestamp } = await pullRemoteChanges(null);
    expect(maxObservedTimestamp).toBe('2026-05-18T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `bun run test -- tests/data/sync/pb-pull.test.ts`
Expected: FAIL — both tests fail because `findMaxTimestamp` ranges over all fetched records and does no clamping.

### Task 3.2: Implement clamp + applied-only cursor + overlap

- [ ] **Step 1: Edit `lib/sync/pb-pull.ts`**

```typescript
/** Five minutes — anything further into the future is treated as clock skew. */
const FUTURE_TIMESTAMP_CLAMP_MS = 5 * 60 * 1000;

/** Overlap window subtracted from the persisted cursor to avoid boundary misses. */
const CURSOR_OVERLAP_MS = 30 * 1000;

function clampFutureTimestamp(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return new Date().toISOString();
  const ceiling = Date.now() + FUTURE_TIMESTAMP_CLAMP_MS;
  return ts > ceiling ? new Date(ceiling).toISOString() : iso;
}

/** Find the max client_updated_at across records that were successfully applied. */
function findMaxAppliedTimestamp(appliedRecords: RecordModel[]): string | null {
  let max: string | null = null;
  for (const record of appliedRecords) {
    const raw = record['client_updated_at'] as string | undefined;
    if (!raw) continue;
    const clamped = clampFutureTimestamp(raw);
    if (!max || clamped > max) max = clamped;
  }
  return max;
}
```

Then refactor `applyRemoteRecords` to return the list of applied records (not just counts):

```typescript
async function applyRemoteRecords(records: RecordModel[]): Promise<{
  appliedRecords: RecordModel[];
  pulledCount: number;
  skippedCount: number;
}> {
  const db = getDb();
  const validRecords: RecordModel[] = [];
  for (const record of records) {
    const test = pocketBaseToTaskRecord(record, null);
    if (test) validRecords.push(record);
  }
  const skippedCount = records.length - validRecords.length;

  const taskIds = validRecords.map(r => r['task_id'] as string);
  const localTasksRaw = await db.tasks.bulkGet(taskIds);
  const localTaskMap = new Map(
    localTasksRaw.filter((t): t is NonNullable<typeof t> => t !== undefined).map(t => [t.id, t])
  );

  const appliedRecords: RecordModel[] = [];
  let pulledCount = 0;

  for (const record of validRecords) {
    const taskId = record['task_id'] as string;
    const localTask = localTaskMap.get(taskId);
    const remoteTask = pocketBaseToTaskRecord(record, localTask ?? null);
    if (!remoteTask) continue;

    if (!localTask) {
      await db.tasks.add(remoteTask);
      appliedRecords.push(record);
      pulledCount++;
    } else {
      const remoteTime = new Date(remoteTask.updatedAt).getTime();
      const localTime = new Date(localTask.updatedAt).getTime();
      if (remoteTime >= localTime) {
        await db.tasks.put(remoteTask);
        appliedRecords.push(record);
        pulledCount++;
      }
    }
  }

  return { appliedRecords, pulledCount, skippedCount };
}
```

Then update `pullRemoteChanges`:

```typescript
const { appliedRecords, pulledCount, skippedCount } = await applyRemoteRecords(records);
if (skippedCount > 0) {
  logger.warn('Skipped invalid remote records during pull', { skippedCount });
}

const maxApplied = findMaxAppliedTimestamp(appliedRecords);
const maxObservedTimestamp = maxApplied
  ? new Date(new Date(maxApplied).getTime() - CURSOR_OVERLAP_MS).toISOString()
  : null;
```

And switch the filter to `>=`:

```typescript
if (lastSyncAt) {
  filter += ` && client_updated_at >= "${escapeFilterValue(lastSyncAt)}"`;
}
```

- [ ] **Step 2: Run pull tests**

Run: `bun run test -- tests/data/sync/pb-pull.test.ts`
Expected: PASS.

- [ ] **Step 3: Run engine + queue tests for regression**

Run: `bun run test -- tests/data/sync/`
Expected: PASS. If `pb-sync-engine.test.ts` asserts an exact `maxObservedTimestamp`, update it to account for the 30s overlap subtraction.

### Task 3.3: Commit PR3

```bash
git checkout -b fix/pull-cursor-clamp
git add lib/sync/pb-pull.ts tests/data/sync/pb-pull.test.ts package.json
git commit -m "fix(sync): clamp future timestamps and advance pull cursor only from applied records

Codex adversarial review finding #3: a poisoned client_updated_at
(clock skew, malformed remote record) could advance lastSyncAt
arbitrarily into the future, causing all subsequent normal updates
to be silently skipped. Now:
- Clamps client_updated_at to now+5min when computing the cursor
- Only considers applied records (filtered through validation + LWW)
- Subtracts a 30s overlap window from the persisted cursor and uses
  >= in the filter, so boundary records survive clock drift."
git push -u origin fix/pull-cursor-clamp
gh pr create --title "fix(sync): clamp pull cursor against bogus future timestamps" \
  --body "Closes Codex adversarial review finding #3."
```

---

## PR4 — Push LWW timestamp guard (Finding 1, critical)

**Why fourth:** Lands after PRs 1–3 so partial-status diagnostics, stable cursor, and clean import behavior are all in place. The change is the highest-blast-radius of the five.

**Files:**
- Modify: `lib/sync/pb-sync-helpers.ts` — extend `fetchRemoteTaskIndex` to return timestamps
- Modify: `lib/sync/pb-push.ts` — compare timestamps in `pushSingleItem`
- Modify: `lib/sync/pb-pull.ts:121-141` — `reconcileDeletedTasks` consumes the new index shape
- Modify: `lib/sync/types.ts` — add `RemoteTaskIndexEntry` shape
- Test: `tests/data/sync/pb-push.test.ts` (new file)
- Test: `tests/data/sync/pb-sync-helpers.test.ts` (new file)

### Strategy recap

Option (b): carry `client_updated_at` alongside record IDs in the remote index. In `pushSingleItem`:
- `create` / `update`: if remote `client_updated_at > payload.updatedAt`, skip the write and dequeue the item (the next pull will deliver the newer remote version anyway).
- `delete`: if remote `client_updated_at > local deletion timestamp` (the queue item's `timestamp` field), skip the delete and dequeue (user resurrected the task on another device after this device queued the delete).

A narrow race remains between the batched `fetchRemoteTaskIndex` call at the start of `pushLocalChanges` and the per-item write. This is the same window LWW already accepts on the pull side and is documented as out of scope for this plan.

### Task 4.1: Extend `fetchRemoteTaskIndex` to carry timestamps

- [ ] **Step 1: Failing test `tests/data/sync/pb-sync-helpers.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

import { fetchRemoteTaskIndex } from '@/lib/sync/pb-sync-helpers';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

describe('fetchRemoteTaskIndex', () => {
  it('returns task_id -> { pbRecordId, clientUpdatedAt } map', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [
          { id: 'rec-1', task_id: 't1', client_updated_at: '2026-05-18T10:00:00.000Z' },
          { id: 'rec-2', task_id: 't2', client_updated_at: '2026-05-18T11:00:00.000Z' },
        ]),
      }),
    });

    const { index, fetchSucceeded } = await fetchRemoteTaskIndex('user-1');
    expect(fetchSucceeded).toBe(true);
    expect(index.get('t1')).toEqual({
      pbRecordId: 'rec-1',
      clientUpdatedAt: '2026-05-18T10:00:00.000Z',
    });
    expect(index.get('t2')?.pbRecordId).toBe('rec-2');
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `bun run test -- tests/data/sync/pb-sync-helpers.test.ts`
Expected: FAIL — `index.get('t1')` returns a plain string, not an object.

- [ ] **Step 3: Add the new type to `lib/sync/types.ts`**

```typescript
/** One row of the remote task index used by push/pull pre-fetch. */
export interface RemoteTaskIndexEntry {
  pbRecordId: string;
  clientUpdatedAt: string | null;
}
```

- [ ] **Step 4: Replace `fetchRemoteTaskIndex` in `lib/sync/pb-sync-helpers.ts:59-77`**

```typescript
export async function fetchRemoteTaskIndex(ownerId: string): Promise<{
  index: Map<string, RemoteTaskIndexEntry>;
  fetchSucceeded: boolean;
}> {
  assertSafeRecordId(ownerId, 'ownerId');
  const pb = getPocketBase();
  const index = new Map<string, RemoteTaskIndexEntry>();

  try {
    const records = await pb.collection('tasks').getFullList({
      filter: `owner = "${escapeFilterValue(ownerId)}"`,
      fields: 'id,task_id,client_updated_at',
    });
    for (const r of records) {
      index.set(r['task_id'] as string, {
        pbRecordId: r.id,
        clientUpdatedAt: (r['client_updated_at'] as string) ?? null,
      });
    }
    return { index, fetchSucceeded: true };
  } catch {
    logger.warn('Could not fetch remote task index; will check individually');
    return { index, fetchSucceeded: false };
  }
}
```

Add the import at the top: `import type { RemoteTaskIndexEntry, PBSyncConfig } from './types';`

- [ ] **Step 5: Run helper tests**

Run: `bun run test -- tests/data/sync/pb-sync-helpers.test.ts`
Expected: PASS.

### Task 4.2: Update `pb-pull.ts` `reconcileDeletedTasks` for the new index shape

- [ ] **Step 1: Edit `lib/sync/pb-pull.ts:121-141`**

The only consumer that uses `.keys()` of the index. Replace:

```typescript
const remoteTaskIds = new Set(remoteIndex.keys());
```

That line still works because we kept `task_id` as the Map key. Confirm typecheck only — no logic change required here.

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck`
Expected: PASS at this file. Any other consumer of `fetchRemoteTaskIndex` returning `string` will fail — Task 4.3 covers `pb-push.ts`.

### Task 4.3: Failing test for stale push write

- [ ] **Step 1: Create `tests/data/sync/pb-push.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '@/lib/db';
import { getSyncQueue } from '@/lib/sync/queue';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

const fetchRemoteTaskIndexMock = vi.fn();
vi.mock('@/lib/sync/pb-sync-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/pb-sync-helpers')>('@/lib/sync/pb-sync-helpers');
  return {
    ...actual,
    fetchRemoteTaskIndex: fetchRemoteTaskIndexMock,
    getCurrentUserId: vi.fn(() => 'user-1'),
    getDeviceId: vi.fn(async () => 'dev-1'),
  };
});

import { pushLocalChanges } from '@/lib/sync/pb-push';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

function makeTask(id: string, updatedAt: string) {
  return {
    id, title: 'T', description: '',
    urgent: false, important: false, quadrant: 'not-urgent-not-important' as const,
    completed: false, createdAt: updatedAt, updatedAt,
    recurrence: 'none' as const, tags: [], subtasks: [], dependencies: [],
    notificationEnabled: false, notificationSent: false,
  };
}

describe('pushLocalChanges LWW guard', () => {
  beforeEach(async () => {
    await getDb().syncQueue.clear();
    fetchRemoteTaskIndexMock.mockReset();
  });

  it('skips a queued update whose payload is older than the remote record', async () => {
    const stalePayload = makeTask('t1', '2026-05-18T08:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', stalePayload);

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(0);
    // Item is dequeued (skipped) since the LWW outcome is final — next pull delivers fresher remote.
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('skips a queued delete when the remote record is newer than the queued op', async () => {
    await getSyncQueue().enqueue('delete', 't1', null);
    // queue.enqueue stamps timestamp = Date.now() at enqueue time, which becomes the
    // "deletion intent" timestamp. Override to a known past time.
    const queue = await getDb().syncQueue.toArray();
    await getDb().syncQueue.update(queue[0].id, { timestamp: new Date('2026-05-18T08:00:00.000Z').getTime() });

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const deleteSpy = vi.fn();
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: vi.fn(), delete: deleteSpy }),
    });

    const result = await pushLocalChanges();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.pushedCount).toBe(0);
    expect(await getSyncQueue().getPendingCount()).toBe(0);
  });

  it('proceeds with the write when the payload is newer than the remote record', async () => {
    const freshPayload = makeTask('t1', '2026-05-18T12:00:00.000Z');
    await getSyncQueue().enqueue('update', 't1', freshPayload);

    fetchRemoteTaskIndexMock.mockResolvedValue({
      index: new Map([
        ['t1', { pbRecordId: 'rec-1', clientUpdatedAt: '2026-05-18T10:00:00.000Z' }],
      ]),
      fetchSucceeded: true,
    });

    const updateSpy = vi.fn(async () => ({ id: 'rec-1' }));
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ create: vi.fn(), update: updateSpy, delete: vi.fn() }),
    });

    const result = await pushLocalChanges();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(result.pushedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `bun run test -- tests/data/sync/pb-push.test.ts`
Expected: FAIL — stale update is still written; stale delete is still written.

### Task 4.4: Implement timestamp guard in `pushSingleItem`

- [ ] **Step 1: Edit `lib/sync/pb-push.ts`**

Update the import: `import type { SyncQueueItem, RemoteTaskIndexEntry } from './types';`

Rewrite `pushSingleItem`:

```typescript
/**
 * Process a single queue item with LWW guard.
 * Skips writes/deletes when the remote record is strictly newer than the queued payload.
 */
async function pushSingleItem(
  item: SyncQueueItem,
  remoteIndex: Map<string, RemoteTaskIndexEntry>,
  indexFetchSucceeded: boolean,
  ownerId: string,
  deviceId: string,
): Promise<boolean> {
  const pb = getPocketBase();
  const queue = getSyncQueue();
  const remote = remoteIndex.get(item.taskId);

  if (item.operation === 'create' || item.operation === 'update') {
    if (!item.payload) {
      // Invalid queue state — payload is required for create/update.
      await queue.dequeue(item.id);
      return true;
    }
    if (remote?.clientUpdatedAt && isRemoteNewer(remote.clientUpdatedAt, item.payload.updatedAt)) {
      logger.info('Skipping stale push: remote is newer', {
        taskId: item.taskId,
        operation: item.operation,
        remoteAt: remote.clientUpdatedAt,
        localAt: item.payload.updatedAt,
      });
      await queue.dequeue(item.id);
      return true;
    }

    const recordId = await upsertRemoteTask(item.payload, remote?.pbRecordId, ownerId, deviceId);
    remoteIndex.set(item.taskId, { pbRecordId: recordId, clientUpdatedAt: item.payload.updatedAt });
  } else if (item.operation === 'delete') {
    if (remote) {
      const deletionIntent = new Date(item.timestamp).toISOString();
      if (remote.clientUpdatedAt && isRemoteNewer(remote.clientUpdatedAt, deletionIntent)) {
        logger.info('Skipping stale delete: remote modified after delete was queued', {
          taskId: item.taskId,
          remoteAt: remote.clientUpdatedAt,
          deletionQueuedAt: deletionIntent,
        });
        await queue.dequeue(item.id);
        return true;
      }
      await pb.collection('tasks').delete(remote.pbRecordId);
      remoteIndex.delete(item.taskId);
    } else if (!indexFetchSucceeded) {
      logger.warn('Skipping delete dequeue: remote index unavailable', { taskId: item.taskId });
      await queue.recordAttemptFailure(item.id, 'Remote task index unavailable for delete verification');
      return false;
    }
  }

  await queue.dequeue(item.id);
  return true;
}

function isRemoteNewer(remoteIso: string, localIso: string): boolean {
  const r = new Date(remoteIso).getTime();
  const l = new Date(localIso).getTime();
  if (Number.isNaN(r) || Number.isNaN(l)) return false;
  return r > l;
}
```

Update `upsertRemoteTask` signature — `pbRecordId` now comes from `remote?.pbRecordId` (no change needed if signature already accepts `string | undefined`).

- [ ] **Step 2: Run failing push tests**

Run: `bun run test -- tests/data/sync/pb-push.test.ts`
Expected: PASS.

- [ ] **Step 3: Run all sync tests for regressions**

Run: `bun run test -- tests/data/sync/`
Expected: PASS. Some existing `pb-sync-engine.test.ts` fixtures may need updates if they stub `fetchRemoteTaskIndex` returning strings — change them to return `{ pbRecordId, clientUpdatedAt }`.

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: PASS.

### Task 4.5: Commit PR4

```bash
git checkout -b fix/push-lww-timestamp-guard
git add lib/sync/pb-sync-helpers.ts lib/sync/pb-push.ts lib/sync/pb-pull.ts \
        lib/sync/types.ts tests/data/sync/pb-push.test.ts \
        tests/data/sync/pb-sync-helpers.test.ts package.json
git commit -m "fix(sync): guard push against stale queued writes that would overwrite newer remote records

Codex adversarial review finding #1 (critical): pushSingleItem
updated/deleted the PocketBase record solely on task_id presence,
never checking remote client_updated_at. Stale offline updates and
deletes could silently overwrite newer cross-device edits.

Extends fetchRemoteTaskIndex to carry the remote client_updated_at
alongside the PB record id. pushSingleItem now compares the remote
timestamp against the queued payload (for updates) or the queue item
timestamp (for deletes) and skips + dequeues stale operations.

A narrow race between the batched index fetch and per-item write
remains; it is reconciled by realtime SSE and the next pull, matching
the LWW model documented in ADR 0003."
git push -u origin fix/push-lww-timestamp-guard
gh pr create --title "fix(sync): LWW guard for stale push writes (Codex finding #1)" \
  --body "Closes Codex adversarial review finding #1 (critical). See plan for the strategy decision (Option b: cached index timestamps)."
```

---

## PR5 — MCP `updateTask` fresh single-record read (Finding 2)

**Why last:** MCP is a separate workspace package; landing it after the web-app PRs lets the MCP build pick up no transitive schema changes that might break.

**Files:**
- Modify: `packages/mcp-server/src/write-ops/helpers.ts` — add `fetchSinglePBTask` helper
- Modify: `packages/mcp-server/src/write-ops/task-operations.ts:130-220` — replace `listTasks(config)` read with the fresh single-record fetch + LWW guard
- Modify: `packages/mcp-server/src/write-ops/bulk-operations.ts` — same pattern for the bulk path
- Add: `packages/mcp-server/src/errors.ts` — typed `ConflictError`
- Test: `packages/mcp-server/src/__tests__/update-task-conflict.test.ts` (new file; create `__tests__` if missing)

### Strategy recap

Replace the `listTasks(config)` call at `task-operations.ts:140` with a direct PB read of a single record by `task_id` (no cache). Capture its `client_updated_at` as the read snapshot. Construct `updatedTask` from the fresh snapshot. Right before the PUT, fetch the record one more time and verify `client_updated_at` is unchanged — if it changed, throw `ConflictError` carrying both timestamps. Same in bulk-operations.

### Task 5.1: Add typed `ConflictError`

- [ ] **Step 1: Create `packages/mcp-server/src/errors.ts`**

```typescript
/** Thrown when a precondition check (e.g., client_updated_at hasn't changed) fails. */
export class ConflictError extends Error {
  readonly name = 'ConflictError';
  constructor(
    readonly taskId: string,
    readonly readClientUpdatedAt: string,
    readonly currentClientUpdatedAt: string,
  ) {
    super(
      `Task ${taskId} changed between read and write ` +
      `(read: ${readClientUpdatedAt}, current: ${currentClientUpdatedAt}). ` +
      `Re-fetch the task and retry.`
    );
  }
}
```

### Task 5.2: Add `fetchSinglePBTaskFresh` helper (bypasses cache)

- [ ] **Step 1: Add to `packages/mcp-server/src/write-ops/helpers.ts`**

```typescript
/**
 * Fetch a single PocketBase task record by its client task_id, bypassing any cache.
 * Returns null if not found.
 */
export async function fetchSinglePBTaskFresh(
  config: GsdConfig,
  taskId: string
): Promise<{ pbRecordId: string; clientUpdatedAt: string; record: PBTask } | null> {
  const pb = getPocketBase(config);
  try {
    const record = await pb.collection('tasks').getFirstListItem<PBTask>(
      `task_id = "${escapeFilterValue(taskId)}"`
    );
    return {
      pbRecordId: record.id,
      clientUpdatedAt: record.client_updated_at,
      record,
    };
  } catch {
    return null;
  }
}
```

### Task 5.3: Failing test — concurrent update is detected as a conflict

- [ ] **Step 1: Create `packages/mcp-server/src/__tests__/update-task-conflict.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTask } from '../write-ops/task-operations';
import { ConflictError } from '../errors';
import * as pbClient from '../pocketbase-client';

vi.mock('../tools/list-tasks', () => ({
  listTasks: vi.fn(async () => [{
    id: 't1', title: 'old',
    urgent: false, important: false, completed: false,
    description: '', quadrant: 'not-urgent-not-important',
    createdAt: '2026-05-18T08:00:00.000Z',
    updatedAt: '2026-05-18T08:00:00.000Z',
    recurrence: 'none', tags: [], subtasks: [], dependencies: [],
    notificationEnabled: false, notificationSent: false,
  }]),
}));

describe('updateTask conflict detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws ConflictError when remote client_updated_at changes between read and write', async () => {
    // First fetch: client_updated_at = A
    // Second fetch (preflight before PUT): client_updated_at = B
    const updateSpy = vi.fn();
    const getFirstListItem = vi.fn()
      .mockResolvedValueOnce({
        id: 'rec-1', task_id: 't1', title: 'old',
        urgent: false, important: false, completed: false,
        client_updated_at: '2026-05-18T08:00:00.000Z',
        client_created_at: '2026-05-18T08:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'rec-1', task_id: 't1', title: 'changed-by-other',
        urgent: false, important: false, completed: false,
        client_updated_at: '2026-05-18T09:30:00.000Z',
        client_created_at: '2026-05-18T08:00:00.000Z',
      });

    vi.spyOn(pbClient, 'getPocketBase').mockReturnValue({
      collection: () => ({ getFirstListItem, update: updateSpy }),
      authStore: { record: { id: 'user-1' }, token: 'tok' },
    } as never);

    await expect(updateTask({} as never, { id: 't1', title: 'mine' } as never))
      .rejects.toBeInstanceOf(ConflictError);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and confirm fail**

Run: `cd packages/mcp-server && npm test -- update-task-conflict`
Expected: FAIL — `ConflictError` is not thrown; the update proceeds.

### Task 5.4: Refactor `updateTask` to use fresh read + preflight check

- [ ] **Step 1: Edit `packages/mcp-server/src/write-ops/task-operations.ts:140-220`**

Replace `const tasks = await listTasks(config); const currentTask = tasks.find((t) => t.id === input.id);` with:

```typescript
const fresh = await fetchSinglePBTaskFresh(config, input.id);
if (!fresh) {
  throw new Error(`Task not found: ${input.id}\n\nThe task may have been deleted.`);
}
const currentTask = pbRecordToTask(fresh.record);
const readClientUpdatedAt = fresh.clientUpdatedAt;
```

(`pbRecordToTask` already exists in `packages/mcp-server/src/types.ts` as a `PBTask → Task` mapper — verify with `grep "export function pbRecordToTask"` and adjust if the function name differs. If only `taskToPBFields` exists, write the inverse mapper inline.)

Keep dependency validation:

```typescript
if (input.dependencies !== undefined) {
  const allTasks = await listTasks(config); // still cached — read-only validation
  const validation = validateDependencies(input.id, input.dependencies, allTasks);
  if (!validation.valid) {
    throw new Error(formatDependencyError(validation.error!));
  }
}
```

After constructing `updatedTask` but before calling `updateTaskInPB`, add the preflight check:

```typescript
const preflight = await fetchSinglePBTaskFresh(config, input.id);
if (!preflight) {
  throw new Error(`Task ${input.id} was deleted between read and write.`);
}
if (preflight.clientUpdatedAt !== readClientUpdatedAt) {
  throw new ConflictError(input.id, readClientUpdatedAt, preflight.clientUpdatedAt);
}
const { ownerId, deviceId } = await getAuthInfo(config);
await updateTaskInPBById(config, preflight.pbRecordId, updatedTask, ownerId, deviceId);
```

Add imports:

```typescript
import { fetchSinglePBTaskFresh, updateTaskInPBById, getAuthInfo } from './helpers.js';
import { ConflictError } from '../errors.js';
```

- [ ] **Step 2: Run failing tests**

Run: `cd packages/mcp-server && npm test -- update-task-conflict`
Expected: PASS.

- [ ] **Step 3: Run the existing MCP test suite for regressions**

Run: `cd packages/mcp-server && npm test`
Expected: PASS. Some tests that mock `listTasks` for `updateTask` will now also need `getFirstListItem` mocks — update fixtures accordingly.

### Task 5.5: Apply the same guard to `bulk-operations.ts`

- [ ] **Step 1: Read `packages/mcp-server/src/write-ops/bulk-operations.ts`**

Identify the read site that feeds the bulk update (likely also `listTasks(config)`).

- [ ] **Step 2: Replace it with `fetchPBRecordIdsForTasks` (already exists) plus a parallel `fetchPBClientUpdatedAtForTasks` helper**

Add to `helpers.ts`:

```typescript
/** Pre-fetch (pbRecordId, clientUpdatedAt) for a batch of client task ids in one request. */
export async function fetchPBSnapshotForTasks(
  config: GsdConfig,
  taskIds: string[]
): Promise<Map<string, { pbRecordId: string; clientUpdatedAt: string }>> {
  if (taskIds.length === 0) return new Map();
  const pb = getPocketBase(config);
  const filter = taskIds.map(id => `task_id = "${escapeFilterValue(id)}"`).join(' || ');
  const records = await pb.collection('tasks').getFullList<PBTask>({
    filter,
    fields: 'id,task_id,client_updated_at',
  });
  const out = new Map<string, { pbRecordId: string; clientUpdatedAt: string }>();
  for (const r of records) {
    out.set(r.task_id, { pbRecordId: r.id, clientUpdatedAt: r.client_updated_at });
  }
  return out;
}
```

In `bulk-operations.ts`, fetch the snapshot before mutating each task. Right before each `updateTaskInPBById`, re-fetch the single record via `fetchSinglePBTaskFresh` and compare to the snapshot. On mismatch, **don't throw** — bulk ops should continue on conflict; instead, record the conflicted task id in the returned result for the caller to surface.

Add a `conflicts: string[]` field to `BulkUpdateResult` (or whatever the existing result shape is — grep the file first).

- [ ] **Step 3: Add bulk conflict test**

Mirror the conflict test from Task 5.3 — two-item bulk update where one item's `client_updated_at` changes between snapshot and PUT. Assert `result.conflicts` contains exactly the changed id.

- [ ] **Step 4: Run the MCP test suite**

Run: `cd packages/mcp-server && npm test`
Expected: PASS.

### Task 5.6: Commit PR5

```bash
git checkout -b fix/mcp-update-task-stale-read
git add packages/mcp-server/src/errors.ts \
        packages/mcp-server/src/write-ops/helpers.ts \
        packages/mcp-server/src/write-ops/task-operations.ts \
        packages/mcp-server/src/write-ops/bulk-operations.ts \
        packages/mcp-server/src/__tests__/update-task-conflict.test.ts \
        packages/mcp-server/package.json
git commit -m "fix(mcp): bypass cache + preflight check on updateTask to prevent stale write-back

Codex adversarial review finding #2: updateTask read from the
cached listTasks snapshot, then PUT the full record back without
verifying client_updated_at hadn't changed in the meantime. A field
edited concurrently by the browser or another MCP call could be
reverted by the stale spread.

Now reads the single record fresh from PocketBase (bypassing the
listTasks cache), captures client_updated_at as a precondition, and
re-fetches immediately before the PUT to compare. On mismatch, throws
ConflictError. Same pattern applied to bulk-operations, which collects
conflicts into a returned list rather than aborting the batch."
git push -u origin fix/mcp-update-task-stale-read
gh pr create --title "fix(mcp): preflight client_updated_at check on updateTask" \
  --body "Closes Codex adversarial review finding #2."
```

---

## Verification Across All PRs

After all five PRs are merged, run end-to-end:

- [ ] `bun run test` — full suite green
- [ ] `bun typecheck` — clean
- [ ] `bun lint` — clean
- [ ] `bun run test:e2e` — Playwright suite green
- [ ] Manual two-device scenario:
  1. Device A: edit task X title to "A version".
  2. Device B (offline): edit task X title to "B version" → queue holds an update.
  3. Device A: complete the title edit and sync (commit timestamp T1).
  4. Device B: go online and sync. **Expected:** B's queued update is dropped (Codex finding #1 fix); pull delivers A's version; sync history shows status='partial' if any other failures occurred.
- [ ] Manual MCP scenario:
  1. Browser: edit task description.
  2. Immediately invoke `update_task` from MCP with a different field.
  3. **Expected:** MCP returns a `ConflictError` describing the timestamp delta (finding #2 fix).

## Risk Notes for the Reviewer

- **PR4 narrow race:** Document in the PR description that the cached-index timestamp leaves a sub-second window where two devices pushing concurrently could each clobber the other's write. The next pull on either device converges via LWW. If telemetry later shows this matters, swap to Option (a) per-item fresh fetch.
- **PR5 bulk semantics:** The change in bulk behavior (continue-on-conflict, surface in result) may break existing MCP clients that assumed bulk ops are atomic. They aren't today, but the new `conflicts: string[]` field is additive.
- **PR3 overlap window:** A 30s overlap means each pull re-applies the last 30s of changes. The LWW comparison drops these as no-ops, but it does increase PocketBase query response size on tightly-active accounts. Acceptable trade for clock-skew safety.

## Self-Review Checklist

- [x] Spec coverage: each Codex finding maps to exactly one PR.
- [x] No `TBD` / `implement later` placeholders.
- [x] File paths verified against the working tree at plan time.
- [x] Test code blocks are runnable as-is (mocks, imports, helpers all named).
- [x] Method/type names consistent across tasks (`RemoteTaskIndexEntry`, `ConflictError`, `recordSyncPartial`, `fetchSinglePBTaskFresh`).
- [x] Out-of-scope section explicit so future scope creep is contained.
- [x] PR ordering respects dependencies (diagnostics first, critical fix not last).

