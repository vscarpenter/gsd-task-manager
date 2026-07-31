# ADR 0013: `archivedTasks` Is a Conditional Tombstone

- **Date:** 2026-07-31
- **Status:** Accepted
- **Deciders:** Vinny Carpenter

## Context

Archiving moves a task out of `tasks` and into `archivedTasks`, then enqueues a remote delete so other devices drop it too. The sync layer knew nothing about `archivedTasks`. A search for the table name across `lib/sync/` returned no hits.

That gap produced a silent outage. The remote copy survived whenever its delete failed to propagate, so the next pull re-added the task through the `!localTask` branch in `applyRemoteRecords`. The id then existed in both tables. `archiveOldTasks` used `bulkAdd`, which threw `ConstraintError` on the existing key. The read and both writes shared one Dexie transaction, so a single collision aborted the whole batch.

Auto-archive therefore failed on every run, hourly and on every page load, and it could not recover on its own. One affected device held 254 tasks, of which 167 were resurrected duplicates. Every archive attempt since mid-July had failed.

Fixing the collision alone would have been a symptom fix. The real question was what `archivedTasks` means to the rest of the system.

## Decision

`archivedTasks` is a tombstone: its presence suppresses re-creation of that task id from a remote source. The tombstone is **conditional**, not absolute.

Four rules govern it. Every writer that touches `tasks` or `archivedTasks` must honor all four.

**1. One table at a time.** A task id belongs in `tasks` or in `archivedTasks`, never both. Any move between them runs in a single Dexie transaction scoped to both tables, plus `syncQueue` when the move enqueues a sync operation.

**2. The tombstone yields to a newer remote edit.** A remote record whose `client_updated_at` is newer than the archived row's `archivedAt` wins, un-archives the task, and removes the archived row. This preserves the engine's edit-beats-delete rule under last-write-wins. `pb-push` deliberately abandons a delete whose remote changed after the delete was queued, and it relies on the next pull to restore that version. Suppressing it unconditionally stranded the edit forever once the cursor advanced. `isRemoteNewerThanArchive` in `lib/sync/pb-sync-helpers.ts` is the single shared implementation, so the pull path and the realtime path cannot drift apart.

**3. Writes into `archivedTasks` are idempotent and never regress.** Archiving uses `put`, so a duplicate can never abort a batch again. The undo for a permanent delete writes only when the id is absent. An existing row is either the same undo repeated or a newer row that won a race. Neither should be overwritten by an older snapshot.

**4. Sharing an id with an archived row is not proof of resurrection.** `restoreTask` and replace-mode import can both put a live task back under an archived id legitimately. Cleanup code must require positive evidence of staleness, such as the row still satisfying the archive predicate, rather than deleting every duplicate it finds.

The writers bound by these rules today:

| Writer | Location | Obligation |
|---|---|---|
| `archiveOldTasks` | `lib/archive.ts` | Idempotent `put`, one transaction |
| `restoreTask` | `lib/archive.ts` | One transaction, clears the archived row |
| `archiveTaskNow` | `lib/archive.ts` | One transaction, idempotent `put` |
| `reinstateArchivedTask` | `lib/archive.ts` | Writes only when the id is absent |
| `applyRemoteRecords` | `lib/sync/pb-pull.ts` | Archive guard, un-archives on a newer edit |
| `applyRemoteChange` | `lib/sync/pb-sync-engine.ts` | Same guard for the realtime path |
| Migration v15 | `lib/db.ts` | Deletes only duplicates that stay archivable |

## Consequences

**Easier:**

- Archiving survives a resurrected duplicate instead of failing permanently.
- An archived task stays archived across a sync, so the user's decision holds.
- A concurrent edit from another device still reaches this device rather than disappearing.
- New code has one place to read before writing to either table.

**Harder:**

- Every future writer must be checked against four rules, and none of them are enforced by the type system.
- The pull path now reads `archivedTasks` on every batch, which adds an indexed lookup bounded by the pull size.
- Rules 2 and 4 pull in opposite directions. Rule 2 says a newer remote edit beats the archive, and rule 4 says a live duplicate may be legitimate. Both need the same care, and neither is obvious from the call site.

**Out of scope:**

- Syncing `archivedTasks` itself. The archive stays device-local, and the remote copy is deleted when the task is archived.
- A schema-level constraint. IndexedDB cannot express a cross-store uniqueness rule.

## Alternatives

| Alternative | Why rejected |
|---|---|
| Absolute tombstone (suppress every archived id) | Shipped first and reviewed as a defect. It overrides the engine's edit-beats-delete rule and strands a concurrent edit permanently once the pull cursor advances. |
| Make archiving a hard remote delete | Destroys the task on every device with no recovery if the archive is later lost. |
| Idempotent `bulkPut` with no pull-side guard | Stops the crash but leaves the resurrection loop. The same tasks re-archive every hour, so churn replaces the outage. |
| Detect stale duplicates by comparing content | Measured against the affected dataset and it identified zero of 167 rows. Sync normalizes fields on the round trip, so no resurrected row matches its archived copy byte for byte. |
| Merge the tables and add an `archived` boolean | A larger migration touching every task query, and it trades a cross-store invariant for a filter that every read must remember to apply. |
