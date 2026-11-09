--------------------------- MODULE SyncConvergence ---------------------------
\* One task, two web devices (A and B), and the PocketBase server, as the web
\* app syncs them. A copy of the task is the edit it holds: `v` names the edit,
\* and `at` is the client_updated_at stamp that copy carries. Device edits get
\* their tick as both. One tick is 30 seconds, the pull overlap.
\* Code: lib/tasks/crud/update.ts, lib/tasks/crud/helpers.ts, lib/sync/queue.ts,
\* lib/sync/pb-push.ts, lib/sync/pb-pull.ts, lib/sync/pb-sync-engine.ts,
\* lib/sync/pb-sync-helpers.ts, lib/sync/task-mapper.ts, lib/sync/pb-realtime.ts,
\* lib/sync/sync-coordinator.ts.
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
  MaxTime,      \* the last tick the model reaches
  MaxQueue,     \* the most rows one device's syncQueue holds
  MaxRetries,   \* SYNC_CONFIG.MAX_RETRIES (5 in the code)
  Overlap,      \* CURSOR_OVERLAP_MS in ticks (30 seconds is 1)
  Ceiling,      \* SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS in ticks (5 minutes is 10)
  OtherTasks,   \* TRUE: a pull can also apply another task's record, stamped now
  LostEvents,   \* TRUE: a realtime event can be lost (tab closed, offline, SSE gap)
  RunOut,       \* TRUE: a row's pushes can keep failing until its retries run out
  PushOverlap,  \* TRUE: the other device can write between a push's read and its write
  FastClock,    \* TRUE: a client whose clock runs over 5 minutes fast saves the task once
  Variant       \* "code", or one broken variant (each is named where it changes a step)

Devices == {"A", "B"}
Far == MaxTime + Ceiling + 1    \* the fast clock's stamp: past the ceiling at every tick

VARIABLES
  now,       \* the current tick; every device clock reads it
  server,    \* the server's copy
  local,     \* each device's copy in db.tasks
  queue,     \* each device's syncQueue rows, oldest first: [at, st, tries]
  cursor,    \* each device's lastClientUpdatedAt, in ticks
  phase,     \* each device's fullSync: "idle", "push", or "pull"
  todo,      \* the rows (by stamp) this sync's push loop has yet to try
  reading,   \* the row whose remote read is in flight, or 0 (PushOverlap only)
  seen,      \* the server stamp that read returned
  events,    \* realtime events on their way to each device
  pulled,    \* ghost: the device pulled after the server's last write
  newest,    \* ghost: the newest edit made on either device
  fastDone   \* ghost: the fast clock has saved the task

vars == <<now, server, local, queue, cursor, phase, todo, reading, seen, events,
          pulled, newest, fastDone>>

Copy == [at : 0..(Far + Ceiling), v : 0..Far]
\* What a realtime event can carry: a device's pushed edit, or the fast clock's save.
Sent == {[at |-> t, v |-> t] : t \in 1..MaxTime} \cup {[at |-> Far, v |-> Far]}
Row == [at : 1..MaxTime, st : {"pending", "failed"}, tries : 0..MaxRetries]

TypeOK ==
  /\ now \in 0..MaxTime
  /\ server \in Copy
  /\ local \in [Devices -> Copy]
  /\ \A d \in Devices : queue[d] \in Seq(Row) /\ Len(queue[d]) <= MaxQueue
  /\ cursor \in [Devices -> (0 - Overlap)..MaxTime]
  /\ phase \in [Devices -> {"idle", "push", "pull"}]
  /\ todo \in [Devices -> SUBSET (1..MaxTime)]
  /\ reading \in [Devices -> 0..MaxQueue]
  /\ events \in [Devices -> SUBSET Sent]
  /\ pulled \in [Devices -> BOOLEAN]
  /\ newest \in 0..MaxTime
  /\ fastDone \in BOOLEAN

\* The task was created and synced before the model starts: every copy holds
\* edit 0, and each device's last pull applied it.
Init ==
  /\ now = 0
  /\ server = [at |-> 0, v |-> 0]
  /\ local = [d \in Devices |-> [at |-> 0, v |-> 0]]
  /\ queue = [d \in Devices |-> << >>]
  /\ cursor = [d \in Devices |-> 0 - Overlap]
  /\ phase = [d \in Devices |-> "idle"]
  /\ todo = [d \in Devices |-> {}]
  /\ reading = [d \in Devices |-> 0]
  /\ seen = [d \in Devices |-> 0]
  /\ events = [d \in Devices |-> {}]
  /\ pulled = [d \in Devices |-> TRUE]
  /\ newest = 0
  /\ fastDone = FALSE

Other(d) == CHOOSE e \in Devices : e # d
SetMax(S) == CHOOSE x \in S : \A y \in S : x >= y
Min(a, b) == IF a < b THEN a ELSE b
Remove(s, i) == [j \in 1..(Len(s) - 1) |-> IF j < i THEN s[j] ELSE s[j + 1]]

\* clampClientTimestamp (task-mapper.ts): a stamp past now + 5 minutes reads as now + 5 minutes.
Clamp(t) == IF t > now + Ceiling THEN now + Ceiling ELSE t
\* isBeyondClockSkew (pb-sync-helpers.ts)
BeyondSkew(t) == t > now + Ceiling
\* isPendingSyncQueueItem (queue.ts): a retry-exhausted "failed" row is not pending.
IsPending(d, i) == queue[d][i].st = "pending"
Pending(d) == \E i \in 1..Len(queue[d]) : IsPending(d, i)

\* holdsOffFarFutureRemote (pb-sync-helpers.ts), on pull and realtime alike.
HoldsOff(d, c) == Variant # "no-hold-off" /\ BeyondSkew(c.at) /\ Pending(d)

\* The strictly-newer rule: acceptsRemoteVersion (pb-pull.ts) on pull and
\* localCopyHolds (pb-sync-engine.ts) on realtime. Both compare the clamped stamp
\* pocketBaseToTaskRecord produces against the local updatedAt.
Takes(d, c) ==
  /\ ~HoldsOff(d, c)
  /\ \/ Clamp(c.at) > local[d].at
     \/ Variant = "apply-ignores-stamps"

TakeCopy(d, c) == [local EXCEPT ![d] = [at |-> Clamp(c.at), v |-> c.v]]

\* isRemoteNewer (pb-push.ts): never true for a stamp past the ceiling.
RemoteNewer(r, l) == ~BeyondSkew(r) /\ r > l

\* -------------------------------------------------------------------------
\* You edit the task. updateTask -> runTaskSyncTransaction: db.tasks.put and
\* queue.enqueue("update", id, record) commit in one transaction. enqueue
\* never merges rows: each edit adds its own row with its own payload.
YouEdit(d) ==
  /\ now < MaxTime /\ Len(queue[d]) < MaxQueue
  /\ now' = now + 1
  /\ local' = [local EXCEPT ![d] = [at |-> now + 1, v |-> now + 1]]
  /\ queue' = [queue EXCEPT ![d] = Append(@, [at |-> now + 1, st |-> "pending", tries |-> 0])]
  /\ newest' = now + 1
  /\ UNCHANGED <<server, cursor, phase, todo, reading, seen, events, pulled, fastDone>>

TimePasses ==
  /\ now < MaxTime /\ now' = now + 1
  /\ UNCHANGED <<server, local, queue, cursor, phase, todo, reading, seen, events,
                 pulled, newest, fastDone>>

\* SyncCoordinator.requestSync: one fullSync at a time per device; a request
\* made while one runs waits in pendingRequests. fullSync pushes, then pulls,
\* and pushLocalChanges tries the rows queue.getPending() returned at its start.
SyncStarts(d) ==
  /\ phase[d] = "idle"
  /\ phase' = [phase EXCEPT ![d] = "push"]
  /\ todo' = [todo EXCEPT ![d] =
       {queue[d][i].at : i \in {j \in 1..Len(queue[d]) : IsPending(d, j)}}]
  /\ UNCHANGED <<now, server, local, queue, cursor, reading, seen, events,
                 pulled, newest, fastDone>>

\* fullSync throws or finds no session (offline, auth lapsed, a pull error):
\* reportSyncError or reportAuthFailure runs, and nothing is pulled.
SyncFails(d) ==
  /\ phase[d] \in {"push", "pull"} /\ reading[d] = 0
  /\ phase' = [phase EXCEPT ![d] = "idle"]
  /\ todo' = [todo EXCEPT ![d] = {}]
  /\ UNCHANGED <<now, server, local, queue, cursor, reading, seen, events,
                 pulled, newest, fastDone>>

\* upsertRemoteTask then queue.dequeue (pb-push.ts). The record carries this
\* device's device_id, so pb-realtime.ts drops it here as an echo and only the
\* other device gets the event.
Writes(d, i) ==
  LET copy == [at |-> queue[d][i].at, v |-> queue[d][i].at] IN
  /\ server' = copy
  /\ events' = [events EXCEPT ![Other(d)] = @ \cup {copy}]
  /\ pulled' = [e \in Devices |-> FALSE]
  /\ queue' = [queue EXCEPT ![d] = Remove(@, i)]

\* pushSingleItem (pb-push.ts), given the stamp fetchRemoteTaskEntry returned:
\* a strictly newer remote makes the row stale, so it is dequeued unsent.
Decides(d, i, remoteAt) ==
  IF RemoteNewer(remoteAt, queue[d][i].at) /\ Variant # "push-overwrites-newer"
  THEN /\ queue' = [queue EXCEPT ![d] = Remove(@, i)]
       /\ UNCHANGED <<server, events, pulled>>
  ELSE Writes(d, i)

\* The push loop runs rows oldest first, but a row that fails leaves the next
\* one to go, so any row still to try this sync can be the next one sent.
CanPush(d, i) ==
  /\ phase[d] = "push"
  /\ i \in 1..Len(queue[d])
  /\ IsPending(d, i)
  /\ queue[d][i].at \in todo[d]

Tried(d, i) == [todo EXCEPT ![d] = @ \ {queue[d][i].at}]

\* fetchRemoteTaskEntry and the upsert, with nothing landing in between.
PushSends(d, i) ==
  /\ ~PushOverlap /\ CanPush(d, i)
  /\ Decides(d, i, server.at)
  /\ todo' = Tried(d, i)
  /\ UNCHANGED <<now, local, cursor, phase, reading, seen, newest, fastDone>>

\* fetchRemoteTaskEntry alone, when the other device can write before the upsert.
PushReads(d, i) ==
  /\ PushOverlap /\ CanPush(d, i) /\ reading[d] = 0
  /\ reading' = [reading EXCEPT ![d] = i]
  /\ seen' = [seen EXCEPT ![d] = server.at]
  /\ todo' = Tried(d, i)
  /\ UNCHANGED <<now, server, local, queue, cursor, phase, events, pulled,
                 newest, fastDone>>

\* The upsert, decided on the stamp that read returned.
PushWrites(d) ==
  /\ reading[d] # 0
  /\ Decides(d, reading[d], seen[d])
  /\ reading' = [reading EXCEPT ![d] = 0]
  /\ UNCHANGED <<now, local, cursor, phase, todo, seen, newest, fastDone>>

\* The index fetch fails or the upsert throws: queue.recordAttemptFailure adds
\* one try and marks the row "failed" at MaxRetries. Nothing re-arms a failed
\* row. A 429 (stop) breaks the push loop, so the rest wait for the next sync.
PushFails(d, i, stop) ==
  /\ phase[d] = "push" /\ i \in 1..Len(queue[d]) /\ IsPending(d, i)
  /\ \/ reading[d] = 0 /\ queue[d][i].at \in todo[d]
     \/ reading[d] = i
  /\ LET tries == queue[d][i].tries + 1 IN
     /\ RunOut \/ tries < MaxRetries
     /\ queue' = IF Variant = "failed-push-drops-row"
                 THEN [queue EXCEPT ![d] = Remove(@, i)]
                 ELSE [queue EXCEPT ![d][i] =
                        [@ EXCEPT !.tries = tries,
                                  !.st = IF tries >= MaxRetries THEN "failed" ELSE "pending"]]
  /\ todo' = IF stop THEN [todo EXCEPT ![d] = {}] ELSE Tried(d, i)
  /\ reading' = [reading EXCEPT ![d] = 0]
  /\ UNCHANGED <<now, server, local, cursor, phase, seen, events, pulled,
                 newest, fastDone>>

PushDone(d) ==
  /\ phase[d] = "push" /\ reading[d] = 0 /\ todo[d] = {}
  /\ phase' = [phase EXCEPT ![d] = "pull"]
  /\ UNCHANGED <<now, server, local, queue, cursor, todo, reading, seen, events,
                 pulled, newest, fastDone>>

\* pullRemoteChanges, then updateSyncCursor (pb-sync-engine.ts). The fetch asks
\* for client_updated_at >= cursor. The cursor moves only from applied records:
\* findMaxAppliedClientUpdated clamps each to now, and the overlap comes off.
\* The cursor is one per account, so another task's record moves it too.
Pulls(d, other) ==
  /\ phase[d] = "pull"
  /\ other \in (IF OtherTasks THEN BOOLEAN ELSE {FALSE})
  /\ LET takes == server.at >= cursor[d] /\ Takes(d, server)
         marks == (IF takes THEN {Min(Clamp(server.at), now)} ELSE {})
                  \cup (IF other THEN {now} ELSE {})
     IN /\ local' = IF takes THEN TakeCopy(d, server) ELSE local
        /\ cursor' = [cursor EXCEPT ![d] =
             IF Variant = "cursor-follows-clock" THEN now - Overlap
             ELSE IF marks = {} THEN @ ELSE SetMax(marks) - Overlap]
  /\ phase' = [phase EXCEPT ![d] = "idle"]
  /\ pulled' = [pulled EXCEPT ![d] = TRUE]
  /\ UNCHANGED <<now, server, queue, todo, reading, seen, events, newest, fastDone>>

\* handleRealtimeEvent (pb-realtime.ts) -> applyRemoteChange (pb-sync-engine.ts).
\* Realtime never moves the cursor.
EventArrives(d, c) ==
  /\ c \in events[d]
  /\ events' = [events EXCEPT ![d] = @ \ {c}]
  /\ local' = IF Takes(d, c) THEN TakeCopy(d, c) ELSE local
  /\ UNCHANGED <<now, server, queue, cursor, phase, todo, reading, seen, pulled,
                 newest, fastDone>>

\* PocketBase SSE has no replay: an event sent while the tab is closed, offline,
\* or reconnecting never arrives.
EventLost(d, c) ==
  /\ LostEvents /\ c \in events[d]
  /\ events' = [events EXCEPT ![d] = @ \ {c}]
  /\ UNCHANGED <<now, server, local, queue, cursor, phase, todo, reading, seen,
                 pulled, newest, fastDone>>

\* Another client, its clock more than 5 minutes fast, saves the task.
FastClockSaves ==
  /\ FastClock /\ ~fastDone
  /\ server' = [at |-> Far, v |-> Far]
  /\ events' = [d \in Devices |-> events[d] \cup {[at |-> Far, v |-> Far]}]
  /\ pulled' = [d \in Devices |-> FALSE]
  /\ fastDone' = TRUE
  /\ UNCHANGED <<now, local, queue, cursor, phase, todo, reading, seen, newest>>

Next ==
  \/ \E d \in Devices : YouEdit(d)
  \/ TimePasses
  \/ \E d \in Devices : SyncStarts(d)
  \/ \E d \in Devices, i \in 1..MaxQueue : PushSends(d, i)
  \/ \E d \in Devices, i \in 1..MaxQueue : PushReads(d, i)
  \/ \E d \in Devices : PushWrites(d)
  \/ \E d \in Devices, i \in 1..MaxQueue, stop \in BOOLEAN : PushFails(d, i, stop)
  \/ \E d \in Devices : PushDone(d)
  \/ \E d \in Devices, other \in BOOLEAN : Pulls(d, other)
  \/ \E d \in Devices : SyncFails(d)
  \/ \E d \in Devices, c \in Sent : EventArrives(d, c)
  \/ \E d \in Devices, c \in Sent : EventLost(d, c)
  \/ FastClockSaves

Spec == Init /\ [][Next]_vars

\* Both devices are quiet: no row left to push, no sync running, no realtime
\* event on its way, and each pulled after the server's last write.
Quiet == \A d \in Devices :
  /\ ~Pending(d)
  /\ phase[d] = "idle"
  /\ events[d] = {}
  /\ pulled[d]

\* Once both devices are quiet, both hold the server's copy of the task.
QuietMeansSameCopy == Quiet => \A d \in Devices : local[d].v = server.v

\* Once both devices are quiet, the server holds the newest edit either device made.
QuietMeansNewestEdit == Quiet => server.v = newest

\* An edit not yet sent stays on your screen until an edit newer by
\* client_updated_at replaces it. A fast clock's copy never does.
UnsentEditStays == \A d \in Devices : \A i \in 1..Len(queue[d]) :
  IsPending(d, i) => (local[d].v # Far /\ local[d].v >= queue[d][i].at)

=============================================================================
