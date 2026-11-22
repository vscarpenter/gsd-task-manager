----------------------------- MODULE RetryBudget -----------------------------
\* One task on one web device, its sync queue, and its server record. It
\* follows the retry budget from the first failed push to what a remote absence
\* then does with the task.
\* Code: lib/sync/queue.ts, lib/sync/pb-push.ts, lib/sync/pb-pull.ts,
\* lib/sync/pb-sync-engine.ts (applyRemoteDeletion), lib/sync/failed-recovery.ts.
EXTENDS Integers

CONSTANTS
  MaxRetries,   \* SYNC_CONFIG.MAX_RETRIES
  Variant       \* "code", "transient-free" (proposed), or a past bug

VARIABLES
  task,          \* "live", "trash", or "gone" from this device
  srv,           \* the server "has" a record of the task, or it's "absent"
  unsent,        \* this device holds an edit the server never got
  tries,         \* the pending row's retryCount, or NoRow
  rejected,      \* the server rejected that row at least once
  failed,        \* a retry-exhausted row is in the queue
  failedReject,  \* a rejection helped exhaust it
  refusedCharge, \* ghost: a refused session spent the budget
  shielded,      \* ghost: an exhausted row alone held off a remote absence
  outageTrash    \* ghost: failures that judged nothing moved the task to Trash

vars == <<task, srv, unsent, tries, rejected, failed, failedReject,
          refusedCharge, shielded, outageTrash>>

NoRow == 0 - 1
HasPending == tries # NoRow

\* A failure is no answer (status 0, a 429, a 5xx, an unreadable lookup), a
\* refused session, or the server rejecting this write.
Causes == {"transient", "refused", "rejected"}

TypeOK ==
  /\ task \in {"live", "trash", "gone"}
  /\ srv \in {"has", "absent"}
  /\ tries \in NoRow..(MaxRetries - 1)
  /\ {unsent, rejected, failed, failedReject, refusedCharge, shielded, outageTrash} \subseteq BOOLEAN

\* A task never uploaded, a synced task with a queued edit, or a synced task.
Init ==
  /\ task = "live"
  /\ \/ srv = "absent" /\ unsent = TRUE /\ tries = 0
     \/ srv = "has" /\ unsent = TRUE /\ tries = 0
     \/ srv = "has" /\ unsent = FALSE /\ tries = NoRow
  /\ rejected = FALSE /\ failed = FALSE /\ failedReject = FALSE
  /\ refusedCharge = FALSE /\ shielded = FALSE /\ outageTrash = FALSE

\* An edit commits with a fresh queue row (runTaskSyncTransaction, enqueue).
YouEdit ==
  /\ task = "live" /\ ~HasPending
  /\ unsent' = TRUE /\ tries' = 0 /\ rejected' = FALSE
  /\ UNCHANGED <<task, srv, failed, failedReject, refusedCharge, shielded, outageTrash>>

\* pushSingleItem sends it and dequeues that row. An older exhausted row stays.
PushLands ==
  /\ task = "live" /\ HasPending
  /\ srv' = "has" /\ unsent' = FALSE /\ tries' = NoRow /\ rejected' = FALSE
  /\ UNCHANGED <<task, failed, failedReject, refusedCharge, shielded, outageTrash>>

\* recordItemFailure charges every cause except a refused session, which stops
\* the push first (isSessionCheckFailure).
Charged(cause) ==
  CASE Variant = "refused-charges" -> TRUE
    [] Variant = "transient-free" -> cause = "rejected"
    [] OTHER -> cause # "refused"

\* recordAttemptFailure counts one try and marks the row failed at MaxRetries.
PushFails(cause) ==
  /\ task = "live" /\ HasPending /\ Charged(cause)
  /\ refusedCharge' = (refusedCharge \/ cause = "refused")
  /\ LET hit == rejected \/ cause = "rejected"
         runsOut == tries + 1 >= MaxRetries
         keeps == runsOut /\ Variant # "exhausted-row-deleted"
     IN /\ tries' = IF runsOut THEN NoRow ELSE tries + 1
        /\ rejected' = IF runsOut THEN FALSE ELSE hit
        /\ failed' = (failed \/ keeps)
        /\ failedReject' = (failedReject \/ (keeps /\ hit))
  /\ UNCHANGED <<task, srv, unsent, shielded, outageTrash>>

OtherDeviceDeletes ==
  /\ srv = "has"
  /\ srv' = "absent"
  /\ UNCHANGED <<task, unsent, tries, rejected, failed, failedReject, refusedCharge, shielded, outageTrash>>

\* classifyRemoteDeletion: a pending row protects, an exhausted one abandons to
\* Trash, and no row lets the deletion apply.
Verdict ==
  CASE HasPending -> "protect"
    [] failed /\ Variant = "failed-row-shields" -> "protect"
    [] failed /\ Variant = "failed-row-dropped" -> "apply"
    [] failed -> "abandon"
    [] OTHER -> "apply"

\* reconcileDeletedTasks after it confirms the session, or applyRemoteDeletion.
\* Either releases the task's rows in the transaction that moves it.
AbsenceApplies ==
  /\ task = "live" /\ srv = "absent"
  /\ LET verdict == Verdict
     IN /\ task' = CASE verdict = "protect" -> "live"
                     [] verdict = "abandon" -> "trash"
                     [] OTHER -> "gone"
        /\ failed' = (failed /\ verdict = "protect")
        /\ failedReject' = (failedReject /\ verdict = "protect")
        /\ shielded' = (shielded \/ (verdict = "protect" /\ ~HasPending))
        /\ outageTrash' = (outageTrash \/ (verdict = "abandon" /\ ~failedReject))
  /\ UNCHANGED <<srv, unsent, tries, rejected, refusedCharge>>

\* recoverFailedSyncItem drops the exhausted rows. With none pending, Retry
\* queues the task as it is now.
YouRetry ==
  /\ task = "live" /\ failed
  /\ failed' = FALSE /\ failedReject' = FALSE
  /\ tries' = IF HasPending THEN tries ELSE 0
  /\ rejected' = IF HasPending THEN rejected ELSE FALSE
  /\ UNCHANGED <<task, srv, unsent, refusedCharge, shielded, outageTrash>>

\* With none pending, Dismiss moves the task to Trash.
YouDismiss ==
  /\ task = "live" /\ failed
  /\ failed' = FALSE /\ failedReject' = FALSE
  /\ task' = IF HasPending THEN task ELSE "trash"
  /\ UNCHANGED <<srv, unsent, tries, rejected, refusedCharge, shielded, outageTrash>>

\* A task that left the device is an end of the story, not a deadlock.
Left == task # "live" /\ UNCHANGED vars

Next ==
  \/ YouEdit
  \/ PushLands
  \/ \E cause \in Causes : PushFails(cause)
  \/ OtherDeviceDeletes
  \/ AbsenceApplies
  \/ YouRetry
  \/ YouDismiss
  \/ Left

Spec == Init /\ [][Next]_vars

\* An edit the server never got is live with a row to send or retry, or in Trash.
NoSilentLoss ==
  unsent => (task = "trash" \/ (task = "live" /\ (HasPending \/ failed)))

\* A refused session says nothing about the write, so it spends no budget.
RefusedKeepsBudget == ~refusedCharge

\* An exhausted row is never sent by itself, so it can't hold off a deletion.
FailedRowNeverShields == ~shielded

\* No answer says nothing about the write, so it can't move a task to Trash.
OutageNeverTrashes == ~outageTrash
=============================================================================
