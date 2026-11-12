# Fix backlog from the formal verification skills

The four verify skills found these on web `main` at `dd32e08c` (v14.8.0) on 2026-11-08. Production serves 14.8.0, checked from `sw.js` on 2026-11-09, so every row is live. Each one was replayed in Vitest against the real code. `WEB-UNDO-SIGNED-IN` is fixed (see its row); the rest are open. The rows use the parity backlog's format, so the Project session can paste them into `parity/backlog.md`.

P1 means a lost task, a lost edit, or a common action that fails, on a path people take every day. P2 means the same harm behind a less common setup (a failed push, two accounts, an import), or another account's data. P3 means a narrow timing window, an unusual clock, or an annoyance. Within a priority, rows are in the suggested fix order. A "(decision)" row needs Vinny's call before anyone fixes it.

Each row names the skill and config that show it. A fix flips that config's line in the skill's `check.sh` from "breaks" to "holds" in the same PR, and then the skill's sync commit moves forward.

## P1

### `WEB-UNDO-SIGNED-IN` · P1 · Undo after a delete fails whenever you're signed in

**Fixed 2026-11-10** on `claude/eloquent-mccarthy-p7ybod`: the scope in `runTaskSyncTransaction` is now `async`. `tests/data/tasks/restore-signed-in.test.ts` reproduces the failure under fake-indexeddb ("Transaction committed too early", red before the change, green after), so a Chrome probe is no longer the only evidence.

`restoreTask` (`lib/tasks/crud/restore.ts:21`) throws Dexie's "Transaction committed too early" for a signed-in user. `runTaskSyncTransaction` (`lib/tasks/crud/helpers.ts:62`) passes a plain arrow as the transaction scope, so Dexie stops tracking the native awaits inside it. When `forgetForResurrect` returns early, the queue write runs in a transaction of its own. The task comes back here, but the toast says the Undo failed. Whether the restore still reaches the server wasn't checked. It started with #701 (`bf4ba13e`) and shipped in 14.8.0. A Chrome probe of the same writes, with the app's Dexie 4.4.6, failed 20 of 20 runs under a plain arrow and passed 20 of 20 under an `async` scope. The production app itself wasn't tried. Fix: make the scope `async`, with a red test under fake-indexeddb first. Evidence: `verify-task-tombstones` finding 7. It's outside the model, so no config flips.

### `WEB-STALE-DELETE-RESTORE` · P1 · one failed delete push plus a restore loses the task everywhere

You delete a task, and its delete push fails once, say on a 429 or a dropped connection. Then you restore it from Trash, Undo, or an import. The create goes through, and the next sync sends the old delete. `isStaleDelete` (`lib/sync/pb-push.ts:154`) lets it pass, because the restored copy keeps its old `updatedAt`. Reconcile then drops the live task here, with no Trash row. Fix, as the model proposes it: `pushSingleItem` drops a delete for an id that's live here. `isStaleDelete` is web's half of B-47 (SPEC-4). Next parity pass: check whether iOS #49 and Android's `remoteEditedAfterArchive` look at local liveness. Evidence: `verify-task-tombstones`, `Finding-5-stale-delete.cfg`.

### `WEB-PULL-CURSOR-SKIP` · P1 · an offline edit can miss another device for good

The pull cursor is one per account. It follows the newest `client_updated_at` that any task brought in, minus a 30-second overlap (`updateSyncCursor`, `lib/sync/pb-sync-engine.ts:321`). An edit made offline keeps its old stamp. If another task moved device B's cursor past that stamp before the edit reached the server, B's pulls (`pullRemoteChanges`, `lib/sync/pb-pull.ts:214`) never ask for it. A closed tab misses the realtime event too. B shows the old copy until someone edits the task again. Under last-write-wins, B's own next edit of that task would then replace the offline edit everywhere. Fix: a design call, and a sync contract change for all three clients. The cursor pages on the writer's clock, and PocketBase can't filter on its system `updated` field, so the fix needs a stamp the server sets or another way to find late arrivals. Next parity pass: check iOS (`SyncCursor.swift`) and Android for the same shape. Evidence: `verify-sync-convergence`, `FindingOtherTaskCursor.cfg`.

## P2

### `WEB-LATE-AUTH-REFRESH` · P2 · a late token refresh can upload one account's task into another

**Fixed 2026-11-11.** `readPendingForSession` in `lib/sync/pb-push.ts` now reads the queue inside a transaction that calls `assertSyncSessionCurrent`, and the push repeats the check before each row. `BrokenPushQueueFence.cfg` undoes the fix and breaks the rule again. The rest of this entry describes the code before the fix.

It needed two accounts signed in, one after the other, on one browser. `pushLocalChanges` checked the SDK's principal once, then read the queue with no `assertSyncSessionCurrent`. In one replay, a sync tab's `authRefresh` was in flight while another tab signed out and signed in as B. Its late response saved A's token over B's, because `clearPocketBase` (`lib/sync/pocketbase-client.ts:49`) detaches only the tab that calls it. The push then read B's edit and created it in A's account. The refresh runs on every sync in a token's last seven days. A stale sign-in dialog in a second tab gets there too. The planned fix had two parts: read the queue inside a fenced transaction, and drop a refresh response when the session changed while it was in flight. Only the first shipped. A late refresh can still save an old token, and the fenced read now stops the push that follows. Related: `PUSH-IDENTITY` (P3) asks the same question of iOS. Evidence: `verify-sync-session`, `BrokenPushQueueFence.cfg`.

### `WEB-RETRIED-EDIT-RECREATES` · P2 · a retried edit brings a deleted task back on the server

You edit a task, then delete or archive it. The edit's push fails once, the delete goes through, and the retried edit creates the server record again. Your other devices then show the task you deleted. `pushSingleItem` (`lib/sync/pb-push.ts:169`) never checks whether the task is still live here. TLC found a second way in: a push run that read its rows before a sign-out keeps sending them after the next sign-in. Fix, as the model proposes it: `pushSingleItem` drops a create or update for an id in Trash or the archive here. Evidence: `verify-task-tombstones`, `Finding-4-stale-write.cfg`.

### `WEB-FAILED-PUSH-STRANDED` · P2 · an edit whose push retries run out never leaves the device

Five failed syncs in a row mark the queue row `failed` (`recordAttemptFailure`, `lib/sync/queue.ts:150`). `getPending` (`:103`) skips failed rows, and nothing re-arms them, so the server and every other device keep the old copy. The health monitor counts failed rows but never sends them again. Fix: re-arm failed rows on launch and on a manual sync, as iOS and Android do. That changes the rule in `HOLDOFF-FAILED-ROWS`, so the two land in the same PR. Evidence: `verify-sync-convergence`, `FindingRetriesRunOut.cfg`.

### `CONDITIONAL-UPDATE` · update to the existing P3 row · now replayed on web

`verify-sync-convergence` replayed this race against the real code (`FindingPushRace.cfg`). Both pushes read the original. B writes its edit, and A's upsert, decided on that stale read, overwrites it with A's older edit. Both open devices end on B's edit, but the server keeps A's, and so does any device that signs in later. Suggest raising the row to P2. The fix still needs the owner decision the row asks for.

### `WEB-IMPORT-TWO-TABLES` · P2 (decision) · an import can put one task in two tables

`applyTasks` (`lib/tasks/import-export.ts:364`) in merge mode gives a backup task a fresh id only when that id is live here. Merging a backup that has the task live, while it sits in Trash or the archive, leaves it in both. A replace with a 1.0.0 backup does the same, and `applyArchivedTasks` (`:235`) doesn't check `deletedTasks`. The task then shows in two places, and a later restore overwrites your edits or fails on a duplicate key. Decision first: rule 4 in `.claude/rules/archive-tombstone.md` calls the replace case legitimate, which contradicts rule 1. Evidence: `verify-task-tombstones`, `Finding-1-import.cfg`.

### `WEB-UNCHECK-REPEATING` · P2 (decision) · unchecking a repeating task leaves two open copies

Check off a daily task, then uncheck it. `toggleCompleted(id, false)` (`lib/tasks/crud/toggle.ts:49`) only flips the flag, so the next copy stays, and the board shows two open copies. Check it off again and a second next copy appears. Decision first: is this a bug? The comment on `handleToggle` (`components/matrix-simplified/task-actions.ts:78`) says Undo removes the copy so it won't leave an orphan, and unchecking is the reversal that does leave one. Evidence: `docs/diagrams/task-lifecycle-model/`, `TaskLifecycleRecurringBoard.cfg`, where both rules break in three steps.

## P3

### `WEB-SESSION-STALE-READ` · P3 · four writers act on a `sync_config` read taken outside their transaction

Each one needs a second tab or a stale dialog, plus a window of a few IndexedDB round trips. The first three were fixed on 2026-11-11 (#734). The fourth is open and tracked as #735.

- Fixed. `disableSync` read the row before `resetSyncConfigState` opened its transaction. If A's sign-in saved in between, the signed-out row recorded no `localTaskOwnerUserId`, and B could then sign in and upload A's task. `resetSyncConfigState` now reads the row inside its transaction (`verify-sync-session`, `BrokenSignOutRead.cfg`).
- Fixed. `updateAutoSyncConfig` wrote `{...current, ...updates}` through `updateSyncConfig` with no transaction, so it could write A's row back over B's sign-in. `updateSyncConfig` now reads and writes in one transaction (`BrokenSettingsWrite.cfg`).
- Fixed. `persistSyncConfig` committed, then `populateFromExistingTasks` queued every task with no session check. A Reset Everything in between left A's task queued on an empty device, and B's push uploaded it. The sign-in transaction now queues the local tasks itself (`BrokenPopulate.cfg`).
- Open (#735). `runTaskSyncTransaction`, `restoreFromTrash` (`lib/trash.ts`), and `restoreTask` (`lib/archive.ts`) read the row before their transaction. A sign-in from another tab in that gap remembers a delete instead of queuing it, or queues nothing for a restore, and reconcile drops the task (`verify-task-tombstones`, `Finding-6-config-read.cfg` and `Finding-6-config-read-loss.cfg`).

Fix for the open bullet: each writer reads the row inside its own transaction. `SyncSession.cfg` models the code with the first three fixed, and it passes both account rules.

### `WEB-RESTORE-ONE-TABLE` · P3 · two restore paths write a live row beside an archive row

Both need another device's edit to arrive live before you tap Undo. In the first, you delete a task, the edit brings it back, it gets archived, and Undo's `restoreTask` (`lib/tasks/crud/restore.ts:21`) puts it in `tasks` beside the archive row. In the second, you delete an archived task forever, the edit brings it back, and Undo's `reinstateArchivedTask` (`lib/archive.ts:260`) writes the archive row beside the live one. The task then shows in two places, and a later restore can overwrite edits. Fix, as the model proposes it: Undo clears an archive row, and reinstate writes only when no table has the id. Evidence: `verify-task-tombstones`, `Finding-2-undo.cfg` and `Finding-3-reinstate.cfg`.

### `WEB-FAST-CLOCK-SPLIT` · P3 · a client with a fast clock can split a device that has nothing queued

A client whose clock runs far ahead (a year, in the replay) saves the task. Device B has nothing queued, so its pull takes that copy, and `clampClientTimestamp` (`lib/sync/task-mapper.ts:30`) stamps it now plus five minutes. Device A then pushes its older pending edit, and `isRemoteNewer` (`lib/sync/pb-push.ts:258`) never loses to a far-future stamp, so the server takes A's edit. B's realtime event and its pulls compare A's stamp with B's clamped one and keep the fast clock's copy. Web #700's hold-off covers only a device with a pending write. Evidence: `verify-sync-convergence`, `FindingFastClock.cfg`.

### `WEB-REMINDER-TWICE` · P3 · a reminder can show twice when a save lands while it shows

It needs a task whose `notifyBefore` is still null from a build before D-10. The checker awaits the settings read, the service worker, and `showNotification` before it marks the reminder sent. If `updateTask` or `settleRowOffset` (`lib/sync/pb-push.ts:78`) stores the null as the default in that gap, `isSameReminder` (`lib/notification-checker.ts:30`) sees a changed offset and skips the mark. The reminder shows again a minute later. Evidence: the replay, and the note on atomic steps in `docs/diagrams/reminder-model/README.md`. The model treats that gap as one step, so no config flips.

### `WEB-UNDO-COMPLETE-TRASH` · P3 (decision) · Undo on a completed repeating task puts a copy in Trash

Check off a daily task, then tap Undo on "Task completed". `handleToggle`'s Undo removes the next copy through `deleteTask`, which is the soft delete, so a copy you never deleted lands in Trash. Restoring it brings back two open copies. Decision first: is this a bug? Decide it with `WEB-UNCHECK-REPEATING`. Evidence: `docs/diagrams/task-lifecycle-model/`, `TaskLifecycleRecurring.cfg` and `TaskLifecycleRecurringBoard.cfg`.
