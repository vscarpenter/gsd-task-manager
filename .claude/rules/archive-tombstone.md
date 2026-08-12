---
name: archive-tombstone
description: The archivedTasks tombstone invariant. Loads when writing to tasks or archivedTasks from archive, sync, migration, or the archive page.
paths:
  - lib/archive.ts
  - lib/sync/**
  - lib/db.ts
  - lib/tasks/**
  - app/(archive)/**
---

## The Invariant (ADR 0013)

`archivedTasks` is a tombstone. Its presence suppresses re-creation of that task id from a remote source. The tombstone is **conditional**, not absolute.

Four rules. Check all four before adding any writer to `tasks` or `archivedTasks`.

**1. One table at a time.** A task id lives in `tasks` or in `archivedTasks`, never both. Any move between them runs in one Dexie transaction scoped to both tables, plus `syncQueue` if it enqueues.

**2. A newer remote edit beats the tombstone.** If the remote `client_updated_at` is newer than the archived row's `archivedAt`, apply it, and delete the archived row. Use `isRemoteNewerThanArchive` from `lib/sync/pb-sync-helpers.ts`. Do not reimplement the comparison; two copies will drift.

**3. Writes into `archivedTasks` are idempotent and never regress.** Use `put`, not `add`. Never overwrite an existing row with an older snapshot.

**4. A shared id is not proof of resurrection.** `restoreTask` and replace-mode import legitimately put a live task under an archived id. Cleanup needs positive evidence of staleness, such as the row still satisfying the archive predicate.

## Why This Exists

Sync had no awareness of `archivedTasks`. Archiving deleted the task locally but the remote copy survived, so the next pull re-added it. The id then sat in both tables, `archiveOldTasks` used `bulkAdd`, and the resulting `ConstraintError` aborted the shared transaction. Auto-archive failed on every run and could not recover. One device reached 254 tasks with 167 duplicates.

## Current Writers

| Writer | Location | Obligation |
|---|---|---|
| `archiveOldTasks` | `lib/archive.ts` | Idempotent `put`, one transaction |
| `restoreTask` | `lib/archive.ts` | One transaction, clears the archived row |
| `archiveTaskNow` | `lib/archive.ts` | One transaction, idempotent `put` |
| `reinstateArchivedTask` | `lib/archive.ts` | Writes only when the id is absent |
| `applyRemoteRecords` | `lib/sync/pb-pull.ts` | Archive guard, un-archives on a newer edit |
| `applyRemoteChange` | `lib/sync/pb-sync-engine.ts` | Same guard, realtime path |
| Migration v15 | `lib/db.ts` | Deletes only duplicates that stay archivable |
| `applyArchivedTasks` | `lib/tasks/import-export.ts` | Idempotent `put`; live copy wins on a contradictory payload; absent key ≠ delete |

Adding a writer? Add it to this table and give it a test for each rule that applies.

## Traps

- **Resolve sync deps before opening a Dexie transaction.** Awaiting a non-Dexie promise inside one lets it commit early. A dynamic `import()` or a config read silently removes the atomicity you just added. `archiveOldTasks` and `restoreTask` both resolve `getSyncConfig` and `getSyncQueue` first.
- **`bulkAdd` inside a transaction is all-or-nothing.** One duplicate key aborts the entire batch, which turns a single bad row into a permanent feature outage.
- **Byte comparison does not identify resurrected rows.** Sync normalizes fields on the round trip. Measured against the affected dataset, content comparison matched zero of 167 duplicates.
- **`archivedTasks` is never synced.** The remote copy is deleted when the task is archived, so undoing a permanent delete enqueues nothing.
- **An absent key in a backup is not an instruction to delete.** A `1.0.0` export carries no `archivedTasks`, so replace-mode import must leave the archive alone rather than read the silence as "empty". Distinguish a missing key from an empty array (ADR 0014).
- **`taskRecordSchema` is `.strict()` and declares no `archivedAt`.** Validating archived rows with it rejects every one of them — silently, since callers skip invalid records rather than throw. Use `archivedTaskRecordSchema`.
- **Verifying against one dataset proves less than it looks.** The production data that exposed this bug held no counterexamples to the absolute-tombstone version. A real-data check passed while the rule was still wrong. Reason about the invariant, then measure.
