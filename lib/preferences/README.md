# Preferences

## Overview

This package reads and writes per-device preferences in `localStorage`. It covers the escalation window, the icon rail, the show-completed toggle, and weekly sweep state.

## Interface

- `escalation-window.ts:ESCALATION_WINDOW_KEY`. Storage key `"gsd:escalation-window"`.
- `escalation-window.ts:ESCALATION_WINDOW_EVENT`. Window event name `"gsd:escalation-window-changed"`.
- `escalation-window.ts:DEFAULT_ESCALATION_WINDOW_DAYS`. The default, 2.
- `escalation-window.ts:ESCALATION_WINDOW_OPTIONS`. The values offered in Settings: `null`, 1, 2, 3, 7. `null` is Off.
- `escalation-window.ts:EscalationWindow`. Union type of those options.
- `escalation-window.ts:readEscalationWindow(): EscalationWindow`. Reads the stored window.
- `escalation-window.ts:writeEscalationWindow(days: EscalationWindow): void`. Stores the window and fires the change event.
- `escalation-window.ts:subscribeEscalationWindow(onChange): () => void`. Subscribes for `useSyncExternalStore` and returns the unsubscribe function.
- `icon-rail.ts:RAIL_COLLAPSED_KEY`. Storage key `"gsd:icon-rail-collapsed"`.
- `icon-rail.ts:readRailCollapsed(): boolean` and `icon-rail.ts:writeRailCollapsed(collapsed: boolean): void`. Read and write the rail state.
- `show-completed.ts:SHOW_COMPLETED_KEY`. Storage key `"gsd:show-completed"`.
- `show-completed.ts:SHOW_COMPLETED_EVENT`. Event name `"toggle-completed"`.
- `show-completed.ts:ShowCompletedEventDetail`. Interface with `show: boolean`.
- `show-completed.ts:readShowCompleted(): boolean`. Reads the toggle.
- `weekly-sweep.ts:SWEEP_LAST_SWEPT_KEY`, `weekly-sweep.ts:SWEEP_REMINDER_KEY`, `weekly-sweep.ts:SWEEP_FIRED_KEY`. Storage keys `"gsd:weekly-sweep-last-swept"`, `"gsd:weekly-sweep-reminder"`, and `"gsd:weekly-sweep-reminder-fired"`.
- `weekly-sweep.ts:DEFAULT_SWEEP_REMINDER`. `{ enabled: true, weekday: 7, time: "09:00" }` (Sunday 09:00).
- `weekly-sweep.ts:readLastSwept(): Date | null` and `weekly-sweep.ts:stampLastSwept(at: Date): void`. Read and stamp the last sweep time.
- `weekly-sweep.ts:readSweepReminder(): SweepReminder` and `weekly-sweep.ts:writeSweepReminder(reminder: SweepReminder): void`. Read and write the reminder setting.
- `weekly-sweep.ts:readSweepFired(): string | null` and `weekly-sweep.ts:markSweepFired(occurrence: Date): void`. Read and mark the last notified occurrence.
- `weekly-sweep.ts:resetWeeklySweepState(): void`. Removes all three sweep keys.

## Invariants

- `escalation-window.ts:readEscalationWindow` is per-device (D-12) and outside the backup envelope. An unknown stored value falls back to the default.
- `escalation-window.ts:readEscalationWindow` returns the default when `window` is undefined.
- `escalation-window.ts:subscribeEscalationWindow` listens to two events. Same-tab writes fire the custom event, and other tabs fire `storage`.
- `weekly-sweep.ts` states that sweep values stay outside sync and outside the backup envelope, and that a reset must clear both.
- `weekly-sweep.ts:readSweepReminder` reads an unknown or unreadable value as off.
- `weekly-sweep.ts:isReminder` accepts only a boolean `enabled`, an integer `weekday` from 1 to 7, and a `time` matching `HH:MM` in 24 hour form.
- `weekly-sweep.ts:SWEEP_FIRED_KEY` records the occurrence the checker last notified for, so one occurrence fires once.

## Side Effects

- `escalation-window.ts:writeEscalationWindow` writes `localStorage` and dispatches `gsd:escalation-window-changed` on `window`.
- `escalation-window.ts:subscribeEscalationWindow` adds and removes two `window` listeners.
- `icon-rail.ts:writeRailCollapsed` writes `localStorage`.
- `weekly-sweep.ts:stampLastSwept`, `weekly-sweep.ts:writeSweepReminder`, and `weekly-sweep.ts:markSweepFired` write `localStorage`. `weekly-sweep.ts:resetWeeklySweepState` removes three keys.
- All `read*` functions read `localStorage`.

## Verification

- Run: `bun run test`
