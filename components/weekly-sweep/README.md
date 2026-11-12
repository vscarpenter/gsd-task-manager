# Weekly sweep

## Overview

This directory has the weekly sweep flow.
The page walks one card at a time through the tasks that `sweepCards` from `@/lib/weekly-sweep` returns.
The directory also has the card and its inline panels, a session hook, and two links into the sweep.
The action wrappers reuse the matrix and Saved code paths. See [matrix-simplified](../matrix-simplified/README.md) and [saved](../saved/README.md).

## Interface

- `SweepPage` (`sweep-page.tsx`, default export): page inside `AppShell title="Weekly sweep"`. It shows the position, the current `SweepCard`, the end screen, and a Done button.
- `SweepCard` (`sweep-card.tsx`): component with props `{ task; reason: SweepReason; handlers: SweepCardHandlers }`. It renders the title, a reason line, action buttons, and an inline date, move, or return panel.
- `SweepCardHandlers` (`sweep-card.tsx`): interface `{ onComplete; onMarkUrgent; onSave; onDelete; onSkip; onSetDay(day); onMove(quadrant); onReturn(quadrant, dueDate?): Promise<boolean> }`.
- `SweepEntry` (`sweep-entry.tsx`): props `{ tasks: TaskRecord[] }`. It renders a "Weekly sweep" link to `ROUTES.SWEEP` when `entryShown(...)` is true, and `null` otherwise.
- `SweepLink` (`sweep-link.tsx`): takes no props. It always renders a "Start weekly sweep" link to `ROUTES.SWEEP`.
- `SweepReturnForm` (`sweep-return-form.tsx`): props `{ task; onReturn(quadrant, dueDate?): Promise<boolean>; onCancel }`. It renders `SavedItemEditor`, driven by `useSavedItem`, in `"return"` mode.
- `useSweepSession` (`use-sweep-session.ts`): `(all: TaskRecord[], isLoading: boolean, clock: SweepClock) => SweepSession`. It holds a fixed card list with a cursor.
- `SweepClock` (`use-sweep-session.ts`): interface `{ now: Date; zone: string; windowDays: number | null }`. `windowDays` is `null` when escalation is Off.
- `SweepSession` (`use-sweep-session.ts`): interface `{ status: "loading" | "card" | "end"; card; position; total; advance(); done() }`.
- `SweepReason` (`sweep-actions.ts`): type alias for `SweepCard["reason"]` from `@/lib/weekly-sweep`.
- `SweepActionId` (`sweep-actions.ts`): type `"complete" | "new-date" | "mark-urgent" | "save" | "delete" | "return" | "move" | "skip"`.
- `OfferUndo` (`sweep-actions.ts`): type `(message: string, undo: () => Promise<void>) => void`.
- `actionsFor` (`sweep-actions.ts`): `(reason, task) => SweepActionId[]`. It returns the action list for a reason from `ACTIONS` and drops `"mark-urgent"` when `task.urgent`.
- `completeTask` (`sweep-actions.ts`): `(task, offerUndo) => Promise<boolean>`. Returns `handleToggle(task, true, offerUndo)`.
- `markUrgent` (`sweep-actions.ts`): `(task, offerUndo) => Promise<boolean>`. Returns `handleMarkUrgent(task, offerUndo)`.
- `saveForLater` (`sweep-actions.ts`): `(task, offerUndo) => Promise<boolean>`. Returns `handleSaveForLater(task, offerUndo)`.
- `moveToQuadrant` (`sweep-actions.ts`): `(task, target: QuadrantId, offerUndo) => Promise<boolean>`. Returns `handleMoveTo(task, target, offerUndo)`.
- `setDueDay` (`sweep-actions.ts`): `(task, day: string) => Promise<boolean>`. It updates `dueDate` to `onDate(task.dueDate, day)` and shows "Task updated".
- `removeTask` (`sweep-actions.ts`): `(task, offerUndo) => Promise<boolean>`. It deletes the task and offers an undo that restores it.
- `returnToMatrix` (`sweep-actions.ts`): `(task, quadrant, dueDate?) => Promise<boolean>`. Returns `returnItem` from `@/components/saved/use-saved-actions`.

## Invariants

- `sweep-actions.ts:ACTIONS`: holds a fixed action order for each reason: `overdue`, `escalating`, `stale`, `saved`, and `undated-schedule`. A comment states that the sweep adds no action of its own.
- `sweep-actions.ts:actionsFor`: filters out `"mark-urgent"` when `task.urgent` is true.
- `sweep-actions.ts:setDueDay`, `removeTask`: each catches errors, sends them to `reportTaskMutationError`, and resolves `false`. Neither throws.
- `sweep-actions.ts:setDueDay`: keeps any time of day already set, through `onDate`. It offers no Undo.
- `sweep-page.tsx:useSweepHandlers`: returns `null` when there is no task. `run` calls `session.advance()` only when the action resolves `true`.
- `sweep-page.tsx:SweepPage`: fixes the clock (`now`, `zone`, `windowDays`) once in a `useState` initializer when the sweep opens.
- `sweep-page.tsx:SweepPage`: gives the session `stored`, not `all`. A comment states that `useTasks` keeps Saved out of `all`.
- `sweep-page.tsx:EndScreen`: the "Pick today's top three" link shows only when `nextRank(all, now, zone) !== null`.
- `sweep-card.tsx:runAction`: actions `"new-date"`, `"move"`, and `"return"` open a panel (`PANEL_OF`). They do not run a handler.
- `sweep-card.tsx:QuadrantChoices`: excludes the task's current quadrant from the move choices.
- `sweep-card.tsx:DateChoices`: excludes the `"none"` preset. "Set date" is disabled while the custom date is empty.
- `sweep-card.tsx:SweepCard`: the `"new-date"` label reads "Add date" when the reason is `undated-schedule`.
- `sweep-card.tsx:PanelArea`: an Escape keydown inside the panel calls `onClose`.
- `sweep-entry.tsx:SweepEntry`: returns `null` unless `entryShown(readLastSwept(), cardCount, now, zone)` is true. A comment states that it shows no count.
- `sweep-return-form.tsx:SweepReturnForm`: `onCancel` fires only after the mode was `"return"` and then left it. Outside `"return"` mode the form renders `null`.
- `sweep-return-form.tsx:SweepReturnForm`: passes stub `onNotes: async () => false` and `onDelete: async () => {}` to `useSavedItem`.
- `use-sweep-session.ts:useSweepSession`: computes cards once, on the first render with `isLoading` false. A comment states that later syncs do not reorder them.
- `use-sweep-session.ts:findPlayable`: skips a card whose task is missing from `all`, or whose task no longer yields a card from `sweepCards([task], ...)`.
- `use-sweep-session.ts:useSweepSession`: `stampLastSwept` runs only when `cards.length > 0` (effect) or `total > 0` (`done`). An empty sweep stamps nothing.
- `use-sweep-session.ts:SweepSession.advance`: a comment states that advance writes nothing. It sets the cursor to the current card index plus 1.
- `use-sweep-session.ts:describe`: status is `"loading"` while cards are `null`, and `"end"` when finished or no playable card remains. Position reads `"<index+1> of <total>"`.

## Side Effects

- `sweep-actions.ts:completeTask`, `markUrgent`, `saveForLater`, `moveToQuadrant`: call `handleToggle`, `handleMarkUrgent`, `handleSaveForLater`, and `handleMoveTo` from `@/components/matrix-simplified/task-actions`.
- `sweep-actions.ts:setDueDay`: calls `updateTask(task.id, { dueDate })` from `@/lib/tasks`, then `toast.success("Task updated", { duration: TOAST_DURATION.SHORT })`.
- `sweep-actions.ts:setDueDay`: on error calls `reportTaskMutationError(error, ErrorActions.UPDATE_TASK, "Couldn't change the due date", task.id)`.
- `sweep-actions.ts:removeTask`: calls `deleteTask(task.id)` from `@/lib/tasks`, then `offerUndo("Task deleted. It's in Trash.", () => restoreTask(task))`.
- `sweep-actions.ts:removeTask`: on error calls `reportTaskMutationError(error, ErrorActions.DELETE_TASK, "Couldn't delete the task", task.id)`.
- `sweep-actions.ts:returnToMatrix`: calls `returnItem` from `@/components/saved/use-saved-actions`.
- `use-sweep-session.ts:useSweepSession`: calls `stampLastSwept(new Date())` from `@/lib/preferences/weekly-sweep` in an effect at the end, and in `done`.
- `sweep-entry.tsx:SweepEntry`: calls `readLastSwept()` from `@/lib/preferences/weekly-sweep`. It subscribes through `subscribeEscalationWindow` and `readEscalationWindow` from `@/lib/preferences/escalation-window`.
- `sweep-page.tsx:SweepPage`: calls `readEscalationWindow()` once and reads tasks with `useTasks()`. It uses `handleSuccess` from `useErrorHandlerWithUndo()` as the undo offer.
- `sweep-page.tsx:SweepPage`: the Done button calls `session.done()`, then `router.push(ROUTES.HOME)`.
- `sweep-page.tsx:EndScreen`: renders `next/link` to `{ pathname: ROUTES.HOME, query: { pickToday: "1" } }` and to `ROUTES.HOME`. Both call `session.done` on click.
- `sweep-page.tsx:EndScreen`: focuses the "That's the sweep." heading on mount.
- `sweep-card.tsx:SweepCard`: focuses the card title when `task.id` changes. `closePanel` refocuses the button that opened the panel.
- `sweep-card.tsx:PanelArea`: focuses the first `button, input` in the panel on mount.
- `sweep-return-form.tsx:SweepReturnForm`: a mount effect calls `open("return")`. A later effect calls `onCancel` when the mode leaves `"return"`.
- `sweep-entry.tsx:SweepEntry`, `sweep-link.tsx:SweepLink`: render a `next/link` to `ROUTES.SWEEP`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
