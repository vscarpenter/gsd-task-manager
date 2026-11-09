# Task lifecycle model

`TaskLifecycle.tla` is a TLA+ model of one task on the web app, from the moment you capture it until it's gone, in the terms you see: on your board, Done, in Saved, archived, in Trash, or gone for good. The comment at the top names the files it follows, and the comment above each action names the function it models, such as `toggleCompleted`, `deleteTask`, and `restoreFromTrash`.

It draws how a task moves for the product owner, so it has no verify skill of its own. It also checks two rules about repeating tasks:

- `OneOpenCopy`: your board never shows two open copies of one repeating task.
- `TrashHoldsOnlyYourDeletes`: Trash holds only tasks you deleted.

| Config | What it covers | What TLC finds |
|---|---|---|
| `TaskLifecycle.cfg` | a one-off task, every place it can go | 23 states. Both rules hold, and nothing deadlocks. |
| `TaskLifecycleRecurringBoard.cfg` | a daily task that stays on your board or in Done, with at most one next copy | 17 states. Both rules break in three steps. |
| `TaskLifecycleRecurring.cfg` | a daily task, every place it can go | 181 states. The same two breaks. Too busy to chart; use it for the report. |

## What breaks, and the replay

Checking off a repeating task spawns the next copy in the same transaction (`toggleCompleted` in `lib/tasks/crud/toggle.ts`). The two ways to reverse that disagree:

1. **Unchecking leaves both copies open.** Capture a daily task, check it off, then uncheck it. `toggleCompleted(id, false)` only flips the flag, so the next copy stays, and your board shows two open copies. Check it off again and a second next copy appears, so two next copies sit on your board.
2. **Undo puts a copy in Trash that you never deleted.** Capture a daily task, check it off, then tap Undo on "Task completed". `handleToggle`'s Undo unchecks the task and removes the copy through `deleteTask`, which is the soft delete, so the copy lands in Trash. Restoring it from Trash brings back two open copies.

The comment on `handleToggle` says why Undo removes the copy: "reversing only the completion would leave an orphan on the board". Unchecking is the reversal that leaves it.

Both paths replayed against the real code on 2026-11-08 (`toggleCompleted`, `deleteTask`, and `restoreFromTrash` on fake IndexedDB, signed out). The replay is not committed. Whether either is a bug is the owner's call: the rules are proposals, and the chart shows where they break.

## Run the model

Check the rules with the repo's pinned checker:

```sh
M=docs/diagrams/task-lifecycle-model
bash scripts/tlc.sh $M/TaskLifecycle.tla $M/TaskLifecycle.cfg
bash scripts/tlc.sh $M/TaskLifecycle.tla $M/TaskLifecycleRecurringBoard.cfg
```

The second run exits 12 because a rule breaks, which is the finding.

The `/pstack:statechart` skill draws the charts and writes a report with each bug path. Give it a scratch folder outside the repo:

```sh
SC=~/.claude/plugins/cache/cursor-plugins/pstack/<version>/skills/statechart/scripts/statechart
OUT=<scratch folder>
$SC $M/TaskLifecycle.tla --config $M/TaskLifecycle.cfg --view $M/view.mjs --out $OUT/lifecycle
$SC $M/TaskLifecycle.tla --config $M/TaskLifecycleRecurringBoard.cfg --view $M/view-recurring.mjs --out $OUT/recurring
```

Set `TLA2TOOLS` to the jar `scripts/tlc.sh` caches in `~/.cache/gsd-tlc/` and `JAVA` to a Java 21 binary to skip the skill's own install.

## What the chart hides

The lifecycle chart hides Undo on "Task deleted" when you've already moved the task again inside the toast's 5 seconds, except one arrow out of "Gone for good": Undo still brings the task back if Trash empties in that window. Toasts expiring change no label, so no arrow shows them.

## What the model leaves out

Only the newest Undo toast is modeled. sonner stacks toasts, so an older Undo can still be tapped for its 5 seconds. The model counts next copies instead of tracking each one, so Undo removes "a" copy rather than the exact one it spawned; with the one-copy bound of the board chart, that's the same thing. Completing a next copy (which spawns the one after it) is left out, so the chain is one task deep. The Archive page's own Undo buttons, sync, other devices, edits, dependencies, and subtasks are out of scope. Sync and Trash across devices live in the verify skills under `docs/formal/`.
