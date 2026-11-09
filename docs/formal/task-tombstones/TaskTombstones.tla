---------------------------- MODULE TaskTombstones ----------------------------
\* One task id on the web app: which local table holds it (tasks, archivedTasks,
\* deletedTasks), the server's copy, and every move between them, local or from
\* sync. Another device acts only through the server. Each action names the
\* function it models. An action is one Dexie transaction where the code runs
\* one, and a read the code makes before its transaction opens is a step of its own.
\*
\* Code: lib/tasks/crud/delete.ts, lib/tasks/crud/restore.ts,
\* lib/tasks/crud/helpers.ts, lib/trash.ts, lib/archive.ts,
\* lib/tasks/import-export.ts, lib/sync/queue.ts, lib/sync/pb-push.ts,
\* lib/sync/pb-pull.ts, lib/sync/pb-sync-engine.ts, lib/sync/pb-sync-helpers.ts,
\* lib/sync/resurrect-on-sight.ts, lib/sync/resurrect-ids.ts,
\* lib/sync/config/disable.ts, components/sync/use-sync-auth-dialog.ts.
EXTENDS Naturals, Sequences

CONSTANTS
  MaxClock,  \* the last timestamp a step may take
  MaxQueue,  \* the most queue rows the model follows
  Variant,   \* "code", or one broken variant named in Broken below
  Fixes      \* the proposed fixes in AllFixes the model applies; {} is the code as it is

VARIABLES
  live,        \* the tasks row: [has, ver]; at is always 0
  arc,         \* the archivedTasks row: [has, ver, at]; at is archivedAt
  trash,       \* the deletedTasks row: [has, ver, at]; at is deletedAt
  srv,         \* the server record: [has, ver]; ver is client_updated_at
  queue,       \* syncQueue rows for the task, oldest first
  clock,       \* the next timestamp; every stamp is later than the ones before it
  signedIn,    \* sync_config is enabled and names the account
  remembered,  \* the id is on the resurrect_on_sight list
  rt,          \* the other device's newest realtime event, not yet delivered
  phase,       \* how far the running fullSync has got
  todo,        \* rows this run's push read with getPending() and hasn't sent yet
  seen,        \* what this run's last server read returned
  pend,        \* a local action that has read sync_config but not opened its transaction
  undo,        \* the record version the "Task deleted" toast's Undo holds; 0 when none
  arcUndo,     \* the row the archive's "deleted forever" toast's Undo holds
  want,        \* ghost: "keep" unless your latest act deleted or archived the task
  unsent,      \* ghost: your latest Trash delete will never reach the server
  cameBack,    \* ghost: this step took the task out of a tombstone for a copy no newer than it
  owed,        \* ghost: this step left the task in a tombstone that a newer copy beats
  revived,     \* ghost: this step's push re-created the server copy of a task tombstoned here
  imported     \* you have imported a backup; the model allows one import

vars == <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, phase,
          todo, seen, pend, undo, arcUndo, want, unsent, cameBack, owed, revived,
          imported>>

\* Proposed fixes, one per finding. None of them is in the code.
AllFixes == {
  "importKeepsOneTable",       \* importTasks never writes an id into a second table
  "undoClearsArchive",         \* restoreTask (Undo) also clears an archivedTasks row
  "reinstateChecksAllTables",  \* reinstateArchivedTask writes only when no table has the id
  "pushDropsTombstonedWrite",  \* pushSingleItem drops a create or update for an id in Trash or the archive here
  "pushDropsDeleteOfLiveTask", \* pushSingleItem drops a delete for an id that is live here
  "readConfigInTransaction"    \* the writers read sync_config inside their transaction
}
Fix(f) == f \in Fixes

\* Broken variants. Each removes one guard from the code it names.
Broken == {
  "restoreKeepsTrashRow",  \* restoreFromTrash without db.deletedTasks.delete
  "pullSkipsTrashGuard",   \* applyPreparedRecord and applyRemoteChange without the deletedTasks check
  "absoluteTombstone",     \* isRemoteNewerThanArchive always false (ADR 0013's rejected first version)
  "resurrectSkipsDelete",  \* waitsForThisDevice without the pending-delete check
  "reconcileSkipsQueue"    \* reconcileDeletedTasks without classifyRemoteDeletion's protect
}

NoRow == [has |-> FALSE, ver |-> 0, at |-> 0]
Row(v, a) == [has |-> TRUE, ver |-> v, at |-> a]
NoCopy == [has |-> FALSE, ver |-> 0]
Copy(v) == [has |-> TRUE, ver |-> v]
NoEvent == [kind |-> "none", ver |-> 0]
NoPend == [act |-> "none", cfg |-> FALSE, ver |-> 0]
QRow(op, pay, at) == [op |-> op, pay |-> pay, at |-> at, failed |-> FALSE]

\* A backup the user exported at the start, when the task stood at version 1.
BackupLive == Row(1, 0)
BackupRow == Row(1, 1)

Phases == {"idle", "push", "pull", "apply", "reconcile", "reconcileApply",
           "resurrect", "resurrectApply"}
Acts == {"none", "delete", "undo", "restoreTrash", "restoreArchive"}

TypeOK ==
  /\ \A r \in {live, arc, trash} : r.has \in BOOLEAN /\ r.ver \in Nat /\ r.at \in Nat
  /\ srv.has \in BOOLEAN /\ srv.ver \in Nat
  /\ \A i \in 1..Len(queue) :
       /\ queue[i].op \in {"create", "update", "delete"}
       /\ queue[i].pay \in Nat /\ queue[i].at \in Nat /\ queue[i].failed \in BOOLEAN
  /\ clock \in Nat /\ signedIn \in BOOLEAN /\ remembered \in BOOLEAN
  /\ rt.kind \in {"none", "update", "delete"} /\ phase \in Phases
  /\ pend.act \in Acts /\ undo \in Nat /\ arcUndo.has \in BOOLEAN
  /\ want \in {"keep", "dropped"} /\ unsent \in BOOLEAN
  /\ cameBack \in BOOLEAN /\ owed \in BOOLEAN /\ revived \in BOOLEAN /\ imported \in BOOLEAN

Init ==
  /\ live = Row(1, 0) /\ arc = NoRow /\ trash = NoRow
  /\ srv = Copy(1) /\ queue = <<>> /\ clock = 2
  /\ signedIn = TRUE /\ remembered = FALSE /\ rt = NoEvent
  /\ phase = "idle" /\ todo = <<>> /\ seen = NoCopy
  /\ pend = NoPend /\ undo = 0 /\ arcUndo = NoRow
  /\ want = "keep" /\ unsent = FALSE
  /\ cameBack = FALSE /\ owed = FALSE /\ revived = FALSE /\ imported = FALSE

Flags(c, o, r) == cameBack' = c /\ owed' = o /\ revived' = r
NoFlags == Flags(FALSE, FALSE, FALSE)

InOneTable ==
  (IF live.has THEN 1 ELSE 0) + (IF arc.has THEN 1 ELSE 0) + (IF trash.has THEN 1 ELSE 0) <= 1
Tombstoned == arc.has \/ trash.has

Pending(r) == ~r.failed
HasPending == \E i \in 1..Len(queue) : Pending(queue[i])
AnyFailed == \E i \in 1..Len(queue) : queue[i].failed
PendingDelete(q) == \E i \in 1..Len(q) : q[i].op = "delete" /\ Pending(q[i])
\* trashDeleteTaskIds: a Trash delete carries no payload; an archive's delete carries the task.
TrashDeleteQueued == \E i \in 1..Len(queue) : queue[i].op = "delete" /\ queue[i].pay = 0
Without(q, a) == SelectSeq(q, LAMBDA r : r.at # a)
Enqueue(op, pay) ==
  /\ queue' = Append(queue, QRow(op, pay, clock))
  /\ clock' = clock + 1

\* The gap between a writer's getSyncConfig() and its transaction is a few
\* microtasks, so only a sign-in or sign-out (from another tab) lands in it. Any
\* other step there has the same effect as one before the read, because the
\* transaction re-reads every row except the config.
Quiet == pend.act = "none"

---------------------------------------------------------------------------
\* Applying a server copy, shared by the pull and realtime.

\* isRemoteNewerThanArchive (pb-sync-helpers.ts). The model has no clock skew.
Newer(v, at) == IF Variant = "absoluteTombstone" THEN FALSE ELSE v > at

\* applyPreparedRecord (pb-pull.ts) and applyRemoteChange (pb-sync-engine.ts):
\* the archive guard, then the Trash guard, then last-write-wins over the live row.
Suppressed(v) ==
  \/ arc.has /\ ~Newer(v, arc.at)
  \/ trash.has /\ ~Newer(v, trash.at) /\ Variant # "pullSkipsTrashGuard"

Take(v) ==
  IF Suppressed(v) \/ (live.has /\ v <= live.ver)
  THEN [live |-> live, arc |-> arc, trash |-> trash]
  ELSE [live |-> Row(v, 0), arc |-> NoRow, trash |-> NoRow]

\* Apply server copy version v. The ghosts judge only a step that starts with the
\* task in one table; OneTable reports the rest.
ApplyCopy(v) ==
  LET t == Take(v) IN
  /\ live' = t.live /\ arc' = t.arc /\ trash' = t.trash
  /\ Flags(InOneTable /\ t.live.has /\ ((arc.has /\ ~t.arc.has /\ v <= arc.at)
                                         \/ (trash.has /\ ~t.trash.has /\ v <= trash.at)),
           InOneTable /\ ((arc.has /\ v > arc.at /\ t.arc.has) \/ (trash.has /\ v > trash.at /\ t.trash.has)),
           FALSE)

---------------------------------------------------------------------------
\* Your actions on this device.

\* getSyncConfig() resolves before the Dexie transaction opens (runTaskSyncTransaction
\* in lib/tasks/crud/helpers.ts, restoreFromTrash in lib/trash.ts, restoreTask in
\* lib/archive.ts), so the transaction acts on the session it read here.
CanStart(a) ==
  CASE a = "delete" -> live.has
    [] a = "undo" -> undo > 0
    [] a = "restoreTrash" -> trash.has
    [] a = "restoreArchive" -> arc.has
    [] OTHER -> FALSE

\* An Undo toast lasts seconds (TOAST_DURATION.LONG is 5). Here a toast's Undo
\* survives every background step and closes at your next explicit action.
YouStart(a) ==
  /\ Quiet /\ CanStart(a)
  /\ pend' = [act |-> a, cfg |-> signedIn, ver |-> IF a = "undo" THEN undo ELSE 0]
  /\ undo' = IF a = "undo" THEN undo ELSE 0
  /\ arcUndo' = NoRow
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt,
                 phase, todo, seen, want, unsent, imported>>
  /\ NoFlags

\* The session the transaction acts on.
Cfg == IF Fix("readConfigInTransaction") THEN signedIn ELSE pend.cfg

\* deleteTask (lib/tasks/crud/delete.ts): one transaction over tasks, deletedTasks,
\* syncQueue, and syncMetadata. Signed in, it queues the delete; signed out, it
\* remembers the id for resurrect on sight (rememberForResurrect).
YouDelete ==
  /\ pend.act = "delete" /\ pend' = NoPend
  /\ IF ~live.has
     THEN UNCHANGED <<live, trash, queue, clock, remembered, undo, want, unsent, imported>>
     ELSE /\ trash' = Row(live.ver, clock) /\ live' = NoRow
          /\ undo' = live.ver
          /\ IF Cfg
             THEN Enqueue("delete", 0) /\ UNCHANGED remembered
             ELSE remembered' = TRUE /\ clock' = clock + 1 /\ UNCHANGED queue
          /\ want' = "dropped" /\ unsent' = ~signedIn
  /\ UNCHANGED <<arc, srv, signedIn, rt, phase, todo, seen, arcUndo, imported>>
  /\ NoFlags

\* restoreTask (lib/tasks/crud/restore.ts), the toast's Undo: puts the held record
\* back with put, clears any Trash row, forgets the id, and queues a create when
\* signed in. It doesn't look at archivedTasks.
YouUndo ==
  /\ pend.act = "undo" /\ pend' = NoPend
  /\ live' = Row(pend.ver, 0) /\ trash' = NoRow /\ remembered' = FALSE
  /\ arc' = IF Fix("undoClearsArchive") THEN NoRow ELSE arc
  /\ undo' = IF undo = pend.ver THEN 0 ELSE undo
  /\ IF Cfg THEN Enqueue("create", pend.ver) ELSE UNCHANGED <<queue, clock>>
  /\ want' = "keep"
  /\ UNCHANGED <<srv, signedIn, rt, phase, todo, seen, arcUndo, unsent, imported>>
  /\ NoFlags

\* restoreFromTrash (lib/trash.ts): one transaction over tasks, deletedTasks,
\* syncQueue, and syncMetadata. The task keeps the trashed record's updatedAt.
YouRestoreFromTrash ==
  /\ pend.act = "restoreTrash" /\ pend' = NoPend
  /\ IF ~trash.has
     THEN UNCHANGED <<live, trash, queue, clock, remembered, want>>
     ELSE /\ live' = Row(trash.ver, 0)
          /\ trash' = IF Variant = "restoreKeepsTrashRow" THEN trash ELSE NoRow
          /\ remembered' = FALSE
          /\ IF Cfg THEN Enqueue("create", trash.ver) ELSE UNCHANGED <<queue, clock>>
          /\ want' = "keep"
  /\ UNCHANGED <<arc, srv, signedIn, rt, phase, todo, seen, undo, arcUndo, unsent, imported>>
  /\ NoFlags

\* restoreTask (lib/archive.ts): one transaction; tasks.add throws when the id is live.
YouRestoreFromArchive ==
  /\ pend.act = "restoreArchive" /\ pend' = NoPend
  /\ IF ~arc.has \/ live.has
     THEN UNCHANGED <<live, arc, queue, clock, want>>
     ELSE /\ live' = Row(arc.ver, 0) /\ arc' = NoRow
          /\ IF Cfg THEN Enqueue("update", arc.ver) ELSE UNCHANGED <<queue, clock>>
          /\ want' = "keep"
  /\ UNCHANGED <<trash, srv, signedIn, remembered, rt, phase, todo, seen, undo,
                 arcUndo, unsent, imported>>
  /\ NoFlags

\* updateTask (lib/tasks/crud/update.ts), and every other edit to a live task.
YouEdit ==
  /\ Quiet /\ live.has
  /\ live' = Row(clock, 0)
  /\ IF signedIn THEN Enqueue("update", clock) ELSE clock' = clock + 1 /\ UNCHANGED queue
  /\ want' = "keep" /\ undo' = 0 /\ arcUndo' = NoRow
  /\ UNCHANGED <<arc, trash, srv, signedIn, remembered, rt, phase, todo, seen,
                 pend, unsent, imported>>
  /\ NoFlags

\* archiveOldTasks (Settings "Archive now", and auto-archive after a pull) and
\* archiveTaskNow (lib/archive.ts): one transaction; chooseArchiveSnapshot keeps
\* an archived row at least as new; the queued delete carries the task.
YouArchive ==
  /\ Quiet /\ live.has
  /\ arc' = IF arc.has /\ arc.ver >= live.ver THEN arc ELSE Row(live.ver, clock)
  /\ live' = NoRow
  /\ IF signedIn THEN Enqueue("delete", live.ver) ELSE clock' = clock + 1 /\ UNCHANGED queue
  /\ want' = "dropped"
  /\ UNCHANGED <<trash, srv, signedIn, remembered, rt, phase, todo, seen, pend,
                 undo, arcUndo, unsent, imported>>
  /\ NoFlags

\* deleteFromTrashForever and emptyTrash (lib/trash.ts): the row and the id go.
YouEmptyTrash ==
  /\ Quiet /\ trash.has
  /\ trash' = NoRow /\ remembered' = FALSE /\ want' = "dropped"
  /\ undo' = 0 /\ arcUndo' = NoRow
  /\ UNCHANGED <<live, arc, srv, queue, clock, signedIn, rt, phase, todo, seen,
                 pend, unsent, imported>>
  /\ NoFlags

\* purgeExpiredTrash (lib/trash.ts): 30 days after deletedAt, on app start and
\* hourly. ADR 0015 makes Trash the safety floor, so the model counts the purge
\* as a deliberate drop, even for a row reconcile put there.
TrashExpires ==
  /\ Quiet /\ trash.has
  /\ trash' = NoRow /\ remembered' = FALSE /\ want' = "dropped"
  /\ UNCHANGED <<live, arc, srv, queue, clock, signedIn, rt, phase, todo, seen,
                 pend, undo, arcUndo, unsent, imported>>
  /\ NoFlags

\* deleteArchivedTask (lib/archive.ts): the archive page's delete forever.
YouDeleteArchived ==
  /\ Quiet /\ arc.has
  /\ arcUndo' = arc /\ arc' = NoRow /\ want' = "dropped" /\ undo' = 0
  /\ UNCHANGED <<live, trash, srv, queue, clock, signedIn, remembered, rt, phase,
                 todo, seen, pend, unsent, imported>>
  /\ NoFlags

\* reinstateArchivedTask (lib/archive.ts), that toast's Undo: one transaction over
\* archivedTasks that writes only when the archive lacks the id. It doesn't look
\* at tasks or deletedTasks.
YouUndoDeleteArchived ==
  /\ Quiet /\ arcUndo.has
  /\ arc' = IF arc.has \/ (Fix("reinstateChecksAllTables") /\ (live.has \/ trash.has))
            THEN arc ELSE arcUndo
  /\ arcUndo' = NoRow /\ undo' = 0
  /\ UNCHANGED <<live, trash, srv, queue, clock, signedIn, remembered, rt, phase,
                 todo, seen, pend, want, unsent, imported>>
  /\ NoFlags

\* importTasks (lib/tasks/import-export.ts): one transaction. A current backup
\* (2.2.0) lists the task as live, archived, trashed, or not at all; a 1.0.0
\* backup has no archive or Trash key, so it can only list the task as live or
\* leave it out. applyTasks, then applyArchivedTasks, then applyTrashedTasks. A
\* merge gives a backup task a fresh id only when the id is live here. Signed in,
\* a replace queues a delete for a live task it drops, and either mode queues a
\* create for a task it writes to tasks.
YouImport(mode, env, pos) ==
  LET keys == env = "2.2.0"
      fixed == Fix("importKeepsOneTable")
      liveA == IF mode = "replace"
               THEN (IF pos = "live" THEN BackupLive ELSE NoRow)
               ELSE (IF pos = "live" /\ ~live.has /\ (~fixed \/ ~Tombstoned) THEN BackupLive ELSE live)
      trashKept == IF mode = "replace" /\ keys THEN NoRow ELSE trash
      arcBase == IF ~keys THEN (IF fixed /\ liveA.has THEN NoRow ELSE arc)
                 ELSE IF mode = "replace" THEN NoRow ELSE arc
      arcA == IF keys /\ pos = "archived" /\ ~liveA.has /\ ~arcBase.has
                 /\ ~(fixed /\ trashKept.has)
              THEN BackupRow ELSE arcBase
      trashBase == IF ~keys THEN (IF fixed /\ liveA.has THEN NoRow ELSE trash) ELSE trashKept
      trashA == IF keys /\ pos = "trashed" /\ ~liveA.has /\ ~arcA.has /\ ~trashBase.has
                THEN BackupRow ELSE trashBase
      creates == pos = "live" /\ (mode = "replace" \/ (~live.has /\ liveA.has))
      drops == mode = "replace" /\ live.has /\ pos # "live"
      removed == (live.has /\ ~liveA.has) \/ (arc.has /\ ~arcA.has) \/ (trash.has /\ ~trashA.has)
  IN
  /\ Quiet /\ ~imported
  /\ live' = liveA /\ arc' = arcA /\ trash' = trashA
  /\ IF signedIn /\ creates THEN Enqueue("create", 1)
     ELSE IF signedIn /\ drops THEN Enqueue("delete", 0)
     ELSE UNCHANGED <<queue, clock>>
  /\ want' = IF creates THEN "keep"
             ELSE IF removed \/ arcA # arc \/ trashA # trash THEN "dropped"
             ELSE want
  /\ imported' = TRUE /\ undo' = 0 /\ arcUndo' = NoRow
  /\ UNCHANGED <<srv, signedIn, remembered, rt, phase, todo, seen, pend, unsent>>
  /\ NoFlags

ImportChoices ==
  {<<m, "2.2.0", p>> : m \in {"replace", "merge"}, p \in {"live", "archived", "trashed", "absent"}}
  \cup {<<m, "1.0.0", p>> : m \in {"replace", "merge"}, p \in {"live", "absent"}}

\* persistSyncConfig, then populateFromExistingTasks (use-sync-auth-dialog.ts):
\* a live task with no queue rows is queued as a create.
YouSignIn ==
  /\ ~signedIn /\ signedIn' = TRUE
  /\ IF live.has /\ queue = <<>> THEN Enqueue("create", live.ver) ELSE UNCHANGED <<queue, clock>>
  /\ UNCHANGED <<live, arc, trash, srv, remembered, rt, phase, todo, seen, pend,
                 undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* disableSync, through resetSyncConfigState (lib/sync/config/disable.ts): one
\* transaction writes the signed-out config, remembers each queued Trash delete,
\* and clears the queue. Realtime unsubscribes.
YouSignOut ==
  /\ signedIn /\ signedIn' = FALSE
  /\ remembered' = (remembered \/ TrashDeleteQueued)
  /\ unsent' = (unsent \/ TrashDeleteQueued)
  /\ queue' = <<>> /\ rt' = NoEvent
  /\ UNCHANGED <<live, arc, trash, srv, clock, phase, todo, seen, pend, undo,
                 arcUndo, want, imported>>
  /\ NoFlags

---------------------------------------------------------------------------
\* Another device, seen only through the server.

\* It edits the task, or restores it from its own Trash, and pushes. pb-push's
\* upsert re-creates the record when this device's delete already removed it.
OtherDeviceEdits ==
  /\ Quiet
  /\ srv' = Copy(clock) /\ clock' = clock + 1
  /\ rt' = IF signedIn THEN [kind |-> "update", ver |-> clock] ELSE rt
  /\ want' = "keep"
  /\ UNCHANGED <<live, arc, trash, queue, signedIn, remembered, phase, todo, seen,
                 pend, undo, arcUndo, unsent, imported>>
  /\ NoFlags

\* It deletes the task, which lands in its own Trash, and its push removes the record.
OtherDeviceDeletes ==
  /\ Quiet /\ srv.has
  /\ srv' = NoCopy
  /\ rt' = IF signedIn THEN [kind |-> "delete", ver |-> 0] ELSE rt
  /\ want' = "dropped"
  /\ UNCHANGED <<live, arc, trash, queue, clock, signedIn, remembered, phase, todo,
                 seen, pend, undo, arcUndo, unsent, imported>>
  /\ NoFlags

\* pb-realtime.ts hands the event to applyRemoteChange (pb-sync-engine.ts). An
\* update or create goes through the same guards as the pull. A delete goes to
\* applyRemoteDeletion: one transaction; classifyRemoteDeletion keeps the task while
\* a row is pending, and moves it to Trash when its only rows are retry-exhausted.
RealtimeArrives ==
  /\ Quiet /\ rt.kind # "none" /\ signedIn
  /\ rt' = NoEvent
  /\ IF rt.kind = "update"
     THEN ApplyCopy(rt.ver) /\ UNCHANGED <<queue, clock>>
     ELSE /\ IF HasPending
             THEN UNCHANGED <<live, trash, queue, clock>>
             ELSE /\ queue' = <<>> /\ live' = NoRow
                  /\ IF AnyFailed /\ live.has
                     THEN trash' = Row(live.ver, clock) /\ clock' = clock + 1
                     ELSE UNCHANGED <<trash, clock>>
          /\ UNCHANGED arc /\ NoFlags
  /\ UNCHANGED <<srv, signedIn, remembered, phase, todo, seen, pend, undo, arcUndo,
                 want, unsent, imported>>

---------------------------------------------------------------------------
\* fullSync (pb-sync-engine.ts): push, then pull and reconcile, then resurrect on
\* sight. The coordinator never runs two at once. Each network read is a step of
\* its own, so your actions and the other device's can land between them.

SyncStarts ==
  /\ Quiet /\ phase = "idle" /\ signedIn
  /\ phase' = "push" /\ todo' = SelectSeq(queue, Pending)
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt,
                 seen, pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* isStaleDelete (pb-push.ts): the server changed after the delete was queued, or
\* is newer than the archived version an archive's delete carries.
StaleDelete(r) == srv.ver > r.at \/ (r.pay > 0 /\ srv.ver > r.pay)

\* pushSingleItem (pb-push.ts) for the next row this run read. The row's server
\* read, its write, and its dequeue are one step here. The row may have left the
\* queue since the run read it; the push still sends it.
PushSends ==
  /\ Quiet /\ phase = "push" /\ todo # <<>> /\ signedIn
  /\ LET r == Head(todo)
         q == Without(queue, r.at)
     IN
     /\ todo' = Tail(todo) /\ queue' = q
     /\ IF r.op = "delete"
        THEN /\ srv' = IF srv.has /\ ~StaleDelete(r) /\ ~(Fix("pushDropsDeleteOfLiveTask") /\ live.has)
                       THEN NoCopy ELSE srv
             /\ NoFlags
        ELSE IF (srv.has /\ srv.ver > r.pay)   \* isRemoteNewer: a stale write is dropped
                \/ (Fix("pushDropsTombstonedWrite") /\ Tombstoned)
        THEN UNCHANGED srv /\ NoFlags
        ELSE /\ srv' = Copy(r.pay)
             /\ Flags(FALSE, FALSE, InOneTable /\ ~srv.has /\ Tombstoned /\ ~PendingDelete(q))
  /\ UNCHANGED <<live, arc, trash, clock, signedIn, remembered, rt, phase, seen,
                 pend, undo, arcUndo, want, unsent, imported>>

\* The request throws, or the remote index is unavailable: recordAttemptFailure
\* (queue.ts). The row stays pending, or it used its last retry and is marked
\* failed, and nothing re-arms a failed row.
PushFails(exhausted) ==
  /\ Quiet /\ phase = "push" /\ todo # <<>>
  /\ LET r == Head(todo) IN
     /\ todo' = Tail(todo)
     /\ queue' = IF exhausted
                 THEN [i \in 1..Len(queue) |->
                         IF queue[i].at = r.at THEN [queue[i] EXCEPT !.failed = TRUE] ELSE queue[i]]
                 ELSE queue
     /\ unsent' = (unsent \/ (exhausted /\ r.op = "delete" /\ r.pay = 0))
  /\ UNCHANGED <<live, arc, trash, srv, clock, signedIn, remembered, rt, phase, seen,
                 pend, undo, arcUndo, want, imported>>
  /\ NoFlags

PushDone ==
  /\ Quiet /\ phase = "push" /\ todo = <<>> /\ phase' = "pull"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 seen, pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* pullRemoteChanges (pb-pull.ts) fetches the account. The model reads the server
\* copy whatever its stamp, as the first pull after a sign-in does.
PullFetches ==
  /\ Quiet /\ phase = "pull" /\ signedIn
  /\ seen' = srv /\ phase' = "apply"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* The fetch fails, or there is no session: the run reports an error and ends.
PullFails ==
  /\ Quiet /\ phase = "pull" /\ phase' = "idle"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 seen, pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* applyRemoteRecords (pb-pull.ts): one transaction over tasks, archivedTasks,
\* deletedTasks, syncQueue, and syncMetadata; assertSyncSessionCurrent goes first.
PullApplies ==
  /\ Quiet /\ phase = "apply" /\ seen' = NoCopy
  /\ IF ~signedIn
     THEN phase' = "idle" /\ UNCHANGED <<live, arc, trash>> /\ NoFlags
     ELSE /\ phase' = "reconcile"
          /\ IF seen.has THEN ApplyCopy(seen.ver) ELSE UNCHANGED <<live, arc, trash>> /\ NoFlags
  /\ UNCHANGED <<srv, queue, clock, signedIn, remembered, rt, todo, pend, undo,
                 arcUndo, want, unsent, imported>>

\* reconcileDeletedTasks (pb-pull.ts) fetches the remote index. Without a session
\* the listing comes back empty. When the index is unavailable, reconcile is skipped.
ReconcileFetches ==
  /\ Quiet /\ phase = "reconcile"
  /\ seen' = IF signedIn THEN srv ELSE NoCopy
  /\ phase' = "reconcileApply"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

ReconcileSkips ==
  /\ Quiet /\ phase = "reconcile" /\ phase' = "resurrect"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 seen, pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* The rest of reconcileDeletedTasks: confirmSessionIdentity, then one transaction
\* over tasks, deletedTasks, syncQueue, and syncMetadata. A live task the index
\* lacks stays while a row is pending, goes to Trash when its rows are all
\* retry-exhausted, and is dropped with no Trash row otherwise.
ReconcileApplies ==
  /\ Quiet /\ phase = "reconcileApply" /\ seen' = NoCopy
  /\ LET absent == live.has /\ ~seen.has
         protect == HasPending /\ Variant # "reconcileSkipsQueue"
     IN
     /\ phase' = IF absent /\ ~signedIn THEN "idle" ELSE "resurrect"
     /\ IF absent /\ signedIn /\ ~protect
        THEN /\ live' = NoRow /\ queue' = <<>>
             /\ IF AnyFailed THEN trash' = Row(live.ver, clock) /\ clock' = clock + 1
                ELSE UNCHANGED <<trash, clock>>
        ELSE UNCHANGED <<live, trash, queue, clock>>
  /\ UNCHANGED <<arc, srv, signedIn, remembered, rt, todo, pend, undo, arcUndo,
                 want, unsent, imported>>
  /\ NoFlags

\* resurrectOnSight (resurrect-on-sight.ts) reads the remembered ids, then lists the
\* account and confirms the owner. With nothing remembered, nothing is listed.
ResurrectLists ==
  /\ Quiet /\ phase = "resurrect"
  /\ IF remembered /\ signedIn
     THEN phase' = "resurrectApply" /\ seen' = srv
     ELSE phase' = "idle" /\ UNCHANGED seen
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* The listing fails: nothing is forgotten, and the next run tries again.
ResurrectSkips ==
  /\ Quiet /\ phase = "resurrect" /\ remembered /\ phase' = "idle"
  /\ UNCHANGED <<live, arc, trash, srv, queue, clock, signedIn, remembered, rt, todo,
                 seen, pend, undo, arcUndo, want, unsent, imported>>
  /\ NoFlags

\* applyResurrections and resurrectOne: one transaction over tasks, archivedTasks,
\* deletedTasks, syncQueue, and syncMetadata. A pending delete keeps the id for
\* the next run (waitsForThisDevice). A live copy takes a strictly newer server
\* copy. An archive row stands. A Trash row gives way to the server copy.
ResurrectApplies ==
  /\ Quiet /\ phase = "resurrectApply" /\ phase' = "idle" /\ seen' = NoCopy
  /\ LET waits == PendingDelete(queue) /\ Variant # "resurrectSkipsDelete" IN
     IF ~signedIn
     THEN UNCHANGED <<live, trash, remembered>> /\ NoFlags
     ELSE IF seen.has /\ waits
     THEN UNCHANGED <<live, trash, remembered>> /\ NoFlags
     ELSE IF seen.has /\ live.has
     THEN /\ live' = IF seen.ver > live.ver THEN Row(seen.ver, 0) ELSE live
          /\ remembered' = FALSE /\ UNCHANGED trash /\ NoFlags
     ELSE IF seen.has /\ ~arc.has /\ trash.has
     THEN /\ live' = Row(seen.ver, 0) /\ trash' = NoRow /\ remembered' = FALSE
          /\ Flags(InOneTable /\ seen.ver <= trash.at /\ ~unsent, FALSE, FALSE)
     ELSE remembered' = FALSE /\ UNCHANGED <<live, trash>> /\ NoFlags
  /\ UNCHANGED <<arc, srv, queue, clock, signedIn, rt, todo, pend, undo, arcUndo,
                 want, unsent, imported>>

---------------------------------------------------------------------------

Next ==
  \/ \E a \in Acts \ {"none"} : YouStart(a)
  \/ YouDelete \/ YouUndo \/ YouRestoreFromTrash \/ YouRestoreFromArchive
  \/ YouEdit \/ YouArchive \/ YouEmptyTrash \/ TrashExpires
  \/ YouDeleteArchived \/ YouUndoDeleteArchived
  \/ \E c \in ImportChoices : YouImport(c[1], c[2], c[3])
  \/ YouSignIn \/ YouSignOut
  \/ OtherDeviceEdits \/ OtherDeviceDeletes \/ RealtimeArrives
  \/ SyncStarts \/ PushSends \/ PushFails(TRUE) \/ PushFails(FALSE) \/ PushDone
  \/ PullFetches \/ PullFails \/ PullApplies
  \/ ReconcileFetches \/ ReconcileSkips \/ ReconcileApplies
  \/ ResurrectLists \/ ResurrectSkips \/ ResurrectApplies

Spec == Init /\ [][Next]_vars

\* The bounds: stamps up to MaxClock and at most MaxQueue queue rows.
Bounds == clock <= MaxClock + 1 /\ Len(queue) <= MaxQueue

---------------------------------------------------------------------------
\* The rules.

\* Rule 1 (ADR 0013, ADR 0015): the task lives in at most one of tasks,
\* archivedTasks, and deletedTasks.
OneTable == InOneTable

\* A server copy no newer than the tombstone never takes the task out of Trash or
\* the archive. Resurrect on sight may, but only for a delete that never reached
\* the server.
NoComeback == ~cameBack

\* A server copy edited after you deleted or archived the task wins: the step that
\* applies it takes the task out of that tombstone.
NewerEditWins == ~owed

\* Once your delete or archive has removed the server copy, nothing this device
\* pushes later puts it back while the task is still in Trash or the archive here.
ServerStaysDeleted == ~revived

\* A task you didn't delete or archive is somewhere: in your matrix, archive, or
\* Trash, or on the server.
NoLoss == want = "keep" => (live.has \/ arc.has \/ trash.has \/ srv.has)

=============================================================================
