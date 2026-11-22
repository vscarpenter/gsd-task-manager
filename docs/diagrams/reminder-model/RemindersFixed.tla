---------------------------- MODULE RemindersFixed ----------------------------
\* One open task with a due date, as the web app reminds it after fix/lost-reminders
\* (#669) and the notify-before work (D-10, #690).
\* Code: lib/notification-checker.ts, lib/notifications/reminder-window.ts,
\* lib/tasks/crud/snooze.ts, lib/tasks/crud/update.ts, lib/sync/task-mapper.ts,
\* lib/sync/pb-push.ts.
EXTENDS Naturals

CONSTANT OtherDevices  \* TRUE: the task is also edited on another device
CONSTANT Break         \* "none" is the code as it is. Each other value undoes one guard.

\* snoozeKeepsSent:  buildSnoozedRecord stops clearing notificationSent.
\* snoozeFiresEarly: isReminderDue drops its `fire < planned.fire` check.
\* rawOffsetCompare: buildUpdatedRecord compares raw offsets, not effective ones.
ASSUME Break \in {"none", "snoozeKeepsSent", "snoozeFiresEarly", "rawOffsetCompare"}

VARIABLES
  dueWin,       \* where now stands against the reminder: "before" | "open" | "closed"
  snooze,       \* "none" | "holding" | "endedOpen" | "endedClosed" | "endedEarly"
  sent,         \* the stored notificationSent flag
  legacyOffset, \* the stored notifyBefore is still null, from a build before D-10
  seen,         \* ghost: a reminder showed since the current reminder time came
  seenSnooze,   \* ghost: a reminder showed since the last snooze ended
  shows,        \* ghost: reminders shown since the reminder time or snooze began
  early         \* ghost: the last reminder shown came before its reminder time

vars == <<dueWin, snooze, sent, legacyOffset, seen, seenSnooze, shows, early>>

TypeOK ==
  /\ dueWin \in {"before", "open", "closed"}
  /\ snooze \in {"none", "holding", "endedOpen", "endedClosed", "endedEarly"}
  /\ sent \in BOOLEAN /\ legacyOffset \in BOOLEAN
  /\ seen \in BOOLEAN /\ seenSnooze \in BOOLEAN
  /\ shows \in 0..2 /\ early \in BOOLEAN

\* A task created since D-10 stores a number; one stored before it can still hold null.
Init ==
  /\ dueWin = "before" /\ snooze = "none" /\ sent = FALSE
  /\ legacyOffset \in BOOLEAN
  /\ seen = FALSE /\ seenSnooze = FALSE /\ shows = 0 /\ early = FALSE

\* checkTask: !notificationSent && isReminderDue(...). A holding snooze blocks;
\* otherwise the due window or the hour after a snooze ends asks for it. The
\* checker reads `notifyBefore ?? defaultReminder`, so a legacy null fires at the
\* default, the same number a write would store.
CodeWantsReminder ==
  /\ ~sent
  /\ snooze # "holding"
  /\ (dueWin = "open" \/ snooze = "endedOpen")

\* The app checks (every minute while open), shows the reminder, then
\* markNotificationSent sets notificationSent and lastNotificationAt only.
AppShows ==
  /\ CodeWantsReminder
  /\ sent' = TRUE
  /\ seen' = (seen \/ dueWin # "before")
  /\ seenSnooze' = (seenSnooze \/ snooze \in {"endedOpen", "endedClosed"})
  /\ shows' = IF shows < 2 THEN shows + 1 ELSE 2
  /\ early' = (dueWin = "before")
  /\ UNCHANGED <<dueWin, snooze, legacyOffset>>

\* reminderWindow: the fire time comes, then its hour (GRACE_MS) passes.
ReminderTimeComes ==
  /\ dueWin = "before" /\ dueWin' = "open"
  /\ shows' = 0
  /\ UNCHANGED <<snooze, sent, legacyOffset, seen, seenSnooze, early>>

ReminderHourPasses ==
  /\ dueWin = "open" /\ dueWin' = "closed"
  /\ UNCHANGED <<snooze, sent, legacyOffset, seen, seenSnooze, shows, early>>

\* isReminderDue: an ended snooze asks again for an hour, unless it ended before
\* the reminder time (`if (fire < planned.fire) return false`).
SnoozeEnds ==
  /\ snooze = "holding"
  /\ snooze' = IF dueWin = "before" /\ Break # "snoozeFiresEarly"
                 THEN "endedEarly" ELSE "endedOpen"
  /\ seenSnooze' = FALSE
  /\ UNCHANGED <<dueWin, sent, legacyOffset, seen, shows, early>>

SnoozeHourPasses ==
  /\ snooze = "endedOpen" /\ snooze' = "endedClosed"
  /\ UNCHANGED <<dueWin, sent, legacyOffset, seen, seenSnooze, shows, early>>

\* snoozeTask (buildSnoozedRecord): any open task, any time; clears notificationSent.
YouSnooze ==
  /\ snooze # "holding"
  /\ snooze' = "holding" /\ shows' = 0
  /\ sent' = IF Break = "snoozeKeepsSent" THEN sent ELSE FALSE
  /\ UNCHANGED <<dueWin, legacyOffset, seen, seenSnooze, early>>

\* clearSnooze: the menu offers it only while a snooze holds. Leaves notificationSent.
YouClearSnooze ==
  /\ snooze = "holding" /\ snooze' = "none"
  /\ UNCHANGED <<dueWin, sent, legacyOffset, seen, seenSnooze, shows, early>>

\* updateTask with a changed dueDate, or an offset that moves the reminder later:
\* buildUpdatedRecord resets notificationSent and the snooze, and mergeTaskUpdates
\* stores a null offset as the default.
YouMoveDueDate ==
  /\ dueWin' = "before" /\ snooze' = "none" /\ sent' = FALSE
  /\ legacyOffset' = FALSE
  /\ seen' = FALSE /\ shows' = 0
  /\ UNCHANGED <<seenSnooze, early>>

\* updateTask that keeps the due date and what the offset fires at, such as a title
\* edit or picking the offset the field already shows. mergeTaskUpdates stores a
\* null offset as the default, and buildUpdatedRecord compares `?? defaultReminder`
\* on both sides, so the save doesn't re-arm. Under rawOffsetCompare, a save that
\* sends the default for a null row looks like a moved reminder.
YouSaveTask ==
  /\ legacyOffset' = FALSE
  /\ \/ UNCHANGED <<sent, snooze>>
     \/ /\ Break = "rawOffsetCompare" /\ legacyOffset
        /\ sent' = FALSE /\ snooze' = "none"
  /\ UNCHANGED <<dueWin, seen, seenSnooze, shows, early>>

\* upsertRemoteTask (settleRowOffset): a queued null offset pushes the default and
\* stores it on the row, with no stamp bump and no reminder reset.
PushStoresOffset ==
  /\ legacyOffset /\ legacyOffset' = FALSE
  /\ UNCHANGED <<dueWin, snooze, sent, seen, seenSnooze, shows, early>>

\* pocketBaseToTaskRecord (localReminderState): a different due instant resets
\* notificationSent and snoozedUntil. notifyBefore takes the server's number.
OtherDeviceMovesDueDate ==
  /\ OtherDevices
  /\ dueWin' = "before" /\ snooze' = "none" /\ sent' = FALSE
  /\ legacyOffset' = FALSE
  /\ seen' = FALSE /\ shows' = 0
  /\ UNCHANGED <<seenSnooze, early>>

\* pocketBaseToTaskRecord (localReminderState): the same due instant keeps this
\* device's notificationSent and snoozedUntil. The server's offset is assumed to
\* fire at the same time as this device's.
OtherDeviceEditsTask ==
  /\ OtherDevices
  /\ legacyOffset' = FALSE
  /\ UNCHANGED <<dueWin, snooze, sent, seen, seenSnooze, shows, early>>

Next ==
  \/ AppShows
  \/ ReminderTimeComes \/ ReminderHourPasses
  \/ SnoozeEnds \/ SnoozeHourPasses
  \/ YouSnooze \/ YouClearSnooze
  \/ YouMoveDueDate \/ YouSaveTask \/ PushStoresOffset
  \/ OtherDeviceMovesDueDate \/ OtherDeviceEditsTask

Spec == Init /\ [][Next]_vars

\* Once a reminder's time comes and nothing holds it, the app still owes it to
\* you until you have seen it.
DueReminderStillOwed ==
  (dueWin = "open" /\ snooze # "holding" /\ ~seen) => ~sent

\* When a snooze ends, the app owes you the reminder until you have seen it.
SnoozeBringsItBack ==
  (snooze = "endedOpen" /\ ~seenSnooze) => ~sent

\* You get each reminder once: one per reminder time, one per snooze.
EachReminderOnce == shows <= 1

\* A reminder never shows before its reminder time (owner decision, 2026-11-03).
NoEarlyReminder == ~early

=============================================================================
