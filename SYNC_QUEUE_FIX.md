# Sync Queue "Stuck Operation" Fix

## Problem Description

Browser 1 shows "1 pending operation" that never clears, even after successful sync. Changes made on Browser 2 don't appear on Browser 1 after sync.

## Root Cause Analysis

The issue is in how operations are removed from the sync queue after a push. The code had multiple problems:

1. **Conflicts Not Removed**: When the server returns a conflict for an operation, the operation was left in the queue indefinitely. The code only removed "accepted" operations and incremented retry count for "rejected" operations, but **ignored conflicts entirely**.

2. **Queue Consolidation Edge Case**: When multiple operations for the same task are consolidated, the mapping between `taskId` and queue item IDs might not be tracked correctly.

3. **Race Condition**: If a new operation is added to the queue DURING sync (between consolidation and removal), it might not get removed properly.

4. **Incomplete Removal**: The code filters operations by `taskId` but doesn't verify that ALL queue items for that task are removed.

## Fixes Applied

### 1. Remove Conflicted Operations (`lib/sync/engine.ts`)

**The Critical Fix:**

When the server returns a conflict during push, it means the server has a newer version of the task. The local operation should be removed from the queue because:
- The server's authoritative version will be pulled in the pull phase
- Keeping the conflicted operation in the queue causes it to be retried forever
- The conflict will be resolved when we pull the server's version

**Added:**
```typescript
// Handle conflicts - remove from queue since server has authoritative version
if (response.conflicts.length > 0) {
  const conflictedQueueIds: string[] = [];
  
  for (const conflict of response.conflicts) {
    const queueIds = taskIdToQueueIds.get(conflict.taskId);
    if (queueIds) {
      conflictedQueueIds.push(...queueIds);
    }
  }
  
  if (conflictedQueueIds.length > 0) {
    console.log(`[SYNC DEBUG] Removing ${conflictedQueueIds.length} conflicted operations from queue`);
    await queue.dequeueBulk(conflictedQueueIds);
  }
}
```

### 2. Enhanced Operation Tracking (`lib/sync/engine.ts`)

**Before:**
```typescript
const acceptedIds = pendingOps
  .filter(op => response.accepted.includes(op.taskId))
  .map(op => op.id);
```

**After:**
```typescript
// Track mapping between taskId and ALL queue item IDs
const taskIdToQueueIds = new Map<string, string[]>();

// During operation preparation, track ALL queue items per taskId
for (const op of pendingOps) {
  if (!taskIdToQueueIds.has(op.taskId)) {
    taskIdToQueueIds.set(op.taskId, []);
  }
  taskIdToQueueIds.get(op.taskId)!.push(op.id);
}

// When removing accepted operations, remove ALL queue items for that taskId
const acceptedQueueIds: string[] = [];
for (const acceptedTaskId of response.accepted) {
  const queueIds = taskIdToQueueIds.get(acceptedTaskId);
  if (queueIds) {
    acceptedQueueIds.push(...queueIds);
  }
}
```

This ensures that if consolidation created multiple queue items for the same task (which shouldn't happen but might in edge cases), ALL of them are removed when the server accepts the task.

### 3. Enhanced Logging

Added comprehensive debug logging to track:
- Which operations are in the queue before push
- Which operations are sent to the server
- Which operations the server accepts
- Which queue items are removed
- Any orphaned operations that remain after removal

### 4. Queue Consolidation Verification (`lib/sync/queue-optimizer.ts`)

Added checks to detect and log:
- Tasks with multiple operations before consolidation
- Duplicate taskIds that remain after consolidation (error condition)
- Statistics on consolidation effectiveness

### 5. Debug Tools

Created two debugging utilities:

**A. Debug Functions (`lib/sync/debug.ts`)**
```javascript
// Run in browser console
await debugSyncQueue()  // Shows queue state, config, and tasks
await clearStuckOperations()  // Clears queue with confirmation
```

**B. Debug Panel Component (`components/sync-debug-panel.tsx`)**
- Visual display of queue contents
- Real-time updates every 2 seconds
- Ability to remove individual operations
- Clear all operations button

## Testing the Fix

### 1. Deploy the Changes

```bash
pnpm build
pnpm deploy
```

### 2. Test Scenario

**Browser 1:**
1. Make changes (mark task done, create 2 new tasks)
2. Click sync
3. Check console logs for:
   - "Pending operation details" - should show 3 operations
   - "Removing X accepted operations from queue"
   - "Remaining operations in queue after removal: 0"
4. Verify "All synced" message (no pending count)

**Browser 2:**
1. Click sync
2. Verify you see the changes from Browser 1
3. Make a new change
4. Click sync
5. Check console logs - should show 1 operation pushed and removed

**Browser 1 (again):**
1. Click sync
2. Verify you see the change from Browser 2
3. Check console logs - should show 1 operation pulled
4. Verify "All synced" message

### 3. Debug if Issues Persist

If you still see stuck operations:

**Option A: Browser Console**
```javascript
// Check queue state
await debugSyncQueue()

// Look for:
// - Duplicate taskIds
// - Operations with high retry counts
// - Orphaned operations
```

**Option B: Add Debug Panel to UI**

Add to your settings dialog or create a debug page:
```tsx
import { SyncDebugPanel } from '@/components/sync-debug-panel';

// In your component
<SyncDebugPanel />
```

## Expected Console Output

### Success Case (No Conflicts)

```
[SYNC DEBUG] Starting push phase
[SYNC DEBUG] Pending operations: 3
[SYNC DEBUG] Pending operation details:
  - update task-123 (queue ID: queue-abc)
  - create task-456 (queue ID: queue-def)
  - create task-789 (queue ID: queue-ghi)
[SYNC DEBUG] Pushing 3 operations to server
[SYNC DEBUG] Push response: { accepted: 3, rejected: 0, conflicts: 0 }
[SYNC DEBUG] Removing 3 accepted operations from queue
[SYNC DEBUG] Accepted taskIds: ['task-123', 'task-456', 'task-789']
[SYNC DEBUG] Queue IDs to remove: ['queue-abc', 'queue-def', 'queue-ghi']
[SYNC DEBUG] Remaining operations in queue after removal: 0
[SYNC DEBUG] Push phase complete
```

### Conflict Case (Now Fixed)

```
[SYNC DEBUG] Starting push phase
[SYNC DEBUG] Pending operations: 1
[SYNC DEBUG] Pending operation details:
  - update task-123 (queue ID: queue-abc)
[SYNC DEBUG] Pushing 1 operations to server
[SYNC DEBUG] Push response: { accepted: 0, rejected: 0, conflicts: 1 }
[SYNC DEBUG] Removing 1 conflicted operations from queue
[SYNC DEBUG] Conflicted taskIds: ['task-123']
[SYNC DEBUG] Push phase complete
[SYNC DEBUG] Starting pull phase
[SYNC DEBUG] Pull response: { tasksCount: 1, ... }
[SYNC DEBUG] Processing task task-123 (server's version)
[SYNC DEBUG] Remaining operations in queue after removal: 0
```

## If Issues Persist

If you still see stuck operations after this fix, the issue might be:

1. **Server-side**: The server might not be accepting operations correctly
2. **Network**: Operations might be failing silently
3. **Timing**: Race condition between queue updates and UI polling

Check the console logs for:
- "SYNC ERROR" messages
- "SYNC WARNING" messages about missing queue items
- "orphaned operations" errors

Then share the logs so we can investigate further.
