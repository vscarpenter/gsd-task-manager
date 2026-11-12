# Fix backlog from the formal verification skills

The four verify skills (`verify-task-tombstones`, `verify-sync-convergence`, `verify-sync-session`, `verify-reminders`) and the task lifecycle model (`docs/diagrams/task-lifecycle-model/`, which has no skill) found these on web `main` at `dd32e08c` (v14.8.0) on 2026-11-08. Production served 14.8.0 on 2026-11-09, checked from `sw.js`, so every row was live then. Each one was replayed in Vitest against the real code. As of 2026-11-12 (`main` at 14.8.7), three rows carry fixes: `WEB-UNDO-SIGNED-IN`, `WEB-LATE-AUTH-REFRESH`, and three of the four `WEB-SESSION-STALE-READ` bullets. See each row. The rest are open. The rows use the parity backlog's format, so the Project session can paste them into `parity/backlog.md`.

P1 means a lost task, a lost edit, or a common action that fails, on a path people take every day. P2 means the same harm behind a less common setup (a failed push, two accounts, an import), or another account's data. P3 means a narrow timing window, an unusual clock, or an annoyance. Within a priority, rows are in the suggested fix order. A "(decision)" row needs Vinny's call before anyone fixes it.

Each row names the skill or model that shows it, and the config when one exists. A fix updates the model in the same PR, the way that skill's `SKILL.md` says, and then the skill's sync commit (the commit its `SKILL.md` records as last checked) moves forward. The three `check.sh` scripts under `docs/formal/` differ. In `sync-convergence`, the finding's line changes to `holds`. In `task-tombstones`, the `Finding-*.cfg` and its line go. In `sync-session`, a `Broken*.cfg` that undoes the fix joins the list. The task lifecycle model has no `check.sh`. The reminder model has its own, at `docs/diagrams/reminder-model/check.sh`.

## P1

### `WEB-UNDO-SIGNED-IN` · P1 · Undo after a delete fails whenever you're signed in

**Fixed 2026-11-10** on `claude/eloquent-mccarthy-p7ybod`, merged in #714: the scope in `runTaskSyncTransaction` is now `async`. `tests/data/tasks/restore-signed-in.test.ts` reproduces the failure under fake-indexeddb ("Transaction committed too early", red before the change, green after), so a Chrome probe is no longer the only evidence. The rest of this entry describes the code before the fix.

`restoreTask` (`lib/tasks/crud/restore.ts:21`) throws Dexie's "Transaction committed too early" for a signed-in user. `runTaskSyncTransaction` (`lib/tasks/crud/helpers.ts:62`) passes a plain arrow as the transaction scope, so Dexie stops tracking the native awaits inside it. When `forgetForResurrect` returns early, the queue write runs in a transaction of its own. The task comes back here, but the toast says the Undo failed. Whether the restore still reaches the server wasn't checked. It started with #701 (`bf4ba13e`) and shipped in 14.8.0. A Chrome probe of the same writes, with the app's Dexie 4.4.6, failed 20 of 20 runs under a plain arrow and passed 20 of 20 under an `async` scope. The production app itself wasn't tried. Fix: make the scope `async`, with a red test under fake-indexeddb first. Evidence: `verify-task-tombstones` finding 7. It's outside the model, so no config changes.

### `WEB-STALE-DELETE-RESTORE` · P1 · one failed delete push plus a restore loses the task everywhere

You delete a task, then restore it from Trash, Undo, or an import before the delete reaches the server. In the next push the delete fails once, say on a dropped connection, and the create goes through. (A 429 doesn't do it: it stops the push loop before the create.) The sync after that sends the old delete. `isStaleDelete` (`lib/sync/pb-push.ts:250`) lets it pass, because the restored copy keeps its old `updatedAt`. Reconcile then drops the live task here, with no Trash row. Fix, as the model proposes it: the push (`pushDelete`, which `pushSingleItem` calls) drops a delete for an id that's live here. `isStaleDelete` is web's half of B-47 (SPEC-4). Next parity pass: check whether iOS #49 and Android's `remoteEditedAfterArchive` look at local liveness. Evidence: `verify-task-tombstones`, `Finding-5-stale-delete.cfg`.

### `WEB-PULL-CURSOR-SKIP` · P1 · an offline edit can miss another device for good

The pull cursor is one per account. It follows the newest `client_updated_at` among the records a pull applied here, capped at now, minus a 30-second overlap (`CURSOR_OVERLAP_MS` in `lib/sync/pb-pull.ts`). `updateSyncCursor` (`lib/sync/pb-sync-engine.ts:324`) stores it. An edit made offline keeps its old stamp. If another task moved device B's cursor past that stamp before the edit reached the server, B's pulls (`pullRemoteChanges`, `lib/sync/pb-pull.ts:214`) never ask for it. A closed tab misses the realtime event too. B shows the old copy until someone edits the task again. Under last-write-wins, B's own next edit of that task would then replace the offline edit everywhere. Fix: a design call, and a sync contract change for all three clients. The cursor pages on the writer's clock, and PocketBase can't filter on its system `updated` field, so the fix needs a stamp the server sets or another way to find late arrivals. Next parity pass: check iOS (`SyncCursor.swift`) and Android for the same shape. Evidence: `verify-sync-convergence`, `FindingOtherTaskCursor.cfg`.

## P2

### `WEB-LATE-AUTH-REFRESH` · P2 · a late token refresh can upload one account's task into another

**Fixed 2026-11-11.** `readPendingForSession` in `lib/sync/pb-push.ts` now reads the queue inside a transaction that calls `assertSyncSessionCurrent`, and the push repeats that session check before each row (`assertPushSessionCurrent`). `BrokenPushQueueFence.cfg` undoes the fix and breaks the `NoRecordInAnotherAccount` rule again. The second half shipped on 2026-11-12: `refreshAuthOutcome` in `lib/sync/pb-auth.ts` posts the refresh with `pb.send` and saves the answer only while the token that asked is still the stored one. A late answer reports `superseded` and is dropped. The rest of this entry describes the code before the fix.

It needed two accounts signed in, one after the other, on one browser. `pushLocalChanges` checked the SDK's principal once, then read the queue with no `assertSyncSessionCurrent`. In one replay, a sync tab's `authRefresh` was in flight while another tab signed out and signed in as B. Its late response saved A's token over B's, because `clearPocketBase` (`lib/sync/pocketbase-client.ts:49`) detaches only the tab that calls it. The push then read B's edit and created it in A's account. The refresh runs on every sync in a token's last seven days. A stale sign-in dialog in a second tab gets there too. The planned fix had two parts: read the queue inside a fenced transaction, and drop a refresh response when the session changed while it was in flight. Both have shipped. Related: `PUSH-IDENTITY` (P3) asks the same question of iOS. Evidence: `verify-sync-session`, `BrokenPushQueueFence.cfg`.

### `WEB-RETRIED-EDIT-RECREATES` · P2 · a retried edit brings a deleted task back on the server

You edit a task, then delete or archive it. The edit's push fails once, the delete goes through, and the retried edit creates the server record again. Your other devices then show the task you deleted. `pushSingleItem` (`lib/sync/pb-push.ts:265`) and the `pushUpsert` it calls never check whether the task is still live here. At `dd32e08c` the model checker (TLC) found a second way in: a push run that read its rows before a sign-out kept sending them after the next sign-in. The push now checks the session before each row (`assertPushSessionCurrent`), so a row check that lands while signed out, or under another account, stops it. The check compares only the account, so a sign-out and a sign-in as the same account between two row checks still pass. This row's replays predate that check. Fix, as the model proposes it: the push drops a create or update for an id in Trash or the archive here. Evidence: `verify-task-tombstones`, `Finding-4-stale-write.cfg`.

### `WEB-FAILED-PUSH-STRANDED` · P2 · an edit whose push retries run out never leaves the device

Five failed syncs in a row mark the queue row `failed` (`recordAttemptFailure`, `lib/sync/queue.ts:150`). `getPending` (`:103`) skips failed rows, and nothing re-arms them, so the server and every other device keep the old copy. The health monitor counts failed rows but never sends them again. Fix: re-arm failed rows on launch and on a manual sync, as iOS and Android do. That changes the rule in `HOLDOFF-FAILED-ROWS`, so the two land in the same PR. Evidence: `verify-sync-convergence`, `FindingRetriesRunOut.cfg`.

### `CONDITIONAL-UPDATE` · update to the existing P3 row · now replayed on web

`verify-sync-convergence` replayed this race against the real code (`FindingPushRace.cfg`). Both pushes read the original. B writes its edit, and A's upsert, decided on that stale read, overwrites it with A's older edit. Both open devices end on B's edit, but the server keeps A's, and so does any device that signs in later. Suggest raising the row to P2. The fix still needs the owner decision the row asks for.

### `WEB-IMPORT-TWO-TABLES` · P2 (decision) · an import can put one task in two tables

`applyTasks` (`lib/tasks/import-export.ts:373`) in merge mode gives a backup task a fresh id only when that id is live here. Merging a backup that has the task live, while it sits in Trash or the archive, leaves it in both. A replace with a 1.0.0 backup does the same, and `applyArchivedTasks` (`:244`) doesn't check `deletedTasks`. The task then shows in two places, and a later restore overwrites your edits or fails on a duplicate key. Decision first: rule 4 in `.claude/rules/archive-tombstone.md` calls the replace case legitimate, which contradicts rule 1. Evidence: `verify-task-tombstones`, `Finding-1-import.cfg`.

### `WEB-UNCHECK-REPEATING` · P2 (decision) · unchecking a repeating task leaves two open copies

Check off a daily task, then uncheck it. `toggleCompleted(id, false)` (`lib/tasks/crud/toggle.ts:49`) only flips the flag, so the next copy stays, and the board shows two open copies. Check it off again and a second next copy appears. Decision first: is this a bug? The comment on `handleToggle` (`components/matrix-simplified/task-actions.ts:78`) says Undo removes the copy so it won't leave an orphan, and unchecking is the reversal that does leave one. Evidence: `docs/diagrams/task-lifecycle-model/`, `TaskLifecycleRecurringBoard.cfg`, where both rules (`OneOpenCopy` and `TrashHoldsOnlyYourDeletes`) break in three steps.

## P3

### `WEB-SESSION-STALE-READ` · P3 · writers act on a `sync_config` read taken outside their transaction

Each one needs a second tab or a stale dialog, plus a window of a few IndexedDB round trips. The first three bullets were fixed on 2026-11-11 (#734). The fourth bullet is open and tracked as #735.

- Fixed. `disableSync` read the row before `resetSyncConfigState` opened its transaction. If A's sign-in saved in between, the signed-out row recorded no `localTaskOwnerUserId`, and B could then sign in and upload A's task. `resetSyncConfigState` now reads the row inside its transaction (`verify-sync-session`, `BrokenSignOutRead.cfg`).
- Fixed. `updateAutoSyncConfig` wrote `{...current, ...updates}` through `updateSyncConfig` with no transaction, so it could write A's row back over B's sign-in. `updateSyncConfig` now reads and writes in one transaction (`BrokenSettingsWrite.cfg`).
- Fixed. `persistSyncConfig` committed, then `populateFromExistingTasks` queued every task with no session check. A Reset Everything in between left A's task queued on an empty device, and B's push uploaded it. The sign-in transaction now queues the local tasks itself (`BrokenPopulate.cfg`).
- Open (#735). `runTaskSyncTransaction`, `restoreFromTrash` (`lib/trash.ts`), and the archive's `restoreTask` (`lib/archive.ts`) read the row before their transaction. That `restoreTask` is not Undo's `restoreTask` in `lib/tasks/crud/restore.ts`, which goes through `runTaskSyncTransaction`. If another tab signs in during that gap, the writer still acts as signed out. It remembers a delete instead of queuing it, and resurrect on sight brings the task back. Or it queues nothing for a restore, and reconcile drops the task (`verify-task-tombstones`, `Finding-6-config-read.cfg` and `Finding-6-config-read-loss.cfg`). `archiveOldTasks`, `archiveTaskNow`, and import's `resolveSyncDeps` read the row early in the same way, and the model does not cover them.

Fix for the open bullet: each of those three functions reads the row inside its own transaction. `SyncSession.cfg` models the code with the first three fixed, and it passes both account rules (`NoRecordInAnotherAccount` and `DeviceHoldsOnlyTheSignedInAccount`).

### `WEB-RESTORE-ONE-TABLE` · P3 · two restore paths write a live row beside an archive row

Both need another device's edit to arrive live before you tap Undo. In the first, you delete a task, the edit brings it back, it gets archived, and Undo's `restoreTask` (`lib/tasks/crud/restore.ts:21`) puts it in `tasks` beside the archive row. In the second, you delete an archived task forever, the edit brings it back, and Undo's `reinstateArchivedTask` (`lib/archive.ts:260`) writes the archive row beside the live one. The task then shows in two places, and a later restore can overwrite edits. Fix, as the model proposes it: Undo clears an archive row, and reinstate writes only when no table has the id. Evidence: `verify-task-tombstones`, `Finding-2-undo.cfg` and `Finding-3-reinstate.cfg`.

### `WEB-FAST-CLOCK-SPLIT` · P3 · a client with a fast clock can split a device that has nothing queued

A client whose clock runs far ahead (a year, in the replay) saves the task. Device B has nothing queued, so its pull takes that copy, and `clampClientTimestamp` (`lib/sync/task-mapper.ts:30`) stamps it now plus five minutes. Device A then pushes its older pending edit, and `isRemoteNewer` (`lib/sync/pb-push.ts:364`) never treats a stamp past the skew ceiling as newer. So A's push goes through, and the server takes A's edit. B's realtime event and its pulls compare A's stamp with B's clamped one and keep the fast clock's copy. Web #700's hold-off covers only a device with a pending write. Evidence: `verify-sync-convergence`, `FindingFastClock.cfg`.

### `WEB-REMINDER-TWICE` · P3 · a reminder can show twice when a save lands while it shows

It needs a task whose `notifyBefore` is still null from a build before D-10. The notification checker awaits the settings read, the service worker, and `showNotification` before it marks the reminder sent. If `updateTask` or `settleRowOffset` (`lib/sync/pb-push.ts:126`) stores the null as the default in that gap, `isSameReminder` (`lib/notification-checker.ts:30`) sees a changed offset and skips the mark. The reminder shows again a minute later. Evidence: the replay, and the note on atomic steps in `docs/diagrams/reminder-model/README.md`. The model treats that gap as one step, so no config changes.

### `WEB-UNDO-COMPLETE-TRASH` · P3 (decision) · Undo on a completed repeating task puts a copy in Trash

Check off a daily task, then tap Undo on "Task completed". `handleToggle`'s Undo removes the next copy through `deleteTask`, which is the soft delete, so a copy you never deleted lands in Trash. Restoring it brings back two open copies. Decision first: is this a bug? Decide it with `WEB-UNCHECK-REPEATING`. Evidence: `docs/diagrams/task-lifecycle-model/`, `TaskLifecycleRecurring.cfg` and `TaskLifecycleRecurringBoard.cfg`.
