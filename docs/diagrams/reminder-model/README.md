# Reminder model

These are two TLA+ models of how the web app reminds you about one open task with a due date. `Reminders.tla` models the code before PR #669, and `RemindersFixed.tla` models it after. The comment at the top of each model names the files it follows. The comments above the actions you take, and above the check that decides to remind you, name the function each one models, such as `snoozeTask` and `pocketBaseToTaskRecord`.

| Config | Model | What TLC finds |
|---|---|---|
| `Reminders.cfg` | before, with another device | 52 states. `DueReminderStillOwed` breaks when another device moves a due date after the reminder showed. |
| `RemindersOneDevice.cfg` | before, one device | 44 states. `DueReminderStillOwed` still breaks, this time when a snooze ends before the reminder time. |
| `RemindersFixed.cfg` | after | 41 states. All six rules hold, including `NoEarlyReminder`, which only this config checks. |

`seen`, `seenSnooze`, `shows`, and `early` are ghost variables. The app has no such fields. They record what you've seen, so the rules can say what the app still owes you.

`view.mjs` and `view-fixed.mjs` turn model states into the labels on the chart. `../generate-reminder-statechart.py` redraws those charts as `../reminder-statechart.html`. It draws from its own tables, so a change here means updating that script by hand.

## Run the models

The `/pstack:statechart` skill runs TLC and writes a Mermaid chart, a report with each bug path, and TLC's output. Run it from the repo root, with the output going to a scratch folder outside the repo:

```sh
SC=~/.claude/plugins/cache/cursor-plugins/pstack/<version>/skills/statechart/scripts/statechart
M=docs/diagrams/reminder-model
OUT=<scratch folder>
$SC $M/Reminders.tla --config $M/Reminders.cfg --view $M/view.mjs --out $OUT/before
$SC $M/Reminders.tla --config $M/RemindersOneDevice.cfg --view $M/view.mjs --out $OUT/one-device
$SC $M/RemindersFixed.tla --config $M/RemindersFixed.cfg --view $M/view-fixed.mjs --out $OUT/after
```

The command exits 1 when a rule breaks. That's the finding, not a crash.

The skill installs TLC with mise on its first run. Without mise, download the tla2tools jar the skill pins (1.7.4), then set `TLA2TOOLS` to the jar and `JAVA` to a Java 21 binary.

## What the models leave out

The models follow one task on the web app, and time has only three values: before the reminder time, the hour after it, and later. They don't model `notify_before`. A pull that changes only `notify_before` doesn't reset the reminder, because PocketBase returns an unset number as 0 and the clients can't tell unset from zero. They also leave out the gap between the checker reading a task and showing its reminder, two open tabs showing the same reminder, and the iOS and Android apps.
