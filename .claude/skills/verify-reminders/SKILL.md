---
name: verify-reminders
description: Model-checks, with TLA+ and TLC, how the web app reminds you about one open task with a due date, so a change can't lose, repeat, or rush a reminder. Use when a change touches lib/notification-checker.ts, lib/notifications/reminder-window.ts, display.ts, or default-reminder.ts, lib/due-time.ts, lib/snooze-presets.ts, lib/tasks/crud/snooze.ts, lib/tasks/crud/update.ts (mergeTaskUpdates, buildUpdatedRecord), lib/sync/task-mapper.ts (pocketBaseToTaskRecord, localReminderState), lib/sync/pb-push.ts (resolveNotifyBefore, settleRowOffset), or any code that writes notificationSent, lastNotificationAt, snoozedUntil, or notifyBefore on a task.
---

# Verify reminders

A TLA+ model of one open task's reminder on the web app lives in `docs/diagrams/reminder-model/`. TLC checks every order of the steps in the model: the checker running, the reminder time and its hour passing, a snooze starting and ending, your edits, a sync push, and pulls from another device. A pass covers the model, not the whole app, so read "Bounds and what's left out" before you trust one.

The model found two lost reminders on 2026-11-03, and PR #669 fixed both. `Reminders.tla` is the code before that fix. `RemindersFixed.tla` is the code now. Change only `RemindersFixed.tla` when the code changes. `Reminders.tla` is a record of the old code.

## The rules

Each rule is an INVARIANT in `RemindersFixed.tla`.

| Rule | What the app promises | The harm when it breaks |
|---|---|---|
| `DueReminderStillOwed` | Once a reminder's time comes and no snooze holds it, the app shows it unless you've already seen it. | A task comes due and you never hear about it. |
| `SnoozeBringsItBack` | When a snooze ends, the app shows the reminder again unless you've seen it since. | A task you snoozed stays silent, and you forget it. |
| `EachReminderOnce` | You get one reminder per reminder time and one per snooze. | The same reminder shows twice for one due time. |
| `NoEarlyReminder` | A reminder never shows before its reminder time (owner decision, 2026-11-03). | You get a reminder before the time you asked for. |

`TypeOK` keeps each variable in its range. It guards the model, not the app.

## Run the check

```sh
bash docs/diagrams/reminder-model/check.sh
```

It runs six configs through `scripts/tlc.sh`, which pins TLC 1.7.4 by hash and finds Java 21. The first run downloads the jar. A run takes about five seconds and prints one line per config. It exits 0 only when every line says `ok`:

```
ok    Reminders.cfg              breaks DueReminderStillOwed (18 states)
ok    RemindersOneDevice.cfg     breaks DueReminderStillOwed (20 states)
ok    RemindersFixed.cfg         holds (76 states)
ok    BreakSnoozeKeepsSent.cfg   breaks SnoozeBringsItBack (26 states)
ok    BreakSnoozeFiresEarly.cfg  breaks NoEarlyReminder (19 states)
ok    BreakRawOffsetCompare.cfg  breaks EachReminderOnce (38 states)
All 6 configs match.
```

`RemindersFixed.cfg` is the code as it is, and it must hold. Every other config must break the rule its line names. The two `Reminders*` configs are the code before #669. Each `Break*` config sets the `Break` constant in `RemindersFixed.tla`, which undoes one guard in the code, so each rule has been seen to fail. A `FAIL` line prints the `scripts/tlc.sh` command that reproduces it.

Read every result, pass or fail, with the pstack `/statechart` skill. On a break, it tells TLC's shortest path as steps in plain words. On a pass, it draws how the task moves between states. Give it `view-fixed.mjs` as the view for `RemindersFixed.tla`, and send its output to a scratch folder outside the repo.

## When a change touches this code

1. **See what changed.** Diff the covered files from the sync commit (below) to your working tree: `git diff dd32e08c -- lib/notification-checker.ts lib/notifications lib/due-time.ts lib/snooze-presets.ts lib/tasks/crud/snooze.ts lib/tasks/crud/update.ts lib/sync/task-mapper.ts lib/sync/pb-push.ts`. Then look for new writers: `rg -n "notificationSent|lastNotificationAt|snoozedUntil|notifyBefore" lib components app`, and compare the hits with the coverage record.
2. **Run the check before you touch the model.** A pass here only says the old description still holds.
3. **Map each change to a model action** through the coverage record. A change has no effect, or the model no longer describes the code, or the promise changed on purpose, or the promise may be broken. Decide from the model, not from the commit message.
4. **Update `RemindersFixed.tla` from the code**, as "Update the model for an intended change" says. Write the update before you rerun, and don't shape it by what passes.
5. **Rerun the check and read the result with `/statechart`.** If `RemindersFixed.cfg` breaks a rule, replay the path (next section). If it holds, break the new code's guard once, the way the `Break` constant does, and confirm a rule fails. A model that can't fail proves nothing.
6. **Move the sync commit** only when every change is accounted for and the check matches.

## Real bug or modeling error

Replay the path against the real code before you call it either. Write a Vitest file under `tests/data/` with one step per model action, on a fixed clock. Copy the shape of the "reminders that must not go missing" block in `tests/data/notification-checker-indexeddb.test.ts`: it mocks `@/lib/notifications`, fakes `Date`, and counts `showTaskNotification` calls.

| Model action | What the replay does |
|---|---|
| `ReminderTimeComes`, `ReminderHourPasses`, `SnoozeEnds`, `SnoozeHourPasses` | `vi.setSystemTime` to the fire time, 61 minutes after it, or the snooze end |
| `AppShows` | `await notificationChecker.checkAndNotify()` |
| `YouSnooze`, `YouClearSnooze` | `snoozeTask(id, minutes)`, `clearSnooze(id)` |
| `YouMoveDueDate`, `YouSaveTask` | `updateTask(id, { ... })` |
| `PushStoresOffset` | a push through `pushLocalChanges` with `vi.mock('pocketbase')`, as `tests/data/sync/pb-push.test.ts` does |
| `OtherDeviceMovesDueDate`, `OtherDeviceEditsTask` | `db.tasks.put(pocketBaseToTaskRecord(remote, local))`, where `remote` is `taskRecordToPocketBase(local, "owner", "other-device", 15)` with the pulled `due_date` |

Run it with `bun run test tests/data/<file>.test.ts`, then `mv` it to a scratch folder outside the repo. Never commit a replay. Agents can't run `rm` here, so move unwanted files with `mv`.

- **Every step happens and the harm shows:** it's a bug in the code. Find the commit that brought it in with `git log -L` on the changed function. Report the path in the code's words and the harm in one sentence. Don't weaken a rule or the model to make the check pass, and don't change product code unless the user asks.
- **A step can't happen in the code:** the model is wrong. Fix the action so it matches the code, say what was wrong, and rerun.

## Update the model for an intended change

- **The code changed shape.** Edit the action the coverage record names. One indivisible step in the code is one action in the model. A step that awaits between a read and a write is two steps. Add a variable only for stored state, or as a ghost that records what you've seen.
- **A new writer reaches the reminder fields.** Add an action for it, and a row in the coverage record.
- **A new guard protects a rule.** Add a `Break` value that undoes it, a `Break*.cfg` that checks only that rule, and a line in `check.sh`'s `checks` list.
- **The promise changed on purpose.** Change the rule only with evidence: a spec, an ADR, an owner decision, or the tests and commit message of the change. Put the old wording, the new wording, and the evidence in the commit message and in the rule's comment.
- **The chart changed.** If the current-code chart's labels or arrows change, update `view-fixed.mjs`. `docs/diagrams/generate-reminder-statechart.py` draws `docs/diagrams/reminder-statechart.html` from its own tables, so update it by hand.
- Keep the model update in its own commit, apart from any product fix.

## Coverage record

| Model part | File | Function |
|---|---|---|
| `CodeWantsReminder`, `AppShows` | `lib/notification-checker.ts` | `processNotifications` (open, not Saved, has a due date, `notificationEnabled !== false`), `checkTask` (`!notificationSent && isReminderDue`, offset `?? defaultReminder`), `markNotificationSent` and `isSameReminder` |
| | `lib/notifications/display.ts` | `showTaskNotification`: returns false when nothing showed, so the mark is skipped |
| | `lib/notifications/reminder-window.ts` | `isReminderDue` |
| `ReminderTimeComes`, `ReminderHourPasses` | `lib/notifications/reminder-window.ts` | `reminderWindow`: fire time, and expiry 60 minutes later (`GRACE_MS`) |
| | `lib/due-time.ts` | `timeOf`: a local-midnight due date is all day and fires at 09:00 |
| `SnoozeEnds`, `SnoozeHourPasses` | `lib/notifications/reminder-window.ts` | `isReminderDue`: a future snooze holds; a snooze that ends before the fire time asks for nothing (`fire < planned.fire`); otherwise it asks for an hour |
| `YouSnooze` | `lib/tasks/crud/snooze.ts` | `snoozeTask`, `buildSnoozedRecord` (clears `notificationSent`) |
| | `lib/snooze-presets.ts`, `components/matrix-simplified/task-actions.ts` | `SNOOZE_PRESETS`; `saveEditedTask` snoozes after its `updateTask`, as a second step |
| `YouClearSnooze` | `lib/tasks/crud/snooze.ts` | `clearSnooze` (`snoozeTask(id, 0)`, keeps `notificationSent`) |
| `YouMoveDueDate`, `YouSaveTask` | `lib/tasks/crud/update.ts` | `updateTask`, `mergeTaskUpdates` (stores a null offset as the default), `buildUpdatedRecord` (resets on a changed due date or effective offset) |
| | `lib/notifications/default-reminder.ts` | `readDefaultReminder` |
| `PushStoresOffset` | `lib/sync/pb-push.ts` | `upsertRemoteTask`, `resolveNotifyBefore`, `settleRowOffset` |
| `OtherDeviceMovesDueDate`, `OtherDeviceEditsTask` | `lib/sync/task-mapper.ts` | `pocketBaseToTaskRecord`, `localReminderState`, `isSameDueInstant` |
| | `lib/sync/pb-sync-helpers.ts`, `pb-pull.ts`, `pb-sync-engine.ts`, `resurrect-on-sight.ts` | `mapOverLocalCopy`, `applyRemoteRecords`, `applyRemoteChange`, `resurrectOnSight`: every pull path maps over the local copy |
| `Break` values | `lib/tasks/crud/snooze.ts`, `reminder-window.ts`, `update.ts` | `snoozeKeepsSent`, `snoozeFiresEarly`, and `rawOffsetCompare` each undo one guard above |

These write the same fields, and the model leaves them out on purpose. `createTask`, `duplicateTask`, and `buildRecurringInstance` (`lib/tasks/crud/toggle.ts`) start a new task with its reminder unsent. `saveTaskForLater` (`lib/tasks/saved.ts`) takes the task off the checker's list. `resetTaskNotification` and `snoozeTaskNotification` in `lib/notification-checker.ts` have no callers today. If either gains one, it's a new writer. The MCP server writes the server only, and a pull applies its edits like any other device's.

## Sync commit

**`dd32e08c`** (`chore(release): v14.8.0 (#712)`, on `main`), confirmed 2026-11-08. The model was first written at `ddde6b8c` (#670), right after the fix in `7d2af1c5` (#669). The 2026-11-08 pass read #683, #690, #696, #697, #703, and #708. Only #690 (D-10) changed what the model describes. Every write now stores the offset as a number, so `YouSaveTask`, `PushStoresOffset`, and `OtherDeviceEditsTask` joined the model.

Move this commit forward only after you've read every change to covered code since it, updated the model where needed, and seen the check match. If the check is blocked, leave the commit where it is and say so. Record a commit on `main`, because a squash merge drops branch commits.

## Bounds and what's left out

- **One task, one web device, plus "another device."** Time has three values: before the reminder time, the hour after it, and later. A due date or offset only moves later, and the device's default reminder never changes.
- **The checker's read, show, and mark are one step.** The code awaits the settings read, the service worker, and `showNotification` in between. A snooze or completion in that gap still shows that reminder. Since #690, a write that stores a legacy null offset in that gap, from `updateTask` or `settleRowOffset`, makes `isSameReminder` skip the mark, so the reminder shows again a minute later. A replay on 2026-11-08 showed this against the real code; the model can't see it.
- **The offset's value isn't modeled.** A pull that changes only `notify_before` keeps the sent flag on purpose: a server `0` can still be an old null, and D-10 left the pull unchanged (`tasks/spec-notify-before.md` section 3). `OtherDeviceEditsTask` assumes the server's offset fires at the same time as this device's.
- **The checker runs every minute while the app is open.** Since #697, `checkSweepReminder` reads `localStorage` before the task loop. If that read throws, no task reminder shows that minute.
- **Not modeled:** the per-task reminder switch, the Settings switch, quiet hours (folded into the fire time), completion, Saved, archive, Trash, two open tabs showing the same reminder, and the weekly sweep reminder.

## Out of scope: iOS and Android

These follow-ups belong to their own repos' sessions, and this skill doesn't check them. iOS (`ReminderMath.swift:51`) and Android (`ReminderPlanner.kt:52-54`) still fire a snooze that ends before the reminder time and mark it sent. Neither has been checked for the pull that moves a due date.

## Related skills

- `/statechart` (pstack): read every result of the check.
- `/maintain-formal-verification-skill` (pstack): bring this model back in line after changes that skipped this skill.
