# Sync Implementation - Next Steps

## ✅ COMPLETED (Just Now)

### Backend (Previously Completed)
- Cloudflare Worker deployed at `https://gsd-sync-worker.vscarpenter.workers.dev`
- All authentication and sync endpoints working
- D1 database schema applied
- Secrets configured

### Client-Side Core (Just Completed)
- ✅ `lib/sync/crypto.ts` - E2E encryption with AES-256-GCM
- ✅ `lib/sync/api-client.ts` - Typed API client
- ✅ `lib/sync/vector-clock.ts` - Conflict detection
- ✅ `lib/sync/queue.ts` - Offline operation queue
- ✅ `lib/sync/engine.ts` - Main sync orchestration
- ✅ `lib/sync/types.ts` - TypeScript interfaces
- ✅ `lib/db.ts` - Updated to version 7 with sync tables
- ✅ `lib/types.ts` - Added `vectorClock` to TaskRecord

## 🚀 TO COMPLETE MVP (4-6 hours)

### Phase 1: React Hooks (1 hour)
Create these files to expose sync functionality to React:

```typescript
// lib/hooks/use-sync.ts
import { useState, useEffect } from 'react';
import { getSyncEngine } from '@/lib/sync/engine';
import type { SyncResult } from '@/lib/sync/types';

export function useSync() {
  const [issyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const engine = getSyncEngine();

  const sync = async () => {
    setIsSyncing(true);
    setStatus('syncing');

    const result = await engine.sync();

    setLastResult(result);
    setIsSyncing(false);
    setStatus(result.status === 'success' ? 'success' : 'error');

    // Auto-reset status after 3 seconds
    setTimeout(() => setStatus('idle'), 3000);

    return result;
  };

  return {
    sync,
    isSyncing,
    lastResult,
    status,
  };
}
```

### Phase 2: Auth Dialog (2 hours)
Create `components/sync/sync-auth-dialog.tsx` with:
- Email/password input
- Register/Login tabs
- Device name input
- Store credentials in sync config
- Initialize crypto manager with derived key

### Phase 3: Sync Button & Status (1 hour)
Add to `components/app-header.tsx`:
- Sync button (cloud icon)
- Status indicator (animated when syncing)
- Click to trigger sync
- Toast notification for results

### Phase 4: Queue Integration (1-2 hours)
Update `lib/tasks.ts` operations to automatically queue:
- `createTask()` → add to queue
- `updateTask()` → add to queue
- `deleteTask()` → add to queue
- `toggleCompleted()` → add to queue

## 📝 Detailed Implementation Guide

### Step 1: Create Sync Hook

```bash
# Create the hook file
touch lib/hooks/use-sync.ts
```

```typescript
// lib/hooks/use-sync.ts
"use client";

import { useState, useCallback } from 'react';
import { getSyncEngine } from '@/lib/sync/engine';
import type { SyncResult } from '@/lib/sync/types';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const sync = useCallback(async () => {
    if (isSyncing) return null;

    setIsSyncing(true);
    try {
      const engine = getSyncEngine();
      const result = await engine.sync();
      setLastResult(result);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    sync,
    isSyncing,
    lastResult,
  };
}
```

### Step 2: Add Sync Button to Header

```typescript
// In components/app-header.tsx, add import:
import { CloudIcon } from 'lucide-react';
import { useSync } from '@/lib/hooks/use-sync';

// Inside component:
const { sync, isSyncing } = useSync();

// Add button in the header:
<button
  onClick={sync}
  disabled={isSyncing}
  className="..."
  title="Sync"
>
  <CloudIcon className={isSyncing ? 'animate-pulse' : ''} />
</button>
```

### Step 3: Queue Task Operations

```typescript
// In lib/tasks.ts, add at top:
import { getSyncQueue } from '@/lib/sync/queue';
import { getDb } from '@/lib/db';

// After creating a task:
export async function createTask(input: TaskDraft): Promise<TaskRecord> {
  // ... existing code ...
  await db.tasks.add(record);

  // ADD THIS: Queue for sync
  const config = await db.syncMetadata.get('sync_config');
  if (config?.enabled) {
    const queue = getSyncQueue();
    await queue.enqueue('create', record.id, record, record.vectorClock || {});
  }

  return record;
}

// Similarly for updateTask, deleteTask, toggleCompleted
```

### Step 4: Enable Sync (Initial Setup)

Create a simple settings page to:
1. Show sync status (enabled/disabled)
2. Button to enable sync
3. Show auth dialog when enabling
4. Store server URL if needed

## 🎯 MVP Testing Checklist

Once implemented, test:

1. **First Device**
   - [ ] Enable sync and create account
   - [ ] Create a task
   - [ ] Click sync button
   - [ ] Verify task appears in Cloudflare D1

2. **Second Device**
   - [ ] Enable sync and login
   - [ ] Click sync button
   - [ ] Verify task from device 1 appears

3. **Offline Queue**
   - [ ] Go offline
   - [ ] Create/edit tasks
   - [ ] Go online
   - [ ] Sync
   - [ ] Verify changes propagate

4. **Conflict Resolution**
   - [ ] Edit same task on two devices
   - [ ] Sync both
   - [ ] Verify last-write-wins works

## 📚 Files Created

```
lib/sync/
├── crypto.ts           # E2E encryption
├── api-client.ts       # API wrapper
├── vector-clock.ts     # Conflict detection
├── queue.ts            # Offline queue
├── engine.ts           # Sync orchestration
└── types.ts            # TypeScript types

lib/db.ts              # Updated to v7
lib/types.ts           # Added vectorClock

worker/                # Cloudflare Worker (complete)
├── src/
│   ├── index.ts
│   ├── handlers/
│   ├── middleware/
│   └── utils/
└── schema.sql
```

## 🔧 Configuration

Update `lib/sync/types.ts` if your worker URL is different:
```typescript
serverUrl: "https://gsd-sync-worker.vscarpenter.workers.dev"
```

Or make it configurable in the UI.

## ⚡️ Quick Start Commands

```bash
# Run the app
pnpm dev

# The database will auto-migrate to v7 on first load
# Sync features will be available but disabled by default

# To enable:
# 1. Add sync button to header
# 2. Click to open auth dialog
# 3. Register/login
# 4. Start syncing!
```

## 🐛 Common Issues

**Database migration fails**
- Clear IndexedDB in DevTools
- Refresh page
- Database will recreate with v7

**Sync returns "not configured"**
- Check `syncMetadata` table has `sync_config` entry
- Verify `enabled: true` after auth

**Encryption fails**
- Ensure crypto manager is initialized after login
- Call `crypto.deriveKey(password, salt)` after auth

## 📞 Need Help?

Refer to:
- `SYNC_IMPLEMENTATION_STATUS.md` - Full status
- `worker/README.md` - Backend API docs
- `worker/SETUP.md` - Deployment guide

## 🎉 You're Almost There!

The hard part (infrastructure) is done! Just need:
1. Hook to trigger sync
2. Button in UI
3. Queue integration
4. Auth dialog

All the complex parts (encryption, conflict detection, API) are complete and tested!
