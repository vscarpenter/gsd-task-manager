# Notifications

## Overview

This package shows task reminders and stores notification settings. It covers permission checks, the settings row in Dexie, reminder timing with quiet hours, notification display, and the PWA app badge.

`index.ts` is the barrel for display, permission, settings, and badge functions.

## Interface

- `display.ts:showTaskNotification(task: TaskRecord, minutesUntil: number): Promise<boolean>`. Shows a reminder for one task. Returns true only when it was shown.
- `display.ts:showSweepReminder(): Promise<boolean>`. Shows the weekly sweep reminder.
- `display.ts:showTestNotification(): Promise<boolean>`. Shows a sample notification and asks for permission first when needed.
- `permissions.ts:isNotificationSupported(): boolean`. True when `Notification` exists on `window`.
- `permissions.ts:checkNotificationPermission(): NotificationPermission`. Returns the current permission, or `"denied"` when unsupported.
- `permissions.ts:requestNotificationPermission(): Promise<boolean>`. Asks the user and records that the app asked.
- `permissions.ts:shouldAskForPermission(): Promise<boolean>`. True when permission is `"default"` and the app has not asked before.
- `permissions.ts:isInQuietHours(settings): boolean`. True when the current local time is inside the quiet window.
- `settings.ts:getNotificationSettings(): Promise<NotificationSettings>`. Reads the settings row and creates defaults when it is absent.
- `settings.ts:updateNotificationSettings(updates: Partial<NotificationSettings>): Promise<void>`. Merges, validates, and writes the settings row.
- `settings.ts:toggleNotificationSound(): Promise<void>`. Flips `soundEnabled`.
- `settings.ts:toggleQuietHours(): Promise<void>`. Turns the quiet window on or off.
- `settings.ts:setQuietHoursEdge(which: "start" | "end", value: string): Promise<void>`. Moves one edge of the quiet window.
- `badge.ts:isBadgeSupported(): boolean`. True when `navigator.setAppBadge` exists.
- `badge.ts:setAppBadge(count: number): Promise<void>`. Sets the badge, or clears it when the count is zero or less.
- `badge.ts:clearAppBadge(): Promise<void>`. Clears the badge.
- `default-reminder.ts:readDefaultReminder(): Promise<number>`. Returns this device's default reminder offset in minutes.
- `use-default-reminder.ts:useDefaultReminder(): number`. Live React hook for the same value.
- `reminder-window.ts:reminderWindow(dueIso, notifyBeforeMinutes, quiet?): ReminderWindow`. Returns when a reminder fires and when it expires.
- `reminder-window.ts:isReminderDue(args): boolean`. True when a reminder should show now.
- `reminder-window.ts:reminderFireAt(args): Date | null`. Returns when a reminder will fire, or `null` when it will not.
- `reminder-window.ts:QuietHours`, `reminder-window.ts:ReminderWindow`. Interfaces for `{ start, end }` and `{ fire, expires }`.
- `index.ts`. Re-exports from `display`, `permissions`, `settings`, and `badge`. It does not re-export `default-reminder`, `use-default-reminder`, or `reminder-window`.

## Invariants

- `default-reminder.ts:readDefaultReminder` is read-only. Unlike `getNotificationSettings`, it never writes the settings row, so any write path may call it.
- `settings.ts:getNotificationSettings` self-heals. A missing or corrupt row is replaced with defaults.
- `settings.ts:updateNotificationSettings` always writes `id: "settings"` and throws when the merged value fails `notificationSettingsSchema`.
- `settings.ts:toggleQuietHours` has no separate on flag. On means both edges are set. Turning on seeds 22:00 to 07:00, and turning off clears both edges.
- `settings.ts:DEFAULT_QUIET_HOURS` applies only when quiet hours turn on. A stored window is never rewritten.
- `settings.ts:setQuietHoursEdge` ignores an empty value.
- `display.ts:showTaskNotification` returns true only when the notification was shown. A skipped or failed reminder is never marked sent.
- `display.ts:shouldShowTaskNotification` skips a task when settings are off, when `notificationEnabled` is `false`, or while the task is snoozed.
- `display.ts:createNotificationOptions` sets `tag` to `task-{id}` and `renotify: true`. A snoozed reminder shares the tag and must not replace one silently.
- `display.ts:getNotificationTitle` counts calendar days for an all-day task instead of hours to midnight.
- `display.ts:showSweepReminder` uses fixed text with no count, task title, or task content.
- `reminder-window.ts:reminderWindow` fires a timed task at its due time minus the offset. It expires an hour past the later of the due time and the fire time.
- `reminder-window.ts:reminderWindow` fires an all-day task at 09:00 local on its due day, one day earlier per whole day of offset.
- `reminder-window.ts:deferPastQuietHours` treats quiet hours as a half-open window that may cross midnight. A fire inside the window waits for its end.
- `reminder-window.ts:isReminderDue` holds a reminder during a future snooze. An ended snooze asks for the reminder again for an hour.
- `reminder-window.ts:reminderFireAt` is pinned by the shared due-time corpus for all three clients.
- `permissions.ts:isInQuietHours` returns false unless both edges are set.

## Side Effects

- `settings.ts:getNotificationSettings` reads the Dexie `notificationSettings` table and may write the `"settings"` row.
- `settings.ts:updateNotificationSettings` writes the `notificationSettings` table.
- `default-reminder.ts:readDefaultReminder` and `use-default-reminder.ts:useDefaultReminder` read `notificationSettings`. The hook uses `useLiveQuery`.
- `permissions.ts:requestNotificationPermission` calls `Notification.requestPermission()` and writes `permissionAsked: true`.
- `display.ts:displayNotification` calls `registration.showNotification` on the ready service worker. It falls back to `new Notification(...)`.
- `display.ts:displayFallbackNotification` sets an `onclick` handler that focuses the window, and a `setTimeout` that closes the notification.
- `display.ts:showTestNotification` creates a `Notification` and closes it with a `setTimeout`.
- `badge.ts:setAppBadge` and `badge.ts:clearAppBadge` call `navigator.setAppBadge` and `navigator.clearAppBadge`.
- `display.ts`, `permissions.ts`, `badge.ts`, and `settings.ts` log through `createLogger`.
- `reminder-window.ts`: None.

## Verification

- Run: `bun run test`
