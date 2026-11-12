# Today strip

## Overview

This directory has the Today strip that sits above the matrix.
`derive-today.ts` is a pure derivation of today's picks, carry-over, and suggestions.
`use-today.ts` refreshes that view on date rollover.
The strip component renders a sortable pick list and offers. A context gives card menus add and remove actions.

## Interface

- `TodayStrip` (`today-strip.tsx`): component that takes `TodayStripProps`. It renders the heading, a screen-reader status, `PickList`, `TidyOffer`, and the free-slot offers.
- `TodayStripProps` (`today-strip.tsx`): interface `{ tasks; aside?: ReactNode; onToggleComplete(task, completed); onInspect(task) }`.
- `useToday` (`use-today.ts`): `(all: TaskRecord[]) => TodayView & { now: Date; zone: string }`. It memoizes `deriveToday` with the escalation window and the resolved time zone.
- `deriveToday` (`derive-today.ts`): `(all, now, windowDays: number | null, zone) => TodayView`. It builds the view from `todaysPicks`, `nextRank`, `carryOver`, and `suggest` in `@/lib/top-three`.
- `TodayView` (`derive-today.ts`): interface `{ picks; needsTidy; hasFreeSlot; carry: { label: string | null; tasks }; suggestions }`.
- `addAndReport` (`add-feedback.ts`): `(id, tasks, now, zone) => Promise<boolean>`. It calls `addToToday`, shows "Today is full" on `"full"`, and resolves `true` only for `"added"`.
- `TodayMenu` (`today-menu-context.tsx`): interface `{ isPicked(task): boolean; isFull: boolean; add(task): void; remove(task): void }`.
- `TodayMenuContext` (`today-menu-context.tsx`): `createContext<TodayMenu | null>(null)`.
- `useTodayMenu` (`today-menu-context.tsx`): `() => TodayMenu | null`. It reads `TodayMenuContext`.
- `TodayMenuProvider` (`today-menu-context.tsx`): props `{ tasks: TaskRecord[]; children }`. It builds a `TodayMenu` from `useToday(tasks)` and provides it.
- `TidyOffer` (`today-offers.tsx`): props `{ onTidy; onDismiss }`. It renders "Two devices picked for today. Tidy up?" with Tidy and Not now buttons.
- `OfferList` (`today-offers.tsx`): props `{ heading: string | null; tasks; onAdd(task) }`. It lists titles, each with an "Add to today" button.
- `PickList` (`today-rows.tsx`): props `{ picks; onReorder(orderedIds); locked; onToggleComplete; onInspect; onMove; onRemove }`. It is a sortable ordered list in its own `DndContext`.

## Invariants

- `add-feedback.ts:addAndReport`: resolves `true` only when the pick was written. A refused add counts as nothing done.
- `derive-today.ts:deriveToday`: a comment states that it never writes. It computes carry-over only when `hasFreeSlot`.
- `derive-today.ts:deriveToday`: suggestions exclude carried ids and stop at `MAX_SUGGESTIONS` (3).
- `derive-today.ts:carryLabel`: one day back reads "From yesterday". `WEEK_DAYS` (7) or more reads "From a week ago". Anything else reads "From <weekday>", formatted in UTC.
- `derive-today.ts:pick`: drops ids that are missing from the task map.
- `today-menu-context.tsx:TodayMenuContext`: the default is `null`. A comment states that it is `null` outside the matrix, where the menu item is hidden.
- `today-menu-context.tsx:attempt`: shows no success toast when the run resolves `false`. Thrown errors go to `reportTaskMutationError`.
- `today-menu-context.tsx:TodayMenuProvider`: `isFull` is `!hasFreeSlot`.
- `today-offers.tsx:OfferList`: returns `null` when `tasks` is empty.
- `today-rows.tsx:PickRow`: when `locked`, the drag handle and Move buttons do not render. A comment states that Tidy comes first.
- `today-rows.tsx:MoveButtons`: up does nothing at index 0 and down does nothing at `count - 1`. Both use `aria-disabled`, not `disabled`.
- `today-rows.tsx:PickList`: `handleDragEnd` ignores a drop with no target or on itself. A pointer drag needs `POINTER_DISTANCE_PX` (4) of movement.
- `today-rows.tsx:PickList`: a comment states that its own `DndContext` keeps reordering away from the matrix's quadrant drops.
- `today-strip.tsx:TodayStrip`: `PickList` is `locked` while `today.needsTidy`. `TidyOffer` shows only when `needsTidy && !tidyDismissed`. Offers show only when `hasFreeSlot`.
- `today-strip.tsx:attempt`: resolves `false` on a thrown error or a `false` result. `useAnnouncer.done` announces only on `true`.
- `today-strip.tsx:usePickTodayRequest`: reads the `pickToday` parameter once in a `useState` initializer, then clears it. A comment states that a StrictMode second run keeps the request.
- `today-strip.tsx:clearPickTodayParam`: returns early when the parameter is absent. A comment states that it is safe to run twice.
- `today-strip.tsx:TodayStrip`: the `useSyncExternalStore` server snapshot for tidy dismissal is `false`.
- `use-today.ts:useToday`: the `useSyncExternalStore` server snapshot is `DEFAULT_ESCALATION_WINDOW_DAYS`.

## Side Effects

- `add-feedback.ts:addAndReport`: calls `addToToday(id, tasks, now, zone)` from `@/lib/tasks/top-three-actions`. On `"full"` it calls `toast.message("Today is full", { duration: 2500 })`.
- `today-menu-context.tsx:TodayMenuProvider`: `add` calls `addAndReport`. `remove` calls `removeFromToday(task.id)` from `@/lib/tasks/top-three-actions`.
- `today-menu-context.tsx:attempt`: shows `toast.success` with "Added to today" or "Removed from today". On error it calls `reportTaskMutationError` from `@/components/matrix-simplified/task-actions`.
- `today-strip.tsx:useTodayHandlers`: calls `movePick`, `removeFromToday`, `reorderPicks`, and `tidyPicks` from `@/lib/tasks/top-three-actions`, and `addAndReport`.
- `today-strip.tsx:attempt`: on error calls `reportTaskMutationError` with action `"add_to_today"`, `"move_pick"`, `"remove_from_today"`, or `"tidy_today"`.
- `today-strip.tsx:wantsPickToday`: reads `window.location.search` for the `pickToday` query parameter.
- `today-strip.tsx:clearPickTodayParam`: calls `window.history.replaceState(window.history.state, "", ...)` with `pickToday` removed. It keeps the pathname, other parameters, and hash.
- `today-strip.tsx:TodayStrip`: subscribes to `tidyDismissal.subscribe` and `tidyDismissal.isDismissed`, and calls `tidyDismissal.dismiss`, from `@/lib/top-three-session`.
- `today-strip.tsx:useAnnouncer`: calls `headingRef.current?.focus()` on the "Today" heading after a complete or remove. It also writes the `role="status"` text.
- `today-strip.tsx:TodayStrip`: calls the parent's `onToggleComplete` and `onInspect` props.
- `use-today.ts:useNow`: sets `window.setTimeout(refresh, msUntilMidnight(now))` (next local midnight plus 1000 ms) and clears it on cleanup.
- `use-today.ts:useNow`: adds a document `"visibilitychange"` listener that refreshes when `document.visibilityState === "visible"`. Cleanup removes it.
- `use-today.ts:useToday`: subscribes through `subscribeEscalationWindow` and `readEscalationWindow` from `@/lib/preferences/escalation-window`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
