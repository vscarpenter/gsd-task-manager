---
name: verify-task-tombstones
description: Model-checks, with TLA+ and TLC, where one task id lives on the web app (tasks, archivedTasks, deletedTasks, and the server) and every move between them, local or from sync, so a change can't put a task in two tables, bring a deleted task back, strand a newer edit in Trash, or lose a task you kept. Use when a change touches lib/archive.ts, lib/trash.ts, lib/use-auto-archive.ts, lib/tasks/crud/delete.ts, restore.ts, or helpers.ts (runTaskSyncTransaction), lib/tasks/import-export.ts (importTasks, applyTasks, applyArchivedTasks, applyTrashedTasks), lib/sync/pb-pull.ts (applyRemoteRecords, applyPreparedRecord, reconcileDeletedTasks), lib/sync/pb-sync-engine.ts (applyRemoteChange, applyRemoteDeletion, fullSync), lib/sync/pb-push.ts (pushSingleItem, isStaleDelete), lib/sync/queue.ts (classifyRemoteDeletion, getPending, populateFromExistingTasks), lib/sync/resurrect-on-sight.ts, lib/sync/resurrect-ids.ts, lib/sync/pb-sync-helpers.ts (isRemoteNewerThanArchive), lib/sync/config/disable.ts, or components/sync/use-sync-auth-dialog.ts (persistSyncConfig). Also use when adding any writer to tasks, archivedTasks, or deletedTasks.
---

# Verify task tombstones

A TLA+ model of one task id on the web app lives in `docs/formal/task-tombstones/`. It follows the task's row in `tasks`, `archivedTasks`, and `deletedTasks`, the server's copy, and the sync queue. TLC checks every order of your actions, another device's edits and deletes, realtime events, and each step of a sync. A pass covers the model, not the whole app, so read "Bounds and what's left out" before you trust one.

**The property:** a task id lives in one place on this device, moves only when you act or a newer edit beats your delete, and is never gone from every side unless you deleted it.

**The harm when it breaks:** a task you deleted comes back, a task you kept disappears from every device, or one task shows in your matrix and in Trash at once.

## The rules

Each rule is an INVARIANT in `TaskTombstones.tla`.

| Rule | What the app promises | The harm when it breaks |
|---|---|---|
| `OneTable` | A task id is in at most one of `tasks`, `archivedTasks`, and `deletedTasks` (rule 1 of ADR 0013 and ADR 0015). | The task shows in two places, and a later restore overwrites your edits or fails on a duplicate key. |
| `NoComeback` | A server copy no newer than the Trash or archive row never brings the task back. Resurrect on sight may, but only for a delete that never reached the server. | A task you deleted or archived reappears in your matrix. |
| `NewerEditWins` | A server copy edited after you deleted or archived the task takes it out of Trash or the archive (rule 2). | Another device's later edit is stranded in your Trash or archive. |
| `ServerStaysDeleted` | Once your delete or archive has removed the server copy, nothing this device pushes puts it back while the task is still in Trash or the archive here. | A task you deleted comes back on your other devices. |
| `NoLoss` | A task you didn't delete or archive is in your matrix, archive, or Trash, or on the server. | A task you kept, restored, or imported vanishes everywhere with no Trash copy. |

`NoComeback`, `NewerEditWins`, and `ServerStaysDeleted` judge one step at a time, through ghost variables the step sets. They judge only steps that start with the task in one table, so a two-table state is reported once, by `OneTable`. `TypeOK` keeps each variable in its range. It guards the model, not the app.

## The findings

The code as it is breaks four of the five rules. On 2026-11-08 each path was replayed in Vitest against the real writers, and each one reproduced. None is fixed yet.

1. **An import writes an id into a second table** (`OneTable`, `Finding-1-import.cfg`). `applyTasks` in merge mode gives a backup task a fresh id only when the id is live here. Merging a backup that has the task live, while it's in Trash or archived, leaves it in both. A replace with a 1.0.0 backup does the same. `applyArchivedTasks` doesn't check `deletedTasks`, so an archived row lands beside a Trash row. Rule 4 in `.claude/rules/archive-tombstone.md` calls the replace case legitimate, which contradicts rule 1.
2. **Undo doesn't clear an archive row** (`OneTable`, `Finding-2-undo.cfg`). You delete the task, another device edits it, that edit arrives live, the task is archived, and then you press Undo. `restoreTask` in `lib/tasks/crud/restore.ts` puts it back in `tasks` and leaves the archive row.
3. **Reinstate checks only the archive** (`OneTable`, `Finding-3-reinstate.cfg`). You delete an archived task forever, another device edits it, that edit arrives live, and you press Undo on that toast. `reinstateArchivedTask` writes the archive row beside the live one.
4. **A queued edit re-creates a deleted task's server copy** (`ServerStaysDeleted`, `Finding-4-stale-write.cfg`). You edit the task and then delete or archive it. The edit's push fails once, the delete goes through, and the retried edit creates the server record again. `pushSingleItem` never asks where the task lives here. TLC's shortest path gets there another way: a push run that read its rows before a sign-out keeps sending them after the next sign-in.
5. **A queued delete removes a restored task everywhere** (`NoLoss`, `Finding-5-stale-delete.cfg`). You delete the task, then restore it from Trash, Undo, or import it. The delete's push fails once and the create goes through. The next sync sends the old delete, and `isStaleDelete` lets it pass, because the restored copy keeps its old `updatedAt`. Reconcile then drops the live task with no Trash row.
6. **Writers act on the session they read before their transaction** (`NoComeback` in `Finding-6-config-read.cfg`, `NoLoss` in `Finding-6-config-read-loss.cfg`). `runTaskSyncTransaction`, `restoreFromTrash`, and `restoreTask` in `lib/archive.ts` read `sync_config` before the transaction opens. If a sign-in from another tab lands in that gap, a delete is remembered instead of queued, and resurrect on sight brings it back. A restore in the same gap queues nothing, and reconcile drops the task.
7. **Outside the model: Undo fails while signed in.** `restoreTask` in `lib/tasks/crud/restore.ts` throws Dexie's "Transaction committed too early". `runTaskSyncTransaction` passes a plain arrow, not an `async` function, as the transaction scope, so Dexie stops tracking the native awaits. When `forgetForResurrect` returns early, the queue write runs in a transaction of its own. The task comes back anyway, but the toast says the Undo failed. It started with #701 (`bf4ba13e`). It showed first under fake-indexeddb. On 2026-11-08 a probe of the same writes in Chrome, with the app's Dexie 4.4.6, failed 20 of 20 runs under a plain arrow scope and passed 20 of 20 under an `async` one. A simpler probe with fewer awaits passed under both, so the failure depends on how many native awaits sit between two writes.

`Fixed.cfg` applies one proposed fix per finding, listed in `AllFixes` in the model, and every rule holds. Each `Finding-*.cfg` applies every fix but its own, so it shows that finding alone. The fixes are proposals, not code. Model the code's real fix when one lands.

## Run the check

```sh
bash docs/formal/task-tombstones/check.sh
```

It runs 14 configs through `scripts/tlc.sh`, which pins TLC 1.7.4 by hash and finds Java 21. The first run downloads the jar. A full run takes about 70 seconds, most of it `Fixed.cfg`. It prints one line per config and exits 0 only when every line says `ok`:

```
ok   TaskTombstones               expected OneTable           got OneTable                 34 states    1s
ok   Fixed                        expected holds              got holds               1234722 states   32s
ok   Finding-1-import             expected OneTable           got OneTable                 34 states    0s
ok   Finding-2-undo               expected OneTable           got OneTable              21308 states    1s
ok   Finding-3-reinstate          expected OneTable           got OneTable               3929 states    1s
ok   Finding-4-stale-write        expected ServerStaysDeleted got ServerStaysDeleted    23930 states    2s
ok   Finding-5-stale-delete       expected NoLoss             got NoLoss               263555 states    5s
ok   Finding-6-config-read        expected NoComeback         got NoComeback           382731 states    8s
ok   Finding-6-config-read-loss   expected NoLoss             got NoLoss               440486 states    8s
ok   Broken-restoreKeepsTrashRow  expected OneTable           got OneTable                317 states    1s
ok   Broken-pullSkipsTrashGuard   expected NoComeback         got NoComeback             1682 states    1s
ok   Broken-absoluteTombstone     expected NewerEditWins      got NewerEditWins           236 states    1s
ok   Broken-resurrectSkipsDelete  expected NoComeback         got NoComeback           369018 states    8s
ok   Broken-reconcileSkipsQueue   expected NoLoss             got NoLoss                80804 states    2s
TLC output: /var/folders/.../task-tombstones.XXXXXX
```

`TaskTombstones.cfg` is the code as it is. TLC stops at the first rule that breaks, which is `OneTable`. `Fixed.cfg` must hold. Each `Broken-*.cfg` sets the `Variant` constant on top of every fix, removing one guard the code has, so each rule has been seen to fail. `NewerEditWins` holds on the code as it is (3,020,211 states on 2026-11-08, checked alone). The `Finding-*` configs show the other rules each failing on real paths.

A new break usually flips several lines at once, because TLC reports only the first rule it finds broken, and a short new path can come before a finding's longer one. Start from `Fixed`: it has every fix on, so its break is the new one.

Read every result, pass or fail, with the pstack `/statechart` skill. On a break, it tells TLC's shortest path as steps in plain words. Give it `view.mjs` as the view, and send its output to a scratch folder outside the repo. The model is far over the chart's state budget, so the chart draws only the bug paths. For a passing config, it lists no path and draws no chart. Then name what you checked instead.

## When a change touches this code

1. **See what changed.** Diff the covered files from the sync commit (below): `git diff dd32e08c -- lib/archive.ts lib/trash.ts lib/use-auto-archive.ts lib/tasks/crud lib/tasks/import-export.ts lib/sync components/sync/use-sync-auth-dialog.ts`. Then look for new writers: `rg -n "db\.(tasks|archivedTasks|deletedTasks)\.(put|add|bulkPut|bulkAdd|delete|bulkDelete|clear|update)" lib components app`, and compare the hits with the coverage record.
2. **Run the check before you touch the model.** A pass here only says the old description still holds.
3. **Map each change to a model action** through the coverage record. A change has no effect, or the model no longer describes the code, or the promise changed on purpose, or the promise may be broken. Decide from the model, not from the commit message.
4. **Update `TaskTombstones.tla` from the code**, as "Update the model for an intended change" says. Write the update before you rerun, and don't shape it by what passes.
5. **Rerun the check and read the result with `/statechart`.** A config that no longer matches is the signal. If `Fixed.cfg` breaks, the change broke a rule the fixes otherwise keep. If a `Finding-*` config now holds, the change fixed that finding. Replay any new break against the code (next section).
6. **Break the new guard once.** If the change adds a guard, add a `Variant` that removes it, a `Broken-*.cfg` for it, and a line in `check.sh`. Confirm the rule fails. A model that can't fail proves nothing.
7. **Move the sync commit** only when every change is accounted for and the check matches.

## Real bug or modeling error

Replay the path against the real code before you call it either. Write a Vitest file under `tests/data/`, one step per model action, in the order `/statechart` gives. Copy the setup of `tests/data/sync/resurrect-on-sight.test.ts`: it mocks `@/lib/sync/pocketbase-client`, `@/lib/sync/pb-auth`, and `@/lib/sync/notifications`, and points the client at `tests/data/sync/support/fake-pocketbase.ts`.

| Model action | What the replay does |
|---|---|
| `YouStart` then `YouDelete`, `YouUndo`, `YouRestoreFromTrash`, `YouRestoreFromArchive` | `deleteTask(id)`, `restoreTask(record)` from `@/lib/tasks/crud`, `restoreFromTrash(id)`, `restoreTask(id)` from `@/lib/archive`. For a sign-in in the gap, mock `@/lib/sync/config` so `getSyncConfig` reads, then awaits `persistSyncConfig(AUTH)` once, then returns what it read |
| `YouEdit` | `updateTask(id, { ... })` |
| `YouArchive` | `archiveTaskNow(id)`, or `archiveOldTasks(days)` on a task completed long ago |
| `YouEmptyTrash`, `TrashExpires` | `deleteFromTrashForever(id)` or `emptyTrash()`, `purgeExpiredTrash()` |
| `YouDeleteArchived`, `YouUndoDeleteArchived` | `deleteArchivedTask(id)`, `reinstateArchivedTask(row)` |
| `YouImport` | `importTasks(payload, mode)`. The import schema wants ids of four characters or more |
| `YouSignIn`, `YouSignOut` | `persistSyncConfig(AUTH)`, `disableSync()` |
| `OtherDeviceEdits`, `OtherDeviceDeletes` | write or delete in `fake.state.records`. A newer edit takes a stamp a second after now, inside the skew ceiling |
| `RealtimeArrives` | `applyRemoteChange('update' or 'delete', record, 'user-1')` |
| `SyncStarts` through `ResurrectApplies` | `fullSync('user')`. A `PushFails` is the fake's `update`, `create`, or `delete` throwing a 503 once. A 429 stops the push loop, so don't use one |

Two traps. Queue rows sort by a millisecond timestamp, and a tie sorts by random id, so wait a few milliseconds between writes that queue rows. Undo while signed in throws today (finding 7), so a path that needs it can sign out first, which the model allows while a toast is up.

Run it with `bun run test tests/data/<file>.test.ts`, then `mv` it to a scratch folder outside the repo. Never commit a replay. Agents can't run `rm` here, so move unwanted files with `mv`.

- **Every step happens and the harm shows:** it's a bug in the code. Find the commit that brought it in with `git log -L` on the changed function. Report the path in the code's words and the harm in one sentence. Don't weaken a rule or the model to make the check pass, and don't change product code unless the user asks.
- **A step can't happen in the code:** the model is wrong. Fix the action so it matches the code, say what was wrong, and rerun.

## Update the model for an intended change

- **The code changed shape.** Edit the action the coverage record names. One Dexie transaction is one action. A read before the transaction opens is its own step, as `YouStart` is for the session read. A network read and the transaction that uses it are two steps, as `PullFetches` and `PullApplies` are.
- **A new writer reaches `tasks`, `archivedTasks`, or `deletedTasks`.** Add an action for it, put it in `Next`, and add a row to the coverage record. It also needs a row in the writer table of `.claude/rules/archive-tombstone.md`. If it can move the task between tables, add it to the view's `step()` labels.
- **A finding is fixed in the code.** Make the model's code path do what the fix does. Remove that fix's `Fix(...)` test so the fixed branch always runs, drop it from `AllFixes`, delete its `Finding-*.cfg`, remove its line from `check.sh`, and update the expected first break of `TaskTombstones.cfg`. When the last finding is fixed, `TaskTombstones.cfg` must hold.
- **A new guard protects a rule.** Add a `Variant` value that removes it, a `Broken-*.cfg` for it with every fix on, and a line in `check.sh`.
- **The promise changed on purpose.** Change a rule only with evidence: a spec, an ADR, an owner decision, or the tests and commit message of the change. Put the old wording, the new wording, and the evidence in the commit message and in the rule's comment.
- Keep the model update in its own commit, apart from any product fix.

## Coverage record

| Model part | File | Function |
|---|---|---|
| `Take`, `ApplyCopy`, `Newer` | `lib/sync/pb-pull.ts` | `applyPreparedRecord`, `remoteVersionWins`, `acceptsRemoteVersion` |
| | `lib/sync/pb-sync-engine.ts` | `applyRemoteChange`, `localCopyHolds` |
| | `lib/sync/pb-sync-helpers.ts` | `isRemoteNewerThanArchive` |
| `YouStart`, `Cfg`, `Quiet` | `lib/tasks/crud/helpers.ts`, `lib/trash.ts`, `lib/archive.ts` | `runTaskSyncTransaction`, `restoreFromTrash`, `restoreTask`: `getSyncConfig` before the transaction |
| `YouDelete` | `lib/tasks/crud/delete.ts`, `lib/sync/resurrect-ids.ts` | `deleteTask`, `rememberForResurrect` |
| `YouUndo` | `lib/tasks/crud/restore.ts` | `restoreTask`, `forgetForResurrect` |
| `YouRestoreFromTrash` | `lib/trash.ts` | `restoreFromTrash` |
| `YouRestoreFromArchive` | `lib/archive.ts` | `restoreTask` (`tasks.add` throws on a live id) |
| `YouEdit` | `lib/tasks/crud/update.ts` | `updateTask`, and every live edit through `runTaskSyncTransaction` |
| `YouArchive` | `lib/archive.ts`, `lib/use-auto-archive.ts` | `archiveOldTasks`, `archiveTaskNow`, `chooseArchiveSnapshot`; `useAutoArchive` runs it after a pull while signed in |
| `YouEmptyTrash`, `TrashExpires` | `lib/trash.ts` | `deleteFromTrashForever`, `emptyTrash`, `purgeExpiredTrash` |
| `YouDeleteArchived`, `YouUndoDeleteArchived` | `lib/archive.ts` | `deleteArchivedTask`, `reinstateArchivedTask` |
| `YouImport` | `lib/tasks/import-export.ts`, `lib/tasks/import-id-remap.ts` | `importTasks`, `applyTasks`, `applyArchivedTasks`, `applyTrashedTasks`, `regenerateConflictingIds` |
| `YouSignIn` | `components/sync/use-sync-auth-dialog.ts`, `lib/sync/queue.ts` | `persistSyncConfig`, `populateFromExistingTasks` |
| `YouSignOut` | `lib/sync/config/disable.ts`, `lib/sync/resurrect-ids.ts` | `disableSync`, `resetSyncConfigState`, `trashDeleteTaskIds` |
| `OtherDeviceEdits`, `OtherDeviceDeletes` | `lib/sync/pb-push.ts` on the other device | `upsertRemoteTask` re-creates a deleted record; its delete removes it |
| `RealtimeArrives` | `lib/sync/pb-realtime.ts`, `lib/sync/pb-sync-engine.ts`, `lib/sync/queue.ts` | the `device_id` echo filter, `applyRemoteChange`, `applyRemoteDeletion`, `classifyRemoteDeletion` |
| `SyncStarts`, `PushSends`, `PushFails`, `PushDone` | `lib/sync/pb-sync-engine.ts`, `lib/sync/pb-push.ts`, `lib/sync/queue.ts` | `fullSync`, `runSyncPasses`, `pushLocalChanges`, `pushSingleItem`, `isStaleDelete`, `isRemoteNewer`, `getPending`, `recordAttemptFailure` |
| `PullFetches`, `PullFails`, `PullApplies` | `lib/sync/pb-pull.ts` | `pullRemoteChanges`, `applyRemoteRecords` |
| `ReconcileFetches`, `ReconcileSkips`, `ReconcileApplies` | `lib/sync/pb-pull.ts`, `lib/sync/pb-sync-helpers.ts` | `reconcileDeletedTasks`, `planRemoteAbsence`, `fetchRemoteTaskIndex`, `confirmSessionIdentity` |
| `ResurrectLists`, `ResurrectSkips`, `ResurrectApplies` | `lib/sync/resurrect-on-sight.ts` | `resurrectOnSight`, `listAccount`, `applyResurrections`, `resurrectOne`, `waitsForThisDevice`, `takeIfStrictlyNewer`, `forgetAllBut` |
| every sync write's session check | `lib/sync/sync-session.ts` | `assertSyncSessionCurrent` |
| `Variant` values | the files above | `restoreKeepsTrashRow`, `pullSkipsTrashGuard`, `absoluteTombstone`, `resurrectSkipsDelete`, and `reconcileSkipsQueue` each remove one guard |

These write the same tables, and the model leaves them out on purpose. Migration v15 in `lib/db.ts` runs once at upgrade. `lib/reset-local-data.ts` and Reset Everything clear every table at once. `resetTaskNotification` and `snoozeTaskNotification` in `lib/notification-checker.ts` have no callers today. They read and then `put` outside a transaction, so a caller would be a new writer that can put a deleted task back in `tasks`. The MCP server writes the server only, so its edits reach this device as another device's do.

## Sync commit

**`dd32e08c`** (`chore(release): v14.8.0 (#712)`, on `main`), confirmed 2026-11-08. The model was first written against it. The same day, a dry run of this skill removed the `return` from the `protect` branch of `applyRemoteDeletion`. Once `RealtimeArrives` described that code, `Fixed.cfg` broke `NoLoss` in three steps: another device deletes the task, you edit it, and that delete arrives live. A replay showed the task gone from every side, and the check matched again once the change was dropped.

Move this commit forward only after you've read every change to covered code since it, updated the model where needed, and seen the check match. If the check is blocked, leave the commit where it is and say so. Record a commit on `main`, because a squash merge drops branch commits.

## Bounds and what's left out

- **One task id, one web device, and the server.** Another device acts only on the server. Its own Trash, its queue, and its stale deletes aren't modeled. Dependencies and subtasks on other tasks are left out.
- **Bounds:** stamps up to 4, so three stamps after the starting version, at most three queue rows, and one import per run. `Fixed.cfg` covers 1,234,722 states in about 32 seconds. Each added stamp multiplies the states several times over, so raise `MaxClock` only for a one-off run.
- **Time has no skew.** Every stamp is later than the ones before it, so the far-future hold-off (`holdsOffFarFutureRemote`) never fires, and the pull cursor never hides a newer edit. The model's pull reads the server copy whatever its stamp, as the first pull after a sign-in does.
- **A push's server read, write, and dequeue are one step.** Another device can edit between the read and the delete in the code. That race is conditional delete's (the B-47 remainder), with its own spec.
- **Ordinary syncs only.** The backfill sync that pulls before it pushes, and its field repair, aren't modeled.
- **Only a sign-in or sign-out lands between a writer's config read and its transaction.** The gap is a few microtasks. Any other step there has the same effect as one before the read, because the transaction re-reads every row except the config.
- **A toast's Undo survives background steps and closes at your next explicit action.** The delete toast lasts five seconds (`TOAST_DURATION.LONG`), and the archive page's toast uses sonner's default. Auto-archive counts as a background step, and the model doesn't gate it on a pull.
- **Any live task can be archived.** The completed-and-old test that `archiveOldTasks` applies isn't modeled.
- **Each writer's transaction is atomic.** Finding 7 shows Undo's isn't today.
- **Realtime holds one event.** A newer event from the other device replaces one not yet delivered, and sign-out drops it.
- **Trash expiry counts as your delete.** ADR 0015 makes Trash the safety floor, so a task reconcile moved to Trash, because its edits never reached the server, may expire after 30 days. `NoLoss` doesn't count that.
- **Not modeled:** the device-local fields that `mapOverLocalCopy` carries over, migration v15, Reset Everything, the MCP server, and the iOS and Android clients.

## Related skills

- `/statechart` (pstack): read every result of the check.
- `/maintain-formal-verification-skill` (pstack): bring this model back in line after changes that skipped this skill.
