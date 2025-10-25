# Next Feature: Automatic Background Sync

**Status:** Not Implemented
**Priority:** Medium-High
**Estimated Effort:** 2-8 hours (depending on approach)

---

## Current State

### What Works Today (Manual Sync)

**Sync Infrastructure:**
- ✅ **Queue System** (`lib/sync/queue.ts`) - All task CRUD operations automatically enqueue changes when sync is enabled
- ✅ **Sync Engine** (`lib/sync/engine.ts`) - Push/pull with E2E encryption, conflict detection, vector clocks
- ✅ **Manual Trigger** (`components/sync/sync-button.tsx`) - User clicks cloud icon to sync

**Current Workflow:**
1. User creates/updates/deletes a task
2. Change is automatically **enqueued** to sync queue
3. **Nothing happens** until user manually clicks Sync button
4. When clicked, all queued changes are pushed to server and remote changes pulled

**Problem:** Changes pile up in the queue until manual sync. Users must remember to click the sync button.

---

## What's Missing: Automatic Background Sync

### Not Implemented

- ❌ Background sync interval (e.g., every 1-5 minutes)
- ❌ Auto-sync when changes are queued and online
- ❌ Auto-sync on window focus/visibility change
- ❌ Auto-sync on network reconnect
- ❌ Service Worker background sync for PWA
- ❌ User preference for enabling/disabling auto-sync
- ❌ Configurable sync interval

### Current Polling (Not for Sync)

The `useSync` hook (`lib/hooks/use-sync.ts:34`) checks if sync is **enabled** every 2 seconds:
```typescript
// Only detects auth state changes - does NOT trigger sync
const interval = setInterval(checkEnabled, 2000);
```

This is just for UI state, not automatic syncing.

---

## Implementation Options

### Option 1: Simple Interval Auto-Sync ⭐ Recommended

**Estimated Effort:** 2-4 hours

**Description:**
Add background interval that automatically syncs when changes are pending and user is online.

**Benefits:**
- Simple to implement
- Works immediately when app is open
- No additional permissions needed
- Predictable behavior

**Limitations:**
- Only works while app is open/active
- Stops when tab is closed or device sleeps

#### Implementation Steps

**1. Create `lib/sync/background-sync.ts`**

```typescript
import { getSyncEngine } from './engine';
import { getSyncQueue } from './queue';

let syncInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start automatic background sync
 * Syncs every N minutes if changes are pending and online
 */
export function startBackgroundSync(intervalMinutes = 1) {
  if (syncInterval) {
    console.warn('Background sync already running');
    return;
  }

  isRunning = true;

  // Run initial sync after 10 seconds (give app time to load)
  const initialTimeout = setTimeout(() => {
    performBackgroundSync();
  }, 10000);

  // Set up periodic sync
  syncInterval = setInterval(async () => {
    if (isRunning) {
      await performBackgroundSync();
    }
  }, intervalMinutes * 60 * 1000);

  console.log(`Background sync started (interval: ${intervalMinutes} min)`);

  // Return cleanup function
  return () => {
    clearTimeout(initialTimeout);
    stopBackgroundSync();
  };
}

/**
 * Stop automatic background sync
 */
export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    isRunning = false;
    console.log('Background sync stopped');
  }
}

/**
 * Perform a background sync if conditions are met
 */
async function performBackgroundSync() {
  // Check if online
  if (!navigator.onLine) {
    console.log('Background sync skipped: offline');
    return;
  }

  // Check if changes are pending
  const queue = getSyncQueue();
  const pendingCount = await queue.getPendingCount();

  if (pendingCount === 0) {
    console.log('Background sync skipped: no pending changes');
    return;
  }

  // Perform sync
  try {
    console.log(`Background sync triggered: ${pendingCount} pending changes`);
    const engine = getSyncEngine();
    const result = await engine.sync();

    if (result.status === 'success') {
      console.log(`Background sync complete: pushed ${result.pushedCount || 0}, pulled ${result.pulledCount || 0}`);
    } else if (result.status === 'error') {
      console.error('Background sync failed:', result.error);
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

/**
 * Check if background sync is running
 */
export function isBackgroundSyncRunning(): boolean {
  return isRunning;
}
```

**2. Integrate into App (`app/layout.tsx` or sync context)**

```typescript
'use client';

import { useEffect } from 'react';
import { startBackgroundSync, stopBackgroundSync } from '@/lib/sync/background-sync';
import { useSync } from '@/lib/hooks/use-sync';

export function SyncProvider({ children }) {
  const { isEnabled } = useSync();

  useEffect(() => {
    // Only start background sync when sync is enabled
    if (isEnabled) {
      const cleanup = startBackgroundSync(1); // Sync every 1 minute
      return cleanup;
    } else {
      stopBackgroundSync();
    }
  }, [isEnabled]);

  return <>{children}</>;
}
```

**3. Add User Preference (Optional)**

Add to sync settings:
```typescript
// lib/sync/types.ts
export interface SyncConfig {
  // ... existing fields
  autoSyncEnabled?: boolean;
  autoSyncIntervalMinutes?: number; // Default: 1
}
```

Update background sync to respect preference:
```typescript
useEffect(() => {
  if (isEnabled && config?.autoSyncEnabled) {
    const interval = config.autoSyncIntervalMinutes || 1;
    const cleanup = startBackgroundSync(interval);
    return cleanup;
  }
}, [isEnabled, config?.autoSyncEnabled, config?.autoSyncIntervalMinutes]);
```

---

### Option 2: Smart Auto-Sync

**Estimated Effort:** 4-6 hours

**Description:**
More intelligent auto-sync based on user activity and network state.

**Triggers:**
- ✅ Periodic interval (like Option 1)
- ✅ Visibility change (tab regains focus)
- ✅ Network reconnect (online event)
- ✅ Debounced after task changes (30s after last edit)

**Benefits:**
- Better UX - syncs when user likely wants it
- Reduces unnecessary syncs
- More responsive to network conditions

**Limitations:**
- More complex state management
- Potential for race conditions

#### Additional Implementation

**Add to `lib/sync/background-sync.ts`:**

```typescript
/**
 * Start smart auto-sync with multiple triggers
 */
export function startSmartSync(config: {
  intervalMinutes?: number;
  syncOnFocus?: boolean;
  syncOnOnline?: boolean;
  debounceMs?: number;
}) {
  const {
    intervalMinutes = 1,
    syncOnFocus = true,
    syncOnOnline = true,
    debounceMs = 30000,
  } = config;

  // Start periodic sync
  const cleanup1 = startBackgroundSync(intervalMinutes);

  // Sync when tab regains focus
  const handleVisibilityChange = () => {
    if (syncOnFocus && document.visibilityState === 'visible') {
      console.log('Tab focused - triggering sync');
      performBackgroundSync();
    }
  };

  // Sync when network reconnects
  const handleOnline = () => {
    if (syncOnOnline) {
      console.log('Network reconnected - triggering sync');
      performBackgroundSync();
    }
  };

  if (syncOnFocus) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  if (syncOnOnline) {
    window.addEventListener('online', handleOnline);
  }

  // Cleanup function
  return () => {
    cleanup1();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
  };
}
```

**Debounced sync after changes:**

```typescript
// lib/sync/background-sync.ts
let debounceTimeout: NodeJS.Timeout | null = null;

export function scheduleDebouncedSync(delayMs = 30000) {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(() => {
    console.log('Debounced sync triggered after task changes');
    performBackgroundSync();
    debounceTimeout = null;
  }, delayMs);
}
```

**Call in task operations:**

```typescript
// lib/tasks.ts
import { scheduleDebouncedSync } from '@/lib/sync/background-sync';

export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  // ... existing code

  if (syncConfig?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('create', record.id, record, record.vectorClock || {});

    // Schedule debounced sync
    scheduleDebouncedSync();
  }

  return record;
}
```

---

### Option 3: Service Worker Background Sync

**Estimated Effort:** 6-8 hours

**Description:**
Use PWA Background Sync API for true background synchronization.

**Benefits:**
- Works even when app is closed (if PWA is installed)
- Reliable sync on mobile devices
- Battery-efficient (OS-managed)
- Handles offline → online transitions automatically

**Limitations:**
- Only works for installed PWAs
- Limited browser support (Chrome/Edge/Samsung Internet)
- More complex setup
- Requires service worker registration

#### Implementation Overview

**1. Register Background Sync in Service Worker (`public/sw.js`)**

```javascript
// Handle background sync
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(performBackgroundTaskSync());
  }
});

async function performBackgroundTaskSync() {
  try {
    // Open IndexedDB and check for pending sync queue items
    const db = await openIndexedDB();
    const pendingOps = await getPendingOperations(db);

    if (pendingOps.length === 0) {
      console.log('[SW] No pending operations to sync');
      return;
    }

    // Perform sync via fetch to sync API
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: pendingOps,
      }),
    });

    if (response.ok) {
      console.log('[SW] Background sync successful');
      // Clear synced operations from queue
      await clearSyncedOperations(db, pendingOps);
    } else {
      console.error('[SW] Background sync failed');
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
    throw error; // Will retry later
  }
}
```

**2. Register Sync Tag in App**

```typescript
// lib/sync/background-sync.ts
export async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-tasks');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }
}

// Call when sync is enabled or when task changes
export async function scheduleBackgroundSync() {
  await registerBackgroundSync();
}
```

**3. Trigger on Task Changes**

```typescript
// lib/tasks.ts
if (syncConfig?.enabled) {
  const queue = getSyncQueue();
  await queue.enqueue('create', record.id, record, record.vectorClock || {});

  // Request background sync
  await scheduleBackgroundSync();
}
```

---

## Recommended Approach

**Start with Option 1 (Simple Interval)**, then optionally enhance:

### Phase 1: Basic Auto-Sync (2-4 hours)
1. Implement `lib/sync/background-sync.ts` with interval-based sync
2. Integrate into app layout to start/stop based on sync enabled state
3. Default to 1-minute interval
4. Test with manual enable/disable

### Phase 2: Smart Triggers (Optional, +2 hours)
5. Add visibility change trigger
6. Add online event trigger
7. Add debounced sync after task changes

### Phase 3: User Preferences (Optional, +1 hour)
8. Add `autoSyncEnabled` to sync config
9. Add `autoSyncIntervalMinutes` setting
10. Add UI toggle in sync settings dialog

### Phase 4: Service Worker (Future, +6 hours)
11. Implement service worker background sync
12. Add fallback for browsers without support
13. Test on installed PWA

---

## Testing Checklist

- [ ] Auto-sync starts when sync is enabled
- [ ] Auto-sync stops when sync is disabled
- [ ] Auto-sync respects online/offline state
- [ ] Auto-sync skips when no pending changes
- [ ] Auto-sync handles errors gracefully
- [ ] No duplicate syncs (race conditions)
- [ ] Performance impact is minimal
- [ ] Battery usage is reasonable
- [ ] Works across page reloads
- [ ] Works with multiple tabs open
- [ ] Manual sync button still works
- [ ] Conflicts are handled correctly

---

## Future Enhancements

- **Exponential backoff** for failed syncs
- **Adaptive sync interval** based on change frequency
- **Sync pausing** during active editing
- **Bandwidth monitoring** to reduce syncs on metered connections
- **Sync analytics** to track reliability and performance
- **Conflict notification** UI for manual resolution

---

## Notes

- Current notification checker runs every 1 minute (`lib/notification-checker.ts:181`)
- Could combine notification checking with sync checking for efficiency
- PWA already has periodic sync registered for notifications (`components/pwa-register.tsx:77`)
- Consider consolidating periodic background tasks

---

**Last Updated:** 2025-10-22
**Author:** Claude Code Analysis
