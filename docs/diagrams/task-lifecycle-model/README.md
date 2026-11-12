# Task lifecycle model

`TaskLifecycle.tla` is a TLA+ model of one task on the web app, from the moment you capture it until it's gone, in the terms you see: on your board, Done, in Saved, archived, in Trash, or gone for good. The comment at the top names the files it follows, and the comment above each action names the function it models, such as `toggleCompleted`, `deleteTask`, and `restoreFromTrash`.

It draws how a task moves, for the product owner. Unlike the models under `docs/formal/`, it has no verify skill in `.claude/skills/`. It also checks two rules about repeating tasks:

- `OneOpenCopy`: your board never shows two open copies of one repeating task.
- `TrashHoldsOnlyYourDeletes`: Trash holds only tasks you deleted.

| Config | What it covers | What TLC finds |
|---|---|---|
| `TaskLifecycle.cfg` | a one-off task, every place it can go | 23 states. Both rules hold, and nothing deadlocks. |
| `TaskLifecycleRecurringBoard.cfg` | a daily task that stays on your board or in Done, with at most one next copy | 17 states. Both rules break in three steps. |
| `TaskLifecycleRecurring.cfg` | a daily task, every place it can go | 181 states. The same two breaks. Too busy to chart; use it for the statechart skill's written report. |

## What breaks, and the replay

Checking off a repeating task spawns the next copy in the same transaction (`toggleCompleted` in `lib/tasks/crud/toggle.ts`). The two ways to reverse that disagree:

1. **Unchecking leaves both copies open.** Capture a daily task, check it off, then uncheck it. `toggleCompleted(id, false)` only flips the flag, so the next copy stays, and your board shows two open copies. Check it off again and a second next copy appears, so two next copies sit on your board.
2. **Undo puts a copy in Trash that you never deleted.** Capture a daily task, check it off, then tap Undo on "Task completed". `handleToggle`'s Undo unchecks the task and removes the copy through `deleteTask`, which is the soft delete, so the copy lands in Trash. Restoring it from Trash brings back two open copies.

The comment on `handleToggle` says why Undo removes the copy: "reversing only the completion would leave an orphan on the board". Unchecking is the reversal that leaves it.

Both paths replayed against the real code on 2026-11-08 (`toggleCompleted`, `deleteTask`, and `restoreFromTrash` on fake IndexedDB, signed out). The replay is not committed. Whether either is a bug is the owner's call: the rules are proposals, and the recurring chart shows where they break.

## Run the model

Check the rules with the repo's pinned checker:

```sh
M=docs/diagrams/task-lifecycle-model
bash scripts/tlc.sh $M/TaskLifecycle.tla $M/TaskLifecycle.cfg
bash scripts/tlc.sh $M/TaskLifecycle.tla $M/TaskLifecycleRecurringBoard.cfg
```

The second run exits 12 because a rule breaks, which is the finding. `scripts/tlc.sh` stops at the first broken rule, so that run names one rule and can count fewer states than the table.

The `/pstack:statechart` skill draws the charts and writes a report with the path to each broken rule. Give it a scratch folder outside the repo:

```sh
SC=~/.claude/plugins/cache/cursor-plugins/pstack/<version>/skills/statechart/scripts/statechart
OUT=<scratch folder>
$SC $M/TaskLifecycle.tla --config $M/TaskLifecycle.cfg --view $M/view.mjs --out $OUT/lifecycle
$SC $M/TaskLifecycle.tla --config $M/TaskLifecycleRecurringBoard.cfg --view $M/view-recurring.mjs --out $OUT/recurring
```

Set `TLA2TOOLS` to the jar `scripts/tlc.sh` caches in `~/.cache/gsd-tlc/` and `JAVA` to a Java 21 binary to skip the skill's own install.

## What the chart hides

The model lets you tap Undo on "Task deleted" after you've already moved the task again inside the toast's 5 seconds. That's true but rare, so the lifecycle chart draws Undo only from Trash. It keeps one more Undo arrow, out of "Gone for good" back to your board: Undo still brings the task back if Trash is emptied in that window. Toasts expiring change no label, so no arrow shows them.

## What the model leaves out

Only the newest Undo toast is modeled. sonner stacks toasts, so an older Undo can still be tapped for its 5 seconds. The model counts next copies instead of tracking each one, so Undo removes "a" copy rather than the exact one it spawned; with the one-copy bound of the recurring chart (`TaskLifecycleRecurringBoard.cfg`), that's the same thing. Completing a next copy (which spawns the one after it) is left out, so the chain is one task deep. The Archive page's own Undo buttons, sync, other devices, edits, dependencies, and subtasks are out of scope. Sync and Trash across devices live in the models under `docs/formal/`, each with a verify skill in `.claude/skills/`.

## Directory contract

This section records the contract of the source files here: `TaskLifecycle.tla`, the three `.cfg` files, and the two view files.

### Interface

- `TaskLifecycle.tla` (module `TaskLifecycle`): constant `Recurring`. Variables `task`, `before`, `copies`, `strays`, and `toast`.
  - `Places` is `none`, `open`, `done`, `saved`, `archived`, `trash`, and `gone`.
  - `Next` joins 17 actions, including `YouCapture`, `YouComplete`, `YouUncheck`, `YouUndoComplete`, `YouDelete`, `YouUndoDelete`, `YouRestoreFromTrash`, `TrashEmpties`, `AutoArchive`, and `ToastExpires`.
  - The module defines `Spec`, but every config names `INIT Init` and `NEXT Next` instead.
- `TaskLifecycle.cfg`: `Recurring = FALSE`, `CONSTRAINT Bound`.
- `TaskLifecycleRecurring.cfg`: `Recurring = TRUE`, `CONSTRAINT Bound`.
- `TaskLifecycleRecurringBoard.cfg`: `Recurring = TRUE`, `CONSTRAINT BoardBound`.
- All three configs check `TypeOK`, `OneOpenCopy`, and `TrashHoldsOnlyYourDeletes`.
- `view.mjs` exports `title`, `state(v)`, `group(v)`, `colors`, and `step(action, from, to)`. `step` returns `null` for `ToastExpires` and `Done`.
- `view-recurring.mjs` exports the same functions from `view.mjs` again, with its own `title`.

### Invariants

- `TaskLifecycle.tla:TypeOK`: every variable keeps its declared type.
- `TaskLifecycle.tla:OneOpenCopy`: the open task plus `copies` never exceeds 1.
- `TaskLifecycle.tla:TrashHoldsOnlyYourDeletes`: `strays = 0`.
- `TaskLifecycle.tla:Bound` limits `copies` and `strays` to 2. `BoardBound` keeps `task` in `none`, `open`, or `done` and limits both counts to 1. Both are state constraints, not checked rules.
- `TaskLifecycle.tla:Snapshot` keeps `before` only while the task is in Trash or the delete toast is open.
- `TaskLifecycle.tla:Done` is an explicit stutter step at the end state. No config turns off the deadlock check.

### Side Effects

- None. The module, the configs, and the view files perform no I/O.
- This directory has no runner script. `scripts/tlc.sh` runs the model. See [scripts](../../../scripts/README.md).

### Verification

- No automated check found. Run the model by hand with `bash scripts/tlc.sh`, as "Run the model" above shows.
