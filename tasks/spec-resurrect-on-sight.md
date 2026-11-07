# Spec: resurrect on sight

**Status:** draft, 2026-11-07. Android has shipped it since #64. Sprint 2 ports it to web (WEB-RESURRECT) and iOS (IOS-RESURRECT).
**Decision:** Vinny, 2026-11-06: a task deleted while signed out reappears when the account lists it. Android's fix for parity backlog B-56 is the reference.
**Contract:** none shared. No synced field, wire key, corpus, fixture, or server change. Each client keeps a device-local list of task ids.
**Review:** S-AND, because Android runs this rule today, then the Lead, then Vinny. Section 8 has two readings to confirm.
**Evidence:** read, not run, on web `main` at `816a2b7`, iOS `main` at `4c4d44a`, and Android `main` at `8433a23`.

## 1. Why

A delete made while signed out is a local act. The device had no session, so the server never heard about it. Today the three clients disagree about what happens at the next sign-in:

- **Android** (since #64) drops the delete and brings the task back once the account lists it.
- **Web** keeps the task in Trash for good. Its pull drops any server copy older than the Trash row, so every other device still shows the task as active.
- **iOS** sends the delete after the next sign-in, so the task disappears from every device.

The decided rule is Android's. The server copy wins, and the task comes back here.

## 2. The rule

The same on every client, stated by behavior. Each client's order differs (web pushes first, native pulls first), so sections 4 and 5 say where each piece goes.

1. **A delete still unsent when a session starts never reaches the server.** That covers a Trash delete and a Replace import's deletes made while signed out. It also covers a delete made while signed in that was still queued at sign-out (section 8, item 1).
2. **The device remembers those task ids.** The list is device-local. It never syncs, it survives sign-out, and Erase all data clears it.
3. **After the next completed pull, the device lists the whole account once.** For each remembered id in the listing:
   - With a Trash row here, the Trash row goes and the server copy becomes an active task.
   - With an active copy here (restored while signed out, or brought back by the pull), last-write-wins decides. The server copy replaces it only when strictly newer.
   - The far-future hold-off applies as it does in the pull. A far-future stamp doesn't overwrite a task with a queued write.
   - An archive row keeps the archive (section 8, item 2).
4. **Then the device forgets every remembered id, found or not.** A task with no server copy keeps its Trash row, which is the only copy there is.
5. **Nothing is forgotten without a complete listing for the right account.** A dead session, a listing that fails or comes back incomplete, or a sign-out mid-run forgets nothing, and the next run tries again. A guest listing is empty, so the owner is confirmed before the listing counts.
6. **An archive made while signed out stands.** Its delete is dropped without being remembered. The archive stays here, and the server copy stays active elsewhere, which is what web does today.
7. **Nothing else changes.** A delete made while signed in still deletes on the server. A task deleted on another device while this one was signed out still deletes here, through reconciliation.

With no remembered ids, a run does exactly what it does today, with no extra listing.

**Accepted consequences:**

- A task deleted forever while signed out, or purged from Trash after 30 days, comes back as active when the account lists it. There's no Trash row to remove, and the server copy is the only copy left. On web the ordinary pull already does this.
- Signing in to a different account lists none of the remembered ids. They're forgotten, and the Trash rows stay.
- A run with remembered ids costs one extra listing. Normally only the first run after a sign-in has any.

## 3. Android, the reference

| Piece | Where |
|---|---|
| Remember and drop, at sign-in | `SyncCoordinator.confirmOwner` (`app/.../sync/SyncCoordinator.kt:254-267`). Queued `DELETE` rows, pending and failed, with no payload are remembered (`rememberResurrectOnSight`). Then every `DELETE` row goes. An archive's delete carries the task, so it isn't remembered |
| Stored ids | `sync_metadata.resurrectTaskIdsJson`, added in Room 3 to 4 (`core/store/.../GsdDatabase.kt:85-89`) |
| Run order | `SyncEngine.runSync`: pull, then `resurrectOnSight` (`core/sync/.../SyncEngine.kt:80`), then push, then reconcile |
| The step | `resurrectOnSight` (`SyncEngine.kt:186-207`): one `BoundedListing`, `confirmIdentity`, the far-future hold-off, last-write-wins, `removeTombstone`, `upsertFromRemote`, then `forgetResurrectOnSight` |
| Spec | `docs/gsd-android-spec.md` sections 8.21 and 9.4 |

If section 8 item 2 keeps the archive, Android needs one small change: `removeTombstone` at `SyncEngine.kt:200` also clears an archive row today.

## 4. Web

Web pushes first, never queues while signed out, and clears the queue at sign-out.

**Today:** `deleteTask` moves the task to Trash and queues the delete only when sync is enabled (`lib/tasks/crud/delete.ts:31-32`). The cursor is cleared at sign-out (`lib/sync/config/disable.ts:36`), so the first pull after sign-in lists everything. It sees the server copy and drops it, because the remote is older than `deletedAt` (`applyPreparedRecord`, `lib/sync/pb-pull.ts:82`, through `isRemoteNewerThanArchive`, `lib/sync/pb-sync-helpers.ts:252-265`). The task stays in Trash here and stays active everywhere else.

**Change:**

- **Remember in two places.** In `deleteTask` when sync isn't enabled. And in `disableSync`, just before it clears the queue (`disable.ts:48-49`): the task ids of `delete` rows with no payload. An archive's delete carries the task (`lib/archive.ts:122`, `:221`), so it's left out. Web needs no sign-in drop, because nothing is queued while signed out.
- **Store** the ids device-local in `syncMetadata`. They must survive `resetSyncConfigState` (`disable.ts:25-46`, which spreads the current row). They must also work on a device that has never signed in and has no config row yet. `lib/reset-local-data.ts` clears them.
- **The step** runs after the pull in `fullSync`. It uses the same bounded listing (`fetchBoundedRemoteTasks`) and session check (`confirmSessionIdentity`) the pull uses. A pull that comes back unauthenticated returns rather than throws (`pb-pull.ts:143`), so the step treats that as a failure and forgets nothing. A cancelled sync forgets nothing too.
- **The order needs no change.** Push runs first, but remembered tasks are in Trash, so `populateFromExistingTasks` (`lib/sync/queue.ts:201-215`) doesn't seed them and nothing pushes for them. A task restored while signed out is active, so it's seeded and pushes first under the payload guard. Restore keeps its old `updatedAt` (`lib/trash.ts:53-54`), so the step keeps that copy unless the server's is strictly newer.
- **A Replace import already behaves.** It hard-deletes replaced tasks with no Trash row (`lib/tasks/import-export.ts:436-443`), so the ordinary full pull brings them back.

## 5. iOS

iOS pulls first, queues every mutation whatever the sign-in state, and keeps the queue through sign-out.

**Today:** `TaskStore.enqueue` has no sign-in gate (`GSDStore/TaskStore.swift:600-608`). `delete` queues `.delete` with no payload (`:436`), and so do a Replace import's removals (`:990`). `archive` queues a `.delete` that carries the task (`:723`). Sign-out resets only the cursor (`App/Sync/SyncCoordinator.swift:85-89`). After the next sign-in, `sync()` seeds and pulls, and `applyOverTombstone` suppresses the server copy because it's older than the Trash row (`GSDSync/SyncEngine.swift:539-549`). Then the push sends the queued delete, and the task disappears from every device.

**Change:**

- **Remember and drop at the sign-in moment,** as Android's `confirmOwner` does. That's each path in `SessionStore` that records the owner and starts the first sync: proceed (`App/Auth/SessionStore.swift:154-155`), merge (`:181-182`), and fresh (`:191-192`, after its erase). Read the pending and failed items, remember the task ids of `.delete` items with no payload, then remove every `.delete` item.
  - Don't key this on a nil cursor. A first sync that fails leaves the cursor nil, and the next run would then drop a delete made while signed in.
- **Store** the ids in App Group `UserDefaults`, beside the cursor. Sign-out keeps them, and Erase all data clears them.
- **The step** goes in `sync()` after the pull (`SyncEngine.swift:362`) and before the push (`:366`). It uses the pull's fence, bounded listing, and far-future hold-off (`hasQueuedWriteHoldingOff`, `:164-167`). A remembered id with a Trash row comes back through `tombstones.resurrect`. A thrown error forgets nothing.
- **`applyOverTombstone` doesn't change.** Its "a queued delete that push will still send wins" branch can't fire for a remembered id, because sign-in dropped that delete.

## 6. Named tests

Each client writes these where it keeps sync tests: web in `tests/data/sync/`, iOS in `GSDSyncTests/`, and Android in `core/sync/src/test/`, with its journeys in `app/src/androidTest/.../SignedOutDeletesTest.kt`. Names match Android's where it already has the test.

| Test | Rule | Web | iOS | Android |
|---|---|---|---|---|
| `a remembered delete comes back when the account lists the task` | 3 | yes | yes | yes, exists |
| `a remembered delete with no server copy keeps its Trash copy and is forgotten` | 3, 4 | yes | yes | yes, exists |
| `a remembered id active again with a newer local edit keeps the local copy` | 3 | yes | yes | yes, exists |
| `a dead session forgets no remembered delete` | 5 | yes | yes | yes, exists |
| `an incomplete listing forgets no remembered delete` | 5 | yes | yes | yes |
| `nothing remembered means no extra listing` | 2 | yes | yes | yes, exists |
| `a delete made while signed out is remembered` | 1, 2 | yes | n/a: remembered at sign-in | n/a: remembered at sign-in |
| `sign-out remembers the Trash deletes it clears from the queue` | 1 | yes | n/a: sign-out keeps the queue | n/a: sign-out keeps the queue |
| `sign-in drops queued deletes and remembers the Trash and Replace ones` | 1, 2 | n/a: nothing queued | yes | yes |
| `a failed first sync doesn't drop a delete made while signed in` | 1 | n/a: no sign-in drop | yes | yes |
| `an archive made while signed out stays archived and isn't remembered` | 6 | yes | yes | yes, journey exists |
| `a remembered id with an archive row stays archived` | 3, 8.2 | yes | yes | yes, after the change in section 3 |
| `a task trashed signed out comes back out of Trash after the next sign-in` | 1 to 4 | yes | yes | yes, journey exists |
| `a Replace import made signed out deletes nothing on the server after the next sign-in` | 1 | yes, as a control | yes | yes, journey exists |
| `a delete made while signed in still deletes on the server` | 7 | yes | yes | yes |

**Real-server run, one per client,** on a hookless PocketBase 0.40.4 once local servers are allowed (OWNER-DECISIONS item 24). Delete a task while signed out, sign in, and show it back here and still on the server. On iOS, show the failure first: today the task disappears from the server.

## 7. Out of scope

- Server changes and API rules. Conditional delete (the B-47 remainder) has its own spec.
- MCP. It has no local store, no queue, and no sign-out.
- A notice when a task comes back. It returns quietly, like any pulled task.
- The 30-day Trash purge.

## 8. Readings to confirm

These follow Android's code where it has an answer. S-AND, the Lead, and Vinny should each check them.

1. **A delete still queued at sign-out counts as signed out.** Android and iOS keep the queue through sign-out and drop every queued delete at the next sign-in, so they already treat it this way. Web clears its queue at sign-out, which today strands that task in Trash here while it stays active elsewhere. Section 4 has web remember those ids at sign-out, so all three match. **Recommendation:** keep it. The alternative leaves web's divergence in place.
2. **An archive row for a remembered id stays.** A task can be trashed, restored, and archived while signed out. Android's step removes either kind of tombstone (`SyncEngine.kt:200`), so that task comes back active there. This spec keeps the archive, to match rule 6. **Recommendation:** keep the archive, and have the Lead schedule Android's small change. The alternative copies Android and un-archives the task, which loses nothing but undoes the user's last act.
