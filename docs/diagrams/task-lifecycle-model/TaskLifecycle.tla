---------------------------- MODULE TaskLifecycle ----------------------------
\* One task on the web app, from capture until it's gone, as you see it.
\* Code: lib/tasks/crud/create.ts, lib/tasks/crud/toggle.ts (toggleCompleted),
\* lib/tasks/crud/delete.ts (deleteTask), lib/tasks/crud/restore.ts (restoreTask),
\* lib/tasks/saved.ts, lib/archive.ts, lib/trash.ts, lib/use-auto-archive.ts,
\* components/matrix-simplified/task-actions.ts (handleToggle, handleSaveForLater),
\* the delete toast in components/matrix-simplified/index.tsx, and the Undo
\* toast in lib/use-error-handler.ts (handleSuccess).
EXTENDS Naturals

CONSTANT Recurring  \* TRUE: the task repeats ("daily"), so completing it spawns the next copy

VARIABLES
  task,    \* where the task you captured is:
           \* "none" | "open" | "done" | "saved" | "archived" | "trash" | "gone"
  before,  \* the snapshot the Trash row and the delete toast hold:
           \* "open" | "done" | "saved", or "none" when neither exists
  copies,  \* open next copies on your board, spawned by completing the task
  strays,  \* next copies in Trash that you never deleted
  toast    \* the newest Undo toast: "none" | "completed" | "deleted" | "saved"

vars == <<task, before, copies, strays, toast>>

Places == {"none", "open", "done", "saved", "archived", "trash", "gone"}

TypeOK ==
  /\ task \in Places
  /\ before \in {"none", "open", "done", "saved"}
  /\ copies \in Nat /\ strays \in Nat
  /\ toast \in {"none", "completed", "deleted", "saved"}

Init ==
  /\ task = "none" /\ before = "none" /\ copies = 0 /\ strays = 0 /\ toast = "none"

\* The snapshot lives in the Trash row and in the delete toast's closure. Once
\* neither holds it, it's gone too.
Snapshot(t, tst) == IF t = "trash" \/ tst = "deleted" THEN before ELSE "none"

\* createTask from the capture bar.
YouCapture ==
  /\ task = "none"
  /\ task' = "open" /\ toast' = "none"
  /\ before' = "none"
  /\ UNCHANGED <<copies, strays>>

\* handleToggle(task, true): toggleCompleted spawns the next copy in the same
\* transaction when recurrence isn't "none", then the "Task completed" toast offers Undo.
YouComplete ==
  /\ task = "open"
  /\ task' = "done"
  /\ copies' = IF Recurring THEN copies + 1 ELSE copies
  /\ toast' = "completed"
  /\ before' = Snapshot("done", "completed")
  /\ UNCHANGED strays

\* handleToggle(task, false): unchecking a done task. toggleCompleted(id, false)
\* only flips the flag. No toast, and the copy it spawned stays on the board.
YouUncheck ==
  /\ task = "done"
  /\ task' = "open"
  /\ UNCHANGED <<copies, strays, toast, before>>

\* The completion toast's Undo: toggleCompleted(id, false), then
\* deleteTask(recurringInstance.id), which moves the copy to Trash. toggleCompleted
\* throws when the task isn't on the board or is in Saved, and then the copy stays.
YouUndoComplete ==
  /\ toast = "completed"
  /\ toast' = "none"
  /\ IF task \in {"open", "done"}
       THEN /\ task' = "open"
            /\ IF Recurring /\ copies > 0
                 THEN copies' = copies - 1 /\ strays' = strays + 1
                 ELSE UNCHANGED <<copies, strays>>
       ELSE UNCHANGED <<task, copies, strays>>
  /\ before' = Snapshot(task', "none")

\* saveTaskForLater: savedPlacementBlocker refuses a completed task.
YouSaveForLater ==
  /\ task = "open"
  /\ task' = "saved" /\ toast' = "saved"
  /\ before' = Snapshot("saved", "saved")
  /\ UNCHANGED <<copies, strays>>

\* The "Moved to Saved" toast's Undo, or putting it back from Saved: returnSavedTask.
YouReturnFromSaved ==
  /\ task = "saved"
  /\ task' = "open"
  /\ toast' = IF toast = "saved" THEN "none" ELSE toast
  /\ before' = Snapshot("open", toast')
  /\ UNCHANGED <<copies, strays>>

\* deleteTask from the board, Done, or Saved: one transaction moves the row to
\* deletedTasks, then "Task deleted. It's in Trash." offers Undo.
YouDelete ==
  /\ task \in {"open", "done", "saved"}
  /\ task' = "trash" /\ before' = task /\ toast' = "deleted"
  /\ UNCHANGED <<copies, strays>>

\* The delete toast's Undo: restoreTask(snapshot) puts the snapshot back and clears
\* any Trash row, wherever the task is now.
YouUndoDelete ==
  /\ toast = "deleted"
  /\ task' = before /\ toast' = "none"
  /\ before' = "none"
  /\ UNCHANGED <<copies, strays>>

\* restoreFromTrash on the Trash page: the row goes back as it was.
YouRestoreFromTrash ==
  /\ task = "trash"
  /\ task' = before
  /\ before' = Snapshot(task', toast)
  /\ UNCHANGED <<copies, strays, toast>>

\* restoreFromTrash on a copy that Undo put in Trash.
YouRestoreStray ==
  /\ strays > 0
  /\ strays' = strays - 1 /\ copies' = copies + 1
  /\ UNCHANGED <<task, before, toast>>

\* Delete forever, Empty Trash, or purgeExpiredTrash after 30 days.
TrashEmpties ==
  /\ task = "trash" \/ strays > 0
  /\ task' = IF task = "trash" THEN "gone" ELSE task
  /\ strays' = 0
  /\ before' = Snapshot(task', toast)
  /\ UNCHANGED <<copies, toast>>

\* useAutoArchive: archiveOldTasks moves completed tasks older than the setting.
\* That takes days, so every 5-second toast has long expired.
AutoArchive ==
  /\ task = "done" /\ toast = "none"
  /\ task' = "archived"
  /\ UNCHANGED <<before, copies, strays, toast>>

\* restoreTask on the Archive page: it comes back still completed.
YouRestoreFromArchive ==
  /\ task = "archived"
  /\ task' = "done"
  /\ UNCHANGED <<before, copies, strays, toast>>

\* deleteArchivedTask: permanent. Its Undo (reinstateArchivedTask) is left out.
YouDeleteFromArchive ==
  /\ task = "archived"
  /\ task' = "gone"
  /\ UNCHANGED <<before, copies, strays, toast>>

\* deleteTask on a next copy: you deleted it, so it isn't a stray.
YouDeleteCopy ==
  /\ copies > 0
  /\ copies' = copies - 1
  /\ UNCHANGED <<task, before, strays, toast>>

\* sonner drops the toast after TOAST_DURATION.LONG (5 seconds).
ToastExpires ==
  /\ toast # "none"
  /\ toast' = "none"
  /\ before' = Snapshot(task, "none")
  /\ UNCHANGED <<task, copies, strays>>

\* Nothing left to do: the task is gone and so is every copy.
Done ==
  /\ task = "gone" /\ copies = 0 /\ strays = 0 /\ toast = "none"
  /\ UNCHANGED vars

Next ==
  \/ YouCapture \/ YouComplete \/ YouUncheck \/ YouUndoComplete
  \/ YouSaveForLater \/ YouReturnFromSaved
  \/ YouDelete \/ YouUndoDelete \/ YouRestoreFromTrash \/ YouRestoreStray
  \/ TrashEmpties \/ AutoArchive \/ YouRestoreFromArchive \/ YouDeleteFromArchive
  \/ YouDeleteCopy \/ ToastExpires \/ Done

Spec == Init /\ [][Next]_vars

\* Rule: your board never shows two open copies of one recurring task.
OneOpenCopy == (IF task = "open" THEN 1 ELSE 0) + copies <= 1

\* Rule: Trash holds only tasks you deleted.
TrashHoldsOnlyYourDeletes == strays = 0

\* Unchecking and rechecking can spawn copies without end, so stop at two.
Bound == copies <= 2 /\ strays <= 2

\* The recurring chart's scope: the task stays on your board or in Done, with at most
\* one next copy and one stray. Saved, Archive, and Trash are in the plain chart.
BoardBound == task \in {"none", "open", "done"} /\ copies <= 1 /\ strays <= 1
=============================================================================
