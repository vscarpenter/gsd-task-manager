---------------------------- MODULE SyncSession ----------------------------
\* Which account each sync write lands in, on the web app, across sign-in,
\* sign-out, Reset Everything, and a second open tab. One fullSync runs in the
\* sync tab. Either tab can sign in, sign out, reset, edit a task, or change the
\* auto-sync setting, and a realtime event can arrive at any time.
\*
\* Code: lib/sync/sync-session.ts, lib/sync/pb-sync-engine.ts, lib/sync/pb-push.ts,
\* lib/sync/pb-pull.ts, lib/sync/pb-realtime.ts, lib/sync/pb-auth.ts,
\* lib/sync/pocketbase-client.ts, lib/sync/config/disable.ts,
\* lib/sync/config/get-set.ts, lib/sync/queue.ts, lib/reset-everything.ts,
\* lib/reset-local-data.ts, lib/tasks/crud/helpers.ts,
\* components/sync/use-sync-auth-dialog.ts, and the tasks API rules in
\* scripts/setup-pocketbase-collections.sh. The skill that runs this model is
\* .claude/skills/verify-sync-session/SKILL.md, and it maps each action to code.
EXTENDS Naturals, FiniteSets

CONSTANTS
  Gaps,    \* the gaps the code has today; {} models the code with all four fixed
  Broken   \* "none", or the guard that a broken variant removes

None == "none"
Accounts == {"A", "B"}
\* A local row, a queue row, or a server record is named by the account its
\* content came from: "A" is a task from account A, or a queued edit of one.
Tabs == {"sync", "other"}

AllGaps == {
  "push-reads-queue-unfenced",     \* pushLocalChanges reads the queue with no session check
  "sign-out-reads-config-early",   \* disableSync reads sync_config before its transaction
  "settings-writes-stale-config",  \* updateSyncConfig writes back a row read earlier
  "populate-after-sign-in"         \* populateFromExistingTasks runs after persistSyncConfig commits
}
BrokenGuards == {"none", "pull-skips-fence", "sign-in-skips-owner-check", "push-skips-principal-check"}

Cfg(on, user, lowner) == [on |-> on, user |-> user, lowner |-> lowner]
SignedOut(lowner) == Cfg(FALSE, None, lowner)
CfgSet == [on : BOOLEAN, user : Accounts \cup {None}, lowner : Accounts \cup {None}]

VARIABLES
  cfg,        \* sync_config: enabled, userId, localTaskOwnerUserId
  tok,        \* whose token the shared pocketbase_auth key holds
  rows,       \* local tasks, archivedTasks, and deletedTasks rows
  queue,      \* syncQueue rows
  srv,        \* srv[x]: the records account x owns on the server
  sp,         \* the sync tab's fullSync step
  pullFirst,  \* TRUE when a backfill is owed, so runSyncPasses pulls before it pushes
  owner,      \* the session owner fullSync read at start
  rt,         \* whose token the sync tab's in-flight authRefresh carries
  pushOwner,  \* the owner pushLocalChanges stamps on each record it sends
  pending,    \* the queue rows pushLocalChanges read
  pullOwner,  \* the account pullRemoteChanges fetched for
  fetched,    \* the records it fetched
  si, siWho, siTab, siRows,     \* a sign-in in progress
  so, soTab, soReset, soCfg,    \* a sign-out or Reset Everything in progress
  st,         \* a Settings change in progress: {} or the row it read
  ed,         \* TRUE while a task edit that read "sync on" is in progress
  ev          \* a realtime event in progress: {} or {[o, r]}

syncVars == <<sp, pullFirst, owner, rt, pushOwner, pending, pullOwner, fetched>>
siVars == <<si, siWho, siTab, siRows>>
soVars == <<so, soTab, soReset, soCfg>>
vars == <<cfg, tok, rows, queue, srv, syncVars, siVars, soVars, st, ed, ev>>

TypeOK ==
  /\ cfg \in CfgSet
  /\ tok \in Accounts \cup {None}
  /\ rows \subseteq Accounts /\ queue \subseteq Accounts
  /\ srv \in [Accounts -> SUBSET Accounts]
  /\ sp \in {"idle", "auth", "refreshing", "push", "pushing", "pull", "applying"}
  /\ pullFirst \in BOOLEAN
  /\ owner \in Accounts \cup {None} /\ rt \in Accounts \cup {None}
  /\ pushOwner \in Accounts \cup {None} /\ pending \subseteq Accounts
  /\ pullOwner \in Accounts \cup {None} /\ fetched \subseteq Accounts
  /\ si \in {"idle", "persist", "popread", "popwrite"}
  /\ siWho \in Accounts \cup {None} /\ siTab \in Tabs /\ siRows \subseteq Accounts
  /\ so \in {"idle", "commit", "clear", "wipe", "storage"}
  /\ soTab \in Tabs /\ soReset \in BOOLEAN /\ soCfg \in CfgSet
  /\ st \subseteq CfgSet /\ Cardinality(st) <= 1
  /\ ed \in BOOLEAN
  /\ ev \subseteq [o : Accounts, r : Accounts] /\ Cardinality(ev) <= 1

\* A device that has never signed in. Each account has one task on the server.
Init ==
  /\ cfg = SignedOut(None)
  /\ tok = None
  /\ rows = {} /\ queue = {}
  /\ srv = [x \in Accounts |-> {x}]
  /\ sp = "idle" /\ pullFirst = FALSE /\ owner = None /\ rt = None /\ pushOwner = None
  /\ pending = {} /\ pullOwner = None /\ fetched = {}
  /\ si = "idle" /\ siWho = None /\ siTab = "sync" /\ siRows = {}
  /\ so = "idle" /\ soTab = "sync" /\ soReset = FALSE /\ soCfg = SignedOut(None)
  /\ st = {} /\ ed = FALSE /\ ev = {}

\* assertSyncSessionCurrent(o), inside the writer's transaction:
\* getSessionOwner(config) === o.
SessionIs(o) == cfg.on /\ cfg.user = o

\* persistSyncConfig and resetSyncConfigState:
\* config.localTaskOwnerUserId ?? config.userId ?? null.
LocalOwner(c) == IF c.lowner # None THEN c.lowner ELSE c.user

SyncEnds ==
  /\ sp' = "idle" /\ pullFirst' = FALSE /\ owner' = None /\ rt' = None /\ pushOwner' = None
  /\ pending' = {} /\ pullOwner' = None /\ fetched' = {}

----------------------------------------------------------------------------
\* The sync tab's fullSync. SyncCoordinator.requestSync runs one at a time per tab.

\* fullSync reads sync_config and takes getSessionOwner(config) as the owner.
\* With no owner, cancelledSync returns before any other step. resolvePullCursor
\* owes a backfill once after a pull contract bump; the model leaves the
\* contract version out, so either order can happen.
SyncStarts ==
  /\ sp = "idle" /\ cfg.on
  /\ sp' = "auth" /\ owner' = cfg.user
  /\ pullFirst' \in BOOLEAN
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, rt, pushOwner, pending, pullOwner, fetched, siVars, soVars, st, ed, ev>>

\* runSyncPasses: an ordinary sync pushes, then pulls. A backfill pulls first.
FirstPass == IF pullFirst THEN "pull" ELSE "push"

\* ensureValidAuth with more than seven days left on the token, or with no
\* token: no request goes out.
TokenFresh ==
  /\ sp = "auth"
  /\ sp' = FirstPass
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, pullFirst, owner, rt, pushOwner, pending, pullOwner, fetched, siVars, soVars, st, ed, ev>>

\* ensureValidAuth inside the refresh window: refreshAuthOutcome sends
\* authRefresh with the token the shared key holds now.
RefreshSent ==
  /\ sp = "auth" /\ tok # None
  /\ sp' = "refreshing" /\ rt' = tok
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, pullFirst, owner, pushOwner, pending, pullOwner, fetched, siVars, soVars, st, ed, ev>>

\* The authRefresh response: RecordService.authResponse saves it to this tab's
\* authStore. That is the shared pocketbase_auth key, unless this tab's own
\* clearPocketBase swapped in a throwaway store (rt = None). A failed refresh
\* saves nothing, which TokenFresh already covers.
RefreshLands ==
  /\ sp = "refreshing"
  /\ tok' = IF rt # None THEN rt ELSE tok
  /\ sp' = FirstPass /\ rt' = None
  /\ UNCHANGED <<cfg, rows, queue, srv, pullFirst, owner, pushOwner, pending, pullOwner, fetched, siVars, soVars, st, ed, ev>>

\* pushLocalChanges(owner): resolvePushPrincipal, then queue.getPending().
\* No token: "Push skipped: not authenticated", and an ordinary sync still pulls.
\* Another account's token: StaleSyncSessionError, and fullSync returns cancelled.
\* Without the push-reads-queue-unfenced gap, the queue is read inside a
\* transaction with assertSyncSessionCurrent(owner), as the pull does.
PushStarts ==
  /\ sp = "push"
  /\ LET principalOk == tok = owner \/ Broken = "push-skips-principal-check"
         fenced == "push-reads-queue-unfenced" \notin Gaps
     IN CASE tok = None /\ ~pullFirst ->
               /\ sp' = "pull" /\ owner' = None
               /\ UNCHANGED <<pullFirst, rt, pushOwner, pending, pullOwner, fetched>>
          [] tok = None \/ ~principalOk \/ (fenced /\ ~SessionIs(owner)) ->
               SyncEnds
          [] OTHER ->
               /\ sp' = "pushing" /\ pending' = queue /\ pushOwner' = tok /\ owner' = None
               /\ UNCHANGED <<pullFirst, rt, pullOwner, fetched>>
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, siVars, soVars, st, ed, ev>>

\* pushSingleItem: fetchRemoteTaskEntry, then upsertRemoteTask with
\* owner = pushOwner, sent with the token the shared key holds now. The tasks
\* createRule and updateRule accept a write only when owner = @request.auth.id.
\* The model leaves out dequeue, so a row stays queued and can send again.
PushSends(r) ==
  /\ sp = "pushing" /\ r \in pending
  /\ srv' = IF tok = pushOwner THEN [srv EXCEPT ![pushOwner] = @ \cup {r}] ELSE srv
  /\ pending' = pending \ {r}
  /\ UNCHANGED <<cfg, tok, rows, queue, sp, pullFirst, owner, rt, pushOwner, pullOwner, fetched, siVars, soVars, st, ed, ev>>

\* The push loop ends: every row sent, or a 429 broke the loop early. An
\* ordinary sync pulls next; a backfill already pulled.
PushEnds ==
  /\ sp = "pushing"
  /\ IF pullFirst
     THEN SyncEnds
     ELSE /\ sp' = "pull" /\ pending' = {} /\ pushOwner' = None
          /\ UNCHANGED <<pullFirst, owner, rt, pullOwner, fetched>>
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, siVars, soVars, st, ed, ev>>

\* pullRemoteChanges: getCurrentUserId(), then fetchBoundedRemoteTasks with
\* owner = that user. The tasks listRule returns only the caller's own records.
\* No token: "Pull skipped: not authenticated", reportAuthFailure writes no rows,
\* and a backfill pushes nothing.
PullFetches ==
  /\ sp = "pull"
  /\ IF tok = None
     THEN SyncEnds
     ELSE /\ sp' = "applying" /\ pullOwner' = tok /\ fetched' = srv[tok]
          /\ UNCHANGED <<pullFirst, owner, rt, pushOwner, pending>>
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, siVars, soVars, st, ed, ev>>

\* applyRemoteRecords: one Dexie transaction, assertSyncSessionCurrent(pullOwner)
\* first, and StaleSyncSessionError cancels the sync. A backfill pushes next.
\* After the pull, reconcileDeletedTasks only deletes rows, resurrectOnSight
\* only restores rows this device already holds, and updateSyncCursor and the
\* outcome writes are fenced and keep enabled, userId, and localTaskOwnerUserId.
PullApplies ==
  /\ sp = "applying"
  /\ LET applies == SessionIs(pullOwner) \/ Broken = "pull-skips-fence"
     IN /\ rows' = IF applies THEN rows \cup fetched ELSE rows
        /\ IF applies /\ pullFirst
           THEN /\ sp' = "push" /\ pullOwner' = None /\ fetched' = {}
                /\ UNCHANGED <<pullFirst, owner, rt, pushOwner, pending>>
           ELSE SyncEnds
  /\ UNCHANGED <<cfg, tok, queue, srv, siVars, soVars, st, ed, ev>>

----------------------------------------------------------------------------
\* Realtime, in whichever tab holds the subscription.

\* handleRealtimeEvent drops an event whose record owner isn't
\* getCurrentUserId(), and passes that user on as the owner to match.
\* sync-status-store subscribes only while sync is on. The model lets any
\* account's record arrive, without PocketBase's own filter on the subscription.
EventArrives(x, r) ==
  /\ ev = {} /\ cfg.on /\ tok = x /\ r \in srv[x]
  /\ ev' = {[o |-> x, r |-> r]}
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, syncVars, siVars, soVars, st, ed>>

\* applyRemoteChange: one Dexie transaction, assertSyncSessionCurrent(o) first.
EventApplies ==
  /\ ev # {}
  /\ LET e == CHOOSE e \in ev : TRUE
     IN rows' = IF SessionIs(e.o) THEN rows \cup {e.r} ELSE rows
  /\ ev' = {}
  /\ UNCHANGED <<cfg, tok, queue, srv, syncVars, siVars, soVars, st, ed>>

----------------------------------------------------------------------------
\* Signing in, in either tab. useSyncAuthDialog reads sync_config only when the
\* dialog opens, so a dialog left open offers sign-in after another tab signs in.

\* runCodeFlow: authWithOAuth2Code saves account x's token in the shared key.
\* The OAuth popup and the PKCE handshake are one step.
YouSignIn(t, x) ==
  /\ si = "idle"
  /\ tok' = x /\ si' = "persist" /\ siWho' = x /\ siTab' = t
  /\ UNCHANGED <<cfg, rows, queue, srv, syncVars, siRows, soVars, st, ed, ev>>

\* persistSyncConfig: one transaction over tasks, archivedTasks, deletedTasks,
\* and syncMetadata. It refuses when local rows belong to another account, and
\* handleOAuthSuccess then calls clearPocketBase in this tab. Without the
\* populate-after-sign-in gap, the same transaction queues the local rows.
SignInSaves ==
  /\ si = "persist"
  /\ LET lo == LocalOwner(cfg)
         refused == Broken # "sign-in-skips-owner-check" /\ rows # {} /\ lo # None /\ lo # siWho
     IN IF refused
        THEN /\ tok' = None
             /\ rt' = IF siTab = "sync" THEN None ELSE rt
             /\ si' = "idle" /\ siWho' = None
             /\ UNCHANGED <<cfg, queue>>
        ELSE /\ cfg' = Cfg(TRUE, siWho, siWho)
             /\ IF "populate-after-sign-in" \in Gaps
                THEN si' = "popread" /\ UNCHANGED <<queue, siWho>>
                ELSE si' = "idle" /\ siWho' = None /\ queue' = queue \cup rows
             /\ UNCHANGED <<tok, rt>>
  /\ UNCHANGED <<rows, srv, sp, pullFirst, owner, pushOwner, pending, pullOwner, fetched, siTab, siRows, soVars, st, ed, ev>>

\* queue.populateFromExistingTasks, after persistSyncConfig commits: it reads
\* the local tasks...
PopulateReads ==
  /\ si = "popread"
  /\ si' = "popwrite" /\ siRows' = rows
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, syncVars, siWho, siTab, soVars, st, ed, ev>>

\* ...then enqueues a create for each task that has no queue row yet.
PopulateWrites ==
  /\ si = "popwrite"
  /\ queue' = queue \cup siRows
  /\ si' = "idle" /\ siWho' = None /\ siRows' = {}
  /\ UNCHANGED <<cfg, tok, rows, srv, syncVars, siTab, soVars, st, ed, ev>>

----------------------------------------------------------------------------
\* Signing out, Sign out of all devices, and Reset Everything, in either tab.
\* signOutEverywhere revokes on the server first, which only makes the server
\* refuse more requests, then runs the same disableSync.

\* disableSync: getSyncConfig() reads the row before resetSyncConfigState opens
\* its transaction. resetEverything starts with the same disableSync.
YouSignOut(t, reset) ==
  /\ so = "idle"
  /\ so' = "commit" /\ soTab' = t /\ soReset' = reset
  /\ soCfg' = IF "sign-out-reads-config-early" \in Gaps THEN cfg ELSE SignedOut(None)
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, syncVars, siVars, st, ed, ev>>

\* resetSyncConfigState: one transaction writes the signed-out row, keeping
\* localTaskOwnerUserId, and clears the queue. Without the
\* sign-out-reads-config-early gap, it reads the row inside that transaction.
SignOutSaves ==
  /\ so = "commit"
  /\ LET current == IF "sign-out-reads-config-early" \in Gaps THEN soCfg ELSE cfg
     IN cfg' = SignedOut(LocalOwner(current))
  /\ queue' = {}
  /\ so' = "clear" /\ soCfg' = SignedOut(None)
  /\ UNCHANGED <<tok, rows, srv, syncVars, siVars, soTab, soReset, st, ed, ev>>

\* clearPocketBase removes the shared key and swaps this tab's client onto a
\* throwaway store, so this tab's in-flight authRefresh lands nowhere.
SignOutClearsToken ==
  /\ so = "clear"
  /\ tok' = None
  /\ rt' = IF soTab = "sync" THEN None ELSE rt
  /\ so' = IF soReset THEN "wipe" ELSE "idle"
  /\ UNCHANGED <<cfg, rows, queue, srv, sp, pullFirst, owner, pushOwner, pending, pullOwner, fetched, siVars, soTab, soReset, soCfg, st, ed, ev>>

\* wipeLocalData, clearTables: one transaction clears every table and writes
\* the preserved sync_config, with no userId and no localTaskOwnerUserId.
ResetWipes ==
  /\ so = "wipe"
  /\ rows' = {} /\ queue' = {} /\ cfg' = SignedOut(None)
  /\ so' = "storage"
  /\ UNCHANGED <<tok, srv, syncVars, siVars, soTab, soReset, soCfg, st, ed, ev>>

\* clearLocalStorage removes pocketbase_auth, then reloadAfterReset reloads the
\* tab, which ends any sync running in it.
ResetReloads ==
  /\ so = "storage"
  /\ tok' = None
  /\ IF soTab = "sync" THEN SyncEnds ELSE UNCHANGED syncVars
  /\ so' = "idle" /\ soReset' = FALSE
  /\ UNCHANGED <<cfg, rows, queue, srv, siVars, soTab, soCfg, st, ed, ev>>

----------------------------------------------------------------------------
\* Settings and task edits, in either tab.

\* updateAutoSyncConfig calls updateSyncConfig: getSyncConfig(), then
\* put({...current, ...updates}) with no transaction. Without the
\* settings-writes-stale-config gap, the write keeps enabled, userId, and
\* localTaskOwnerUserId as they are, so it changes nothing this model tracks.
YouChangeAutoSync ==
  /\ st = {} /\ "settings-writes-stale-config" \in Gaps
  /\ st' = {cfg}
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, syncVars, siVars, soVars, ed, ev>>

AutoSyncSaves ==
  /\ st # {}
  /\ cfg' = CHOOSE c \in st : TRUE
  /\ st' = {}
  /\ UNCHANGED <<tok, rows, queue, srv, syncVars, siVars, soVars, ed, ev>>

\* runTaskSyncTransaction reads getSyncConfig() before its transaction opens.
\* An edit that reads "sync off" queues nothing, so only the other kind is modeled.
YouEditTask ==
  /\ ~ed /\ cfg.on
  /\ ed' = TRUE
  /\ UNCHANGED <<cfg, tok, rows, queue, srv, syncVars, siVars, soVars, st, ev>>

\* ...then one transaction puts the row and enqueues it, as updateTask does.
\* A task that is gone throws "not found" and queues nothing.
EditSaves(r) ==
  /\ ed
  /\ queue' = IF r \in rows THEN queue \cup {r} ELSE queue
  /\ ed' = FALSE
  /\ UNCHANGED <<cfg, tok, rows, srv, syncVars, siVars, soVars, st, ev>>

----------------------------------------------------------------------------

Next ==
  \/ SyncStarts \/ TokenFresh \/ RefreshSent \/ RefreshLands
  \/ PushStarts \/ (\E r \in Accounts : PushSends(r)) \/ PushEnds
  \/ PullFetches \/ PullApplies
  \/ (\E x, r \in Accounts : EventArrives(x, r)) \/ EventApplies
  \/ (\E t \in Tabs, x \in Accounts : YouSignIn(t, x)) \/ SignInSaves
  \/ PopulateReads \/ PopulateWrites
  \/ (\E t \in Tabs, reset \in BOOLEAN : YouSignOut(t, reset))
  \/ SignOutSaves \/ SignOutClearsToken \/ ResetWipes \/ ResetReloads
  \/ YouChangeAutoSync \/ AutoSyncSaves
  \/ YouEditTask \/ (\E r \in Accounts : EditSaves(r))

Spec == Init /\ [][Next]_vars

\* No account's server copy ever holds a task or queued edit from another account.
NoRecordInAnotherAccount == \A x \in Accounts : srv[x] \subseteq {x}

\* While sync is on for an account, this device holds only that account's
\* tasks and queued edits.
DeviceHoldsOnlyTheSignedInAccount == cfg.on => (rows \cup queue) \subseteq {cfg.user}

ASSUME Gaps \subseteq AllGaps /\ Broken \in BrokenGuards

=============================================================================
