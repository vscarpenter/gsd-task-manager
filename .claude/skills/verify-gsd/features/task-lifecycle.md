# Task lifecycle

Once a task exists, a user can edit it in the drawer, complete it, set it to recur, move it to another quadrant and undo the move, or delete it and bring it back from Trash.

## Sub-features

- `task-edit` changes the title, description, and quadrant, and keeps them across a reload.
- `task-complete` hides the card and stamps `completedAt`.
- `task-recurring-complete` replaces a completed daily task with its next instance.
- `task-move-undo` moves a card from the card menu, then reverses the move from the toast.
- `task-delete-restore` moves a task to Trash and restores it from Settings.

## How to get to it (user POV)

- Hover a card on the matrix to reveal its actions: edit, complete, delete, and `More actions`.
- Choose `More actions`, then `Move to`, for the quadrant menu.
- Open Settings, then Trash, to restore a deleted task.

## Driving it with gsd-verify

Preconditions:

- `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`, run from the repository root.
- `gsd-verify up` printed `Ready`, and `gsd-verify doctor` exits 0.
- Each test creates its own task through the capture bar. No seed is needed.

- **Edit.** Open the drawer on `Original title`, change the title and description, choose `edit-quadrant-q1`, and save. Run `gsd-verify drive task-lifecycle -g task-edit`. The card sits in `quadrant-q1` with the new text, before and after a reload, and the row has `urgent: true, important: true`.
- **Complete.** Choose `complete-task` on a card. Run `gsd-verify drive task-lifecycle -g task-complete`. The card is hidden, and the row has `completed: true` and a `completedAt` value.
- **Recurring.** Choose `edit-recurrence-daily` in the drawer, save, then complete the card. Run `gsd-verify drive task-lifecycle -g task-recurring-complete`. One card with that title remains under a new `data-task-id`, and the store holds one completed row and one open row.
- **Move and undo.** Choose `More actions`, `Move to`, then `Do First`, and then `Undo` on the toast. Run `gsd-verify drive task-lifecycle -g task-move-undo`. The card goes to `quadrant-q1` and back to `quadrant-q2`, and the row ends as `not-urgent-important`.
- **Delete and restore.** Delete a card, open `/settings#trash`, choose `Restore Old errand`, and return to the matrix. Run `gsd-verify drive task-lifecycle -g task-delete-restore`. The row leaves `tasks` for `deletedTasks`, then returns, and the card is back on the matrix.
- **Proof.** Run `gsd-verify drive task-lifecycle`. The `task-delete-restore/` folder in the printed evidence folder holds the rows from both stores at each step, plus `trash.png` and `restored.png`.

## Gotchas

- `MatrixPage.completeTask` waits for the title to disappear, so it times out on a recurring task. Choose `complete-task` directly and assert the new `data-task-id`.
- The drawer focuses its title about 100 milliseconds after it opens, which can steal keystrokes. `MatrixPage.openEditDrawer` waits for that focus.
- A pointer jump onto a Radix submenu item races its positioning. Use the keyboard path, as the journey does.
- The header comment in `tests/e2e/recurring-tasks.spec.ts` says the drawer has no recurrence field. It has one now, so this journey sets recurrence through the real control rather than seeding it.
- A delete writes to `deletedTasks`, not to `archivedTasks`. Archiving is a separate flow (ADR 0013, ADR 0015) that this map doesn't cover yet.
