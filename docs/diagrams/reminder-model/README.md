# Reminder model

These are two TLA+ models of how the web app reminds you about one open task with a due date. `Reminders.tla` models the code before PR #669. `RemindersFixed.tla` models the code as it is now, after #669 and the notify-before work (D-10, #690). The comment at the top of each model names the files it follows. The comment above each action names the function it models, such as `snoozeTask` and `pocketBaseToTaskRecord`.

The `verify-reminders` skill (`.claude/skills/verify-reminders/SKILL.md`) says when to run the check, how to read a result, and how to keep the models in step with the code.

## Run the check

```sh
bash docs/diagrams/reminder-model/check.sh
```

It runs every config through `scripts/tlc.sh`, which pins TLC 1.7.4 and checks the jar's hash. It prints one line per config and exits 0 only when each result matches the table. A run takes about five seconds.

| Config | Model | Expected result |
|---|---|---|
| `Reminders.cfg` | before #669, with another device | Breaks `DueReminderStillOwed` when another device moves a due date after the reminder showed. |
| `RemindersOneDevice.cfg` | before #669, one device | Breaks `DueReminderStillOwed` when a snooze ends before the reminder time. |
| `RemindersFixed.cfg` | the code now | All five rules hold (76 states). |
| `BreakSnoozeKeepsSent.cfg` | now, but `snoozeTask` no longer clears the sent flag | Breaks `SnoozeBringsItBack`. |
| `BreakSnoozeFiresEarly.cfg` | now, but `isReminderDue` fires a snooze that ends before the reminder time | Breaks `NoEarlyReminder`. |
| `BreakRawOffsetCompare.cfg` | now, but `updateTask` compares raw offsets, so storing a legacy null as the default re-arms the reminder | Breaks `EachReminderOnce`. |

A check that has never failed proves nothing, so each rule has a config that breaks it. The `Break*` configs set the `Break` constant in `RemindersFixed.tla`, and each value undoes one guard in the code. Each `Break*` config checks only the rule its break should break.

`seen`, `seenSnooze`, `shows`, and `early` are ghost variables. The app has no such fields. They record what you've seen, so the rules can say what the app still owes you. `legacyOffset` is real: it's a row whose `notifyBefore` is still null because a build before D-10 stored it.

## The chart

`view.mjs` and `view-fixed.mjs` turn model states into the labels on the chart. Read every result with the `/pstack:statechart` skill. Give it `view-fixed.mjs` as the view for `RemindersFixed.tla`, or `view.mjs` for `Reminders.tla`, and write its output to a scratch folder outside the repo. The current-code chart has 6 states and 11 arrows. The steps D-10 added change only the stored offset, so they stay inside one label and the chart looks the same as it did at 41 states.

`../generate-reminder-statechart.py` redraws those charts as `../reminder-statechart.html`. It draws from its own tables, so a change to a chart here means updating that script by hand.

## What the models leave out

The models follow one task on the web app. Time has only three values: before the reminder time, the hour after it, and later. A due date or offset only moves later, and the device's default reminder never changes.

The models treat the checker's read, the notification, and `markNotificationSent` as one step. The code awaits the settings read, the service worker, and `showNotification` in between. So a snooze or completion that lands in that gap still shows that reminder. Since D-10, a write that stores a legacy null offset as the default in that gap, from `updateTask` or `settleRowOffset` in `lib/sync/pb-push.ts`, makes `isSameReminder` skip the mark, and the reminder can show a second time a minute later.

They don't model the offset's value. A pull that changes only `notify_before` keeps this device's sent flag. D-10 makes every new write a number, but a server `0` can still be an old null, so a reset there would re-fire reminders on unrelated edits. Pull is unchanged by D-10 (`tasks/spec-notify-before.md` section 3). `OtherDeviceEditsTask` assumes the server's offset fires at the same time as this device's.

They leave out the per-task reminder switch (`notificationEnabled`) and the Settings switch, which stop the checker for this task. Quiet hours aren't modeled either, since `reminderWindow` folds them into the fire time. Completing, saving for later, archiving, and Trash take the task off the checker's list, and the models don't follow it there. They also leave out two open tabs showing the same reminder, the weekly sweep reminder, and the iOS and Android apps.
