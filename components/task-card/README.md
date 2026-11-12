# Task card

## Overview

This directory has the sortable `TaskCard` article and its header, metadata, and actions rows.
It also has a due chip, a touch swipe wrapper with its gesture hook, an escalation hook, and dnd-kit type aliases.
No Dexie, network, storage, router, or toast call appears here. Mutations go through callback props, except `TodayMenuItem`, which calls `add` and `remove` on the `useTodayMenu()` context.

## Interface

- `TaskCard` (`index.tsx`): takes `TaskCardProps` from `@/lib/task-card-memo`. It renders a sortable `<article data-testid="task-card">` with a quadrant spine, `TaskCardHeader`, `TaskCardMetadata`, and `TaskCardActions`.
- `SwipeableTaskCard` (`swipeable-task-card.tsx`): takes `TaskCardProps`. It wraps `TaskCard` in `SwipeActionRow` with a leading Complete or Uncomplete action and a trailing Delete. It adds Snooze when `onSnooze` exists.
- `SwipeActionRow` (`swipe-action-row.tsx`): props `{ rowId, leading: SwipeAction, trailing: SwipeAction[], children }`. It wraps children in a swipe surface with leading and trailing action button strips.
- `SwipeAction` (`swipe-action-row.tsx`): interface `{ label; ariaLabel?; icon: LucideIcon; ground: string; testId; onAction: () => void }`.
- `TaskCardHeader` (`task-card-header.tsx`): renders the drag grip, the title (an inspect button when `onInspect` exists), the description through `TaskDescription`, and the `complete-task` toggle button.
- `TaskCardHeaderProps` (`task-card-header.tsx`): interface `{ task, accentVar, onToggleComplete, onInspect?, sortableAttributes, sortableListeners }`.
- `TaskCardMetadata` (`task-card-metadata.tsx`): renders tag pills, a subtask progress bar with a count, blocked and blocking chips, and a compact `TaskTimer`.
- `TaskCardMetadataProps` (`task-card-metadata.tsx`): interface with the task, `accentVar`, subtask counts, `isBlocked`, `isBlocking`, `blockingTasks`, `blockedTasks`, and optional `onStartTimer` and `onStopTimer`.
- `TaskCardActions` (`task-card-actions.tsx`): footer row with `DueChip`, a recurrence icon, an escalating tag, and a snoozed chip. It also has desktop hover buttons, a mobile edit button, and an overflow dropdown menu.
- `TaskCardActionsProps` (`task-card-actions.tsx`): interface with the task, due flags, `onEdit`, `onDelete`, and optional `onShare`, `onDuplicate`, `onSave`, `onSnooze`, `onClearSnooze`, `onMoveTo`, and `onMarkUrgent`.
- `DueChip` (`due-chip.tsx`): renders an overdue chip (`data-testid="task-card-overdue-chip"`), a "Due today" chip, a relative due date, or `null` when the task has no `dueDate`.
- `DueChipProps` (`due-chip.tsx`): interface `{ task: TaskRecord; taskIsOverdue: boolean; taskIsDueToday: boolean; overdueDays: number }`.
- `dueChipProps` (`due-chip.tsx`): `(task: TaskRecord) => Omit<DueChipProps, "task">`. It derives the flags with `isOverdue`, `isDueToday`, and `daysOverdue` from `@/lib/utils`.
- `useEscalation` (`use-escalation.ts`): `(task: EscalationTask) => EscalationResult`. It calls `evaluateEscalation` with `new Date()`, the stored escalation window, and the resolved time zone.
- `useSwipeGesture` (`use-swipe-gesture.ts`): `(rowId: string, onCommitLeading: () => void) => SwipeGesture`. It holds swipe offset state for a row and a module-level open-row store.
- `SwipeGesture` (`use-swipe-gesture.ts`): interface `{ shown: number; dragging: boolean; close: () => void; surfaceProps: SwipeSurfaceProps }`.
- `SwipeSurfaceProps` (`use-swipe-gesture.ts`): interface of the handlers `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`, and `onClickCapture`.
- `SortableAttributes` (`types.ts`): type alias for `DraggableAttributes` from `@dnd-kit/core`.
- `SortableListeners` (`types.ts`): type alias `SyntheticListenerMap | undefined`.

## Invariants

- `use-swipe-gesture.ts:pointerDown`: only a primary touch pointer starts a swipe. It returns unless `event.pointerType === "touch"` and `event.isPrimary`.
- `use-swipe-gesture.ts:pointerMove`, `pointerEnd`, `pointerAbort`: ignore events whose `pointerId` differs from the active drag's.
- `use-swipe-gesture.ts:pointerMove`: drops a drag that `trackSwipe` reports as `"vertical"`. `"undecided"` moves nothing.
- `use-swipe-gesture.ts:useSwipeGesture`: one row is open across the board (module-level `openRowId`). `shown` is `offset` only when dragging or `openId === rowId`, and 0 otherwise.
- `use-swipe-gesture.ts:useSwipeGesture` (`settle`): `"commit-leading"` closes the row, then calls `onCommitLeading`. `"open-leading"` sets the offset to `LEADING_REVEAL`. Other open outcomes set `-TRAILING_REVEAL`.
- `use-swipe-gesture.ts:pointerAbort`: a pointer cancel restores the offset to `drag.base` and commits nothing.
- `use-swipe-gesture.ts:captureLost`: a lost pointer capture aborts only when `event.target === event.currentTarget`.
- `use-swipe-gesture.ts:clickCapture`: while `shown !== 0`, a click on the surface closes the row. The handler calls `preventDefault` and `stopPropagation`.
- `use-swipe-gesture.ts:capturePointer`: rethrows `setPointerCapture` errors unless the error is a `DOMException` named `"NotFoundError"`.
- `swipe-action-row.tsx:SwipeActionRow` (`act`): swipe action buttons call `close()` before `action.onAction()`.
- `swipe-action-row.tsx:SwipeActionRow`: applies `overflow-hidden` to the swipe wrapper only while `shown !== 0`.
- `swipe-action-row.tsx:TrailingStrip`: the strip width is `TRAILING_REVEAL`. Each trailing button width is `SWIPE_CONFIG.BUTTON_WIDTH`.
- `swipeable-task-card.tsx:SwipeableTaskCard`: swipe snooze passes `SWIPE_CONFIG.SNOOZE_MINUTES`. Snooze sits ahead of Delete and exists only when `onSnooze` does.
- `due-chip.tsx:dueChipProps`, `index.tsx:TaskCard`: overdue and due-today are false for completed tasks. `overdueDays` is 0 unless overdue.
- `due-chip.tsx:isWithinDay`: a future due date gets `text-status-overdue-ink` when `diff > 0 && diff < TIME_MS.DAY`.
- `due-chip.tsx:formatOverdueDate`: the overdue label adds the year only when the due year differs from the current year.
- `task-card-header.tsx:handleToggleComplete`: returns early when `isTogglingComplete` or `isRepeatClick(event)`. The button is `disabled` while toggling.
- `task-card-header.tsx:TaskCardHeader` (`justCompleted`): `animate-check-pop` applies only when `task.completed && locallyCompletedTaskId === task.id`.
- `task-card-header.tsx:TaskCardHeader`: the `h3` title gets `truncate` only when `onInspect` is absent.
- `task-card-actions.tsx:DesktopTaskAction`: desktop action buttons ignore repeat clicks through `isRepeatClick(event)`.
- `task-card-actions.tsx:TaskCardActions` (`markUrgent`): the mark-urgent control requires `escalation.escalating`, `onMarkUrgent`, and a truthy `escalation.target`.
- `task-card-actions.tsx:DesktopActions`, `CardMenu`: Move to Saved, Move to, and Snooze render only when their handler exists and `!task.completed`.
- `task-card-actions.tsx:TodayMenuItem`: returns `null` when `useTodayMenu()` is falsy or the task is completed. "Add to today" is `disabled` when `today.isFull`.
- `task-card-actions.tsx:MoveToSubmenu`: disables the item whose `quadrant.id` equals the task's current quadrant.
- `task-card-actions.tsx:SnoozeSubmenu`, `SnoozedChip`: "Clear snooze" renders only when `onClearSnooze` exists and `isTaskSnoozed(task)`. The snoozed chip renders only when `isTaskSnoozed(task)`.
- `task-card-actions.tsx:EscalatingTag`: returns `null` unless `escalating`, `daysUntilDue !== null`, and `target`. The ink is `QUADRANT_INK.q1` for `"urgent-important"` and `q3` otherwise.
- `task-card-actions.tsx:TaskCardActions`: the recurrence icon renders only when `task.recurrence !== "none"`.
- `task-card-metadata.tsx:TaskCardMetadata`: dependency chips render only when `(isBlocked || isBlocking) && !task.completed`.
- `task-card-metadata.tsx:TaskCardMetadata`: `TaskTimer` renders only with both timer handlers and `!task.completed`. It also needs `estimatedMinutes`, `timeSpent`, or a time entry with no `endedAt`.
- `task-card-metadata.tsx:TaskCardMetadata`: the subtask bar renders only when `totalSubtasks > 0`. The fill is `scaleX(completedSubtasks / totalSubtasks)`.
- `use-escalation.ts:useEscalation`: the server snapshot for the escalation window is `DEFAULT_ESCALATION_WINDOW_DAYS`. The server snapshot for the local day is `""`.
- `use-escalation.ts:subscribeLocalDay`: the midnight timer delay is the time to the next local midnight plus `RESYNC_AFTER_MIDNIGHT_MS` (1000).
- `index.tsx:TaskCard`: the article is `tabIndex={-1}`. Hover and focus-within styles apply only when `!task.completed`. Dragging sets opacity 0.5.

## Side Effects

- `use-escalation.ts:subscribeLocalDay`: adds a document `"visibilitychange"` listener and a window `"focus"` listener. Unsubscribe removes both.
- `use-escalation.ts:subscribeLocalDay`: sets a `setTimeout` to the next local midnight that re-arms itself. Unsubscribe clears it.
- `use-escalation.ts:useEscalation`: subscribes through `useSyncExternalStore` to `subscribeEscalationWindow` and `readEscalationWindow` from `@/lib/preferences/escalation-window`.
- `task-card-header.tsx:TaskCardHeader`: an effect sets a 300 ms `window.setTimeout` that clears `locallyCompletedTaskId`. Cleanup clears the timer.
- `task-card-header.tsx:TaskCardHeader`: calls `event.currentTarget.focus()` on the `view-task-details` button before `onInspect(task)`.
- `use-swipe-gesture.ts:capturePointer`: calls `target.setPointerCapture(event.pointerId)` when a drag turns horizontal.
- `use-swipe-gesture.ts:setOpenRowId`: mutates the module-level `openRowId` and notifies the module `listeners` set.
- `use-swipe-gesture.ts:clickCapture`: calls `event.preventDefault()` and `event.stopPropagation()` on captured clicks while a row is open.
- `use-swipe-gesture.ts:pointerDown`, `pointerMove`, `pointerEnd`: call `beginSwipe`, `trackSwipe`, and `endSwipe` from `@/lib/swipe-gesture`.
- `index.tsx:TaskCard`: calls `useSortable({ id: task.id, data: { title: task.title } })` from `@dnd-kit/sortable`. It registers the node through `setNodeRef` and the `taskRef` prop.
- `task-card-actions.tsx:TodayMenuItem`: calls `today.add(task)` or `today.remove(task)` on the object from `useTodayMenu` (see [today-strip](../today-strip/README.md)).
- `task-card-actions.tsx`, `task-card-header.tsx`, `swipeable-task-card.tsx`: invoke the caller's callbacks only (`onToggleComplete`, `onEdit`, `onDelete`, `onShare`, `onDuplicate`, `onSave`, `onSnooze`, `onClearSnooze`, `onMoveTo`, `onMarkUrgent`, `onInspect`).

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
