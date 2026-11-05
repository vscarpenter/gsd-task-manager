---------------------------- MODULE RemindersFixed ----------------------------
\* One open task with a due date, as the web app reminds it after fix/lost-reminders.
\* Code: lib/notification-checker.ts, lib/notifications/reminder-window.ts,
\* lib/tasks/crud/snooze.ts, lib/tasks/crud/update.ts, lib/sync/task-mapper.ts.
EXTENDS Naturals

CONSTANT OtherDevices  \* TRUE: the task is also edited on another device

VARIABLES
  dueWin,      \* where now stands against the reminder: "before" | "open" | "closed"
  snooze,      \* "none" | "holding" | "endedOpen" | "endedClosed" | "endedEarly"
  sent,        \* the stored notificationSent flag
  seen,        \* ghost: a reminder showed since the current reminder time came
  seenSnooze,  \* ghost: a reminder showed since the last snooze ended
  shows,       \* ghost: reminders shown since the reminder time or snooze began
  early        \* ghost: the last reminder shown came before its reminder time

vars == <<dueWin, snooze, sent, seen, seenSnooze, shows, early>>

TypeOK ==
  /\ dueWin \in {"before", "open", "closed"}
  /\ snooze \in {"none", "holding", "endedOpen", "endedClosed", "endedEarly"}
  /\ sent \in BOOLEAN /\ seen \in BOOLEAN /\ seenSnooze \in BOOLEAN
  /\ shows \in 0..2 /\ early \in BOOLEAN

Init ==
  /\ dueWin = "before" /\ snooze = "none" /\ sent = FALSE
  /\ seen = FALSE /\ seenSnooze = FALSE /\ shows = 0 /\ early = FALSE

\* checkTask: !notificationSent && isReminderDue(...). A holding snooze blocks;
\* otherwise the due window or the hour after a snooze ends asks for it.
CodeWantsReminder ==
  /\ ~sent
  /\ snooze # "holding"
  /\ (dueWin = "open" \/ snooze = "endedOpen")

\* The app checks (every minute while open) and shows the reminder, then marks it sent.
AppShows ==
  /\ CodeWantsReminder
  /\ sent' = TRUE
  /\ seen' = (seen \/ dueWin # "before")
  /\ seenSnooze' = (seenSnooze \/ snooze \in {"endedOpen", "endedClosed"})
  /\ shows' = IF shows < 2 THEN shows + 1 ELSE 2
  /\ early' = (dueWin = "before")
  /\ UNCHANGED <<dueWin, snooze>>

ReminderTimeComes ==
  /\ dueWin = "before" /\ dueWin' = "open"
  /\ shows' = 0
  /\ UNCHANGED <<snooze, sent, seen, seenSnooze, early>>

ReminderHourPasses ==
  /\ dueWin = "open" /\ dueWin' = "closed"
  /\ UNCHANGED <<snooze, sent, seen, seenSnooze, shows, early>>

SnoozeEnds ==
  /\ snooze = "holding"
  /\ snooze' = IF dueWin = "before" THEN "endedEarly" ELSE "endedOpen"
  /\ seenSnooze' = FALSE
  /\ UNCHANGED <<dueWin, sent, seen, shows, early>>

SnoozeHourPasses ==
  /\ snooze = "endedOpen" /\ snooze' = "endedClosed"
  /\ UNCHANGED <<dueWin, sent, seen, seenSnooze, shows, early>>

\* snoozeTask: any open task, any time; clears notificationSent.
YouSnooze ==
  /\ snooze # "holding"
  /\ snooze' = "holding" /\ sent' = FALSE /\ shows' = 0
  /\ UNCHANGED <<dueWin, seen, seenSnooze, early>>

\* clearSnooze: the menu offers it only while a snooze holds. Leaves notificationSent.
YouClearSnooze ==
  /\ snooze = "holding" /\ snooze' = "none"
  /\ UNCHANGED <<dueWin, sent, seen, seenSnooze, shows, early>>

\* updateTask with a changed dueDate: resets notificationSent and the snooze.
YouMoveDueDate ==
  /\ dueWin' = "before" /\ snooze' = "none" /\ sent' = FALSE
  /\ seen' = FALSE /\ shows' = 0
  /\ UNCHANGED <<seenSnooze, early>>

\* pocketBaseToTaskRecord: a different due instant resets notificationSent and snoozedUntil.
OtherDeviceMovesDueDate ==
  /\ OtherDevices
  /\ dueWin' = "before" /\ snooze' = "none" /\ sent' = FALSE
  /\ seen' = FALSE /\ shows' = 0
  /\ UNCHANGED <<seenSnooze, early>>

Next ==
  \/ AppShows
  \/ ReminderTimeComes \/ ReminderHourPasses
  \/ SnoozeEnds \/ SnoozeHourPasses
  \/ YouSnooze \/ YouClearSnooze
  \/ YouMoveDueDate \/ OtherDeviceMovesDueDate

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
