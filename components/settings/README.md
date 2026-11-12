# Settings

## Overview

This directory has the section components that the settings page renders.
They cover About, Appearance, Archive, Bookmarklet, Data management, Features, Feedback, Notifications, the weekly sweep reminder, Sync, Trash, and What's new.
It also has the shared row primitives and the feedback form hook.
Most sections are thin wrappers over `@/lib` functions. The page shell lives in [settings-page](../settings-page/README.md).

## Interface

- `AboutSection` (`about-section.tsx`): takes no props. It renders Version and Build rows, a privacy note, a replay-tour button, and external Privacy Policy and GitHub links.
- `AppearanceSettings` (`appearance-settings.tsx`): props `{ showCompleted: boolean, onToggleCompleted: () => void }`. It renders the Light, Dark, and Auto theme buttons, a show-completed `Switch`, and an escalation-window select.
- `ArchiveSettings` (`archive-settings.tsx`): props `{ onViewArchive: () => void }`. It renders the auto-archive toggle, an archive-after select, an archive-now action, and a view-archive link.
- `BookmarkletSettings` (`bookmarklet-settings.tsx`): takes no props. It holds local `tags` state and renders a default-tags input, a draggable bookmarklet link, and a copy-code button.
- `DataManagement` (`data-management.tsx`): props `{ activeTasks, savedTasks?, completedTasks, archivedTasks, trashedTasks?, totalTasks, estimatedSize, onExport: () => Promise<boolean>, onImportClick, isLoading?, syncEnabled?, pendingSync? }`. It renders a storage summary, export, import, and reset rows, and `ResetEverythingDialog`.
- `FeatureSettings` (`feature-settings.tsx`): props `{ smartViewsEnabled: boolean, onToggleSmartViews: () => void }`. It renders one Smart views `Switch` row with id `smart-views-enabled`.
- `FeedbackSettings` (`feedback-settings.tsx`): takes no props. It composes the poll, sentiment, note, payload preview, and send rows from `useFeedbackForm()` state.
- `FeedbackSentimentRow` (`feedback-form-rows.tsx`): props `{ sentiment: Sentiment | null, onChange }`. It renders thumbs up and thumbs down toggle buttons with `aria-pressed`.
- `FeedbackNoteRows` (`feedback-form-rows.tsx`): props `{ category, message, onCategoryChange, onMessageChange }`. It renders a category select and the `#feedback-message` textarea with a character counter.
- `FeedbackPayloadPreview` (`feedback-form-rows.tsx`): props `{ payload: FeedbackPayload | null }`. It renders a `<details>` with `JSON.stringify(payload, null, 2)` in `data-testid="feedback-payload-preview"`.
- `FeedbackSendRow` (`feedback-form-rows.tsx`): props `{ canSend: boolean, status: SendStatus, lastSentAt: string | null, onSend }`. It renders status text, the last-sent date, and the send `Button`.
- `FeedbackRoadmapPoll` (`feedback-roadmap-poll.tsx`): props `{ votes: string[], onToggle: (slug: string) => void }`. It renders one toggle button for each `ROADMAP_ITEMS` entry.
- `useFeedbackForm` (`use-feedback-form.ts`): hook that returns `{ draft, update, payload, send, status, lastSentAt, canSend }` from the external feedback store.
- `SendStatus` (`use-feedback-form.ts`): union type `{ kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string }`.
- `NotificationSettingsSection` (`notification-settings.tsx`): props `settings: NotificationSettings | null`, `onNotificationToggle`, `onDefaultReminderChange(value)`, `onSoundToggle`, `onQuietHoursToggle`, and `onQuietHoursChange(which: "start" | "end", value)`.
- `SweepReminderRows` (`sweep-reminder-rows.tsx`): takes no props. It renders a link to `ROUTES.SWEEP`, the weekly sweep reminder switch, and Day and Time rows when enabled.
- `SettingsRow` (`shared-components.tsx`): label and description row with inline children. Props are `label`, `description?`, `state?: boolean`, and `children`.
- `SettingsSelectRow` (`shared-components.tsx`): row with a native `<select>`. Props are `label`, `description?`, `value`, `options: { value, label }[]`, and `onChange(value: string)`.
- `SyncSettings` (`sync-settings.tsx`): props `onViewHistory`, `onExport`, and `onAccountDeleted`. It renders the auto-sync switch, an interval select, a history button, `SyncAccountRow`, `SyncAuthTokenRow`, and `SyncDangerZone`.
- `SyncAccountRow` (`sync-account-row.tsx`): takes no props. It shows the connected account email and a Sign out button, with `LogoutConfirmation` when pending changes exist.
- `SyncAuthTokenRow` (`sync-auth-token-row.tsx`): takes no props. It renders an "MCP access" row with a "Copy auth token" button.
- `SyncDangerZone` (`sync-danger-zone.tsx`): props `onExport: () => Promise<boolean>` and `onAccountDeleted: () => void`. It renders a "Delete account…" button that opens `DeleteAccountDialog`.
- `TrashSettings` (`trash-settings.tsx`): takes no props. It renders a live list of trashed tasks with a days-left countdown, Restore, Delete, and a confirmed Empty trash.
- `WhatsNewSection` (`whats-new-section.tsx`): prop `releases?: readonly WhatsNewRelease[]`, which overrides `useWhatsNewReleases()`. It renders web releases for the running version, grouped as New, Improved, and Fixed.

## Invariants

- `about-section.tsx:AboutSection`: the version falls back from `process.env.NEXT_PUBLIC_BUILD_NUMBER` to `packageJson.version`. The build date falls back from `NEXT_PUBLIC_BUILD_DATE` to "dev build".
- `appearance-settings.tsx:AppearanceSettings`: theme buttons are disabled, and none shows active, until `useIsHydrated()` is true. The group sets `aria-busy` until then.
- `appearance-settings.tsx:EscalationWindowRow`: the select writes only when the chosen value matches an entry of `ESCALATION_WINDOW_OPTIONS`. `null` maps to value `"off"`.
- `appearance-settings.tsx:EscalationWindowRow`: the server snapshot is `DEFAULT_ESCALATION_WINDOW_DAYS`.
- `archive-settings.tsx:ARCHIVE_DAYS_OPTIONS`, `handleDaysChange`: the period options are exactly `"30"`, `"60"`, and `"90"`. The handler casts the parsed value to `30 | 60 | 90`.
- `archive-settings.tsx:ArchiveSettings`: `handleToggleEnabled` and `handleArchiveNow` return early when `settings` is undefined. The component renders "Loading..." until settings load.
- `archive-settings.tsx:handleArchiveNow`: a comment explains the missing `finally`. The React Compiler cannot optimize try/finally, so both paths call `setIsArchiving(false)`.
- `archive-settings.tsx:ArchiveSettings`: the "Archive after" row renders only when `settings.enabled`. "View archive" renders only when `archivedCount > 0`.
- `bookmarklet-settings.tsx:BookmarkletDragRow`: a comment forbids an `href` prop on the bookmarklet anchor. React replaces a `javascript:` href with a throwing stub, so the code uses `setAttribute`.
- `bookmarklet-settings.tsx:handleLinkClick`: a click on the bookmarklet link always calls `event.preventDefault()`. A comment states that the app CSP blocks `javascript:` navigation.
- `data-management.tsx:StorageSummaryRows`: a comment requires the breakdown to account for every record in `totalTasks`. Saved and Trash counts render only when above 0.
- `data-management.tsx:DataManagement`: `syncEnabled` defaults to `false` and `pendingSync` to `0`. The export, import, and reset rows are disabled while `isLoading`.
- `feedback-form-rows.tsx:FeedbackSentimentRow`: pressing the active sentiment button calls `onChange(null)`.
- `feedback-form-rows.tsx:FeedbackNoteRows`: the textarea sets `maxLength={MAX_MESSAGE_LENGTH}` from `@/lib/feedback/feedback-payload`.
- `feedback-form-rows.tsx:FeedbackCategoryRow`: an empty select value maps to `null` ("Not sure").
- `feedback-form-rows.tsx:FeedbackPayloadPreview`: a comment states that the preview renders from the same payload object as the request body. A `null` payload renders an empty string.
- `feedback-form-rows.tsx:FeedbackSendRow`: the send button is disabled when `!canSend`. The "Last sent" line is hidden when `status.kind === "error"` or `lastSentAt` is `null`.
- `feedback-roadmap-poll.tsx:RoadmapVoteButton`: a comment states that the vote row is a button with `aria-pressed` and `min-h-[44px]`, per WCAG 2.5.5.
- `feedback-settings.tsx:FeedbackSettings`: a comment states that everything stays local until Send. The only network call on this surface is behind the Send button.
- `use-feedback-form.ts:useFeedbackForm`: `payload` is `null` unless both `submissionId` and `builtAt` exist. `send` returns early when the payload is `null`.
- `use-feedback-form.ts:useFeedbackForm`: `canSend` is `!isDraftEmpty(draft) && status.kind !== "sending"`.
- `use-feedback-form.ts:useFeedbackForm`: `recordSend` runs only after `outcome.ok`. A comment states that the id survives a failed send, so a retry is idempotent.
- `use-feedback-form.ts:APP_VERSION`: the app version is `process.env.NEXT_PUBLIC_BUILD_NUMBER || "unknown"`.
- `use-feedback-form.ts:FAILURE_MESSAGES`: maps the failure reasons `offline`, `rate-limited`, `rejected`, and `server` to messages.
- `notification-settings.tsx:NotificationSettingsSection`: `settings === null` renders only "Loading...".
- `notification-settings.tsx:NotificationSettingsSection`: the default reminder, sound, and quiet-hours rows render only when `settings.enabled`. `SweepReminderRows` always renders.
- `notification-settings.tsx:NotificationSettingsSection`: the "Browser permission" row renders only when `"Notification" in window`.
- `notification-settings.tsx:REMINDER_OPTIONS`: the listed default-reminder values are 15, 30, 60, 120, and 1440 minutes.
- `notification-settings.tsx:reminderOptions`: appends a stored offset that is not in the list as its own option, sorted by number. A comment says to render as stored and never snap.
- `notification-settings.tsx:offListLabel`: 0 reads "At due time". The label uses hours only when divisible by 60, and days only when divisible by 1440.
- `notification-settings.tsx:QuietHoursRows`: quiet hours count as on only when both `quietHoursStart` and `quietHoursEnd` are truthy. The From and To rows render only then.
- `shared-components.tsx:SettingsRow`: the on or off suffix renders only when `description` is set and `state !== undefined`.
- `shared-components.tsx:SettingsSelectRow`: finds the selected option by a label equal to `value`. It falls back to `options[0].value`, so `options` must not be empty.
- `sweep-reminder-rows.tsx:DayAndTimeRows`: weekday option values run 1 to 7 with Monday as 1 (`index + 1` over `WEEKDAYS`).
- `sweep-reminder-rows.tsx:DayAndTimeRows`: ignores an empty time input value.
- `sweep-reminder-rows.tsx:SweepReminderRows`: turning the reminder off keeps `weekday` and `time`. Only `enabled` changes.
- `sweep-reminder-rows.tsx:SweepReminderRows`: requests permission only when enabling and `checkNotificationPermission() === "default"`.
- `sync-account-row.tsx:SyncAccountRow`: renders `null` unless `status?.enabled`.
- `sync-account-row.tsx:SyncAccountRow.handleSignOut`: reads status again before sign-out. `pendingCount > 0` shows a confirmation first, because `disableSync` discards the queue.
- `sync-account-row.tsx:asSignedOut`: after a successful sign-out the snapshot is `enabled: false, email: null, pendingCount: 0`.
- `sync-auth-token-row.tsx:SyncAuthTokenRow`: renders `null` when `authStore.token` is falsy. The server snapshot is `false`.
- `sync-auth-token-row.tsx:copyAuthToken`: refuses the copy with an error toast when `!token || !authStore.isValid`. It reads the token at click time, with no `await` before the clipboard write.
- `sync-settings.tsx:SyncSettings`: initial state is `autoSyncEnabled = true` and `syncInterval = 2` until `getAutoSyncConfig()` resolves.
- `sync-settings.tsx:SYNC_INTERVAL_OPTIONS`: interval choices are 1, 2, 5, 10, 15, and 30 minutes. The label falls back to "2 minutes".
- `sync-settings.tsx:SyncSettings.handleIntervalChange`: debounces interval persistence by 500 ms. A new change clears the pending timeout.
- `sync-settings.tsx:SyncSettings`: the auto-sync switch is disabled while `isLoading`. The interval row renders only when `autoSyncEnabled`.
- `sync-settings.tsx:SyncSettings.handleAutoSyncToggle`: a comment explains the missing `finally` (React Compiler). Both paths reset loading.
- `trash-settings.tsx:daysLeft`: a missing `deletedAt` returns `TRASH_RETENTION_DAYS`. Otherwise it returns `Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays))`.
- `trash-settings.tsx:TrashRow`: skips the Restore and Delete handlers when `isRepeatClick(event)` is true.
- `trash-settings.tsx:TrashSettings`: the empty-trash control renders only when `items.length > 0`. `emptyTrash()` runs only after a confirm step (`confirmingEmpty`).
- `whats-new-section.tsx:WhatsNewSection`: renders `null` when releases are `null`. It renders "No release notes for this version yet." when `releasesFor(all, "web", current)` is empty.
- `whats-new-section.tsx:DATE_FORMAT`: formats release dates in `en-US` with `timeZone: "UTC"`, parsed as `${date}T00:00:00Z`. A YYYY-MM-DD date never shifts a day.
- `whats-new-section.tsx:ReleaseNotes`: groups render in the order new, improved, fixed, and only when the group has entries.

## Side Effects

- `about-section.tsx:AboutSection`: the replay button dispatches `new Event(REPLAY_ONBOARDING_EVENT)` on `window`. The constant comes from `@/components/onboarding/onboarding-gate` (see [onboarding](../onboarding/README.md)).
- `about-section.tsx:AboutSection`: renders external links to `https://gsdtaskmanager.com/privacy/` and `https://github.com/vscarpenter/gsd-task-manager`.
- `appearance-settings.tsx:AppearanceSettings`: calls `setTheme("light" | "dark" | "system")` from `next-themes` `useTheme()`.
- `appearance-settings.tsx:EscalationWindowRow`: subscribes to `subscribeEscalationWindow` and `readEscalationWindow`, and calls `writeEscalationWindow`, from `@/lib/preferences/escalation-window`.
- `archive-settings.tsx:handleDaysChange`: calls `updateArchiveSettings({ archiveAfterDays })` from `@/lib/archive`, then `toast.success`.
- `archive-settings.tsx:ArchiveSettings.handleToggleEnabled`: calls `updateArchiveSettings({ enabled })` from `@/lib/archive`, then `toast.success`.
- `archive-settings.tsx:ArchiveSettings.handleArchiveNow`: calls `archiveOldTasks(settings.archiveAfterDays)` from `@/lib/archive`. It shows `toast.success` with the count, or `toast.error`.
- `archive-settings.tsx:ArchiveSettings`: reads Dexie live through `useLiveQuery` of `getArchiveSettings()` and `getArchivedCount()` from `@/lib/archive`.
- `bookmarklet-settings.tsx:BookmarkletDragRow`: an effect sets the anchor `href` attribute to `buildBookmarkletHref(window.location.origin, tags)` from `@/lib/bookmarklet` when `tags` changes.
- `bookmarklet-settings.tsx:BookmarkletCopyRow`: calls `navigator.clipboard.writeText(buildBookmarkletHref(window.location.origin, tags))`. It shows "Bookmarklet copied" or an error toast.
- `bookmarklet-settings.tsx:handleLinkClick`: shows the toast "Drag this link to your bookmarks bar, then click it on any page."
- `data-management.tsx:DataManagement`: invokes the caller's `onExport` and `onImportClick` props. It passes `onExport` to `ResetEverythingDialog` from `@/components/reset-everything-dialog`.
- `feedback-settings.tsx:FeedbackSettings`: calls `toggleVote(draft, slug)` from `@/lib/feedback/feedback-store` and passes the result to `update`. The Send button invokes `send`.
- `use-feedback-form.ts:useFeedbackForm`: subscribes through `subscribeToFeedback`, `getFeedbackSnapshot`, and `getServerFeedbackSnapshot` from `@/lib/feedback/feedback-store`.
- `use-feedback-form.ts:useFeedbackForm.update`: calls `updateDraft(next)` from `@/lib/feedback/feedback-store`.
- `use-feedback-form.ts:useFeedbackForm.send`: calls `submitFeedback(payload)` from `@/lib/feedback/submit-feedback`. On success it calls `recordSend(new Date().toISOString())`.
- `notification-settings.tsx:NotificationSettingsSection`: reads `Notification.permission` during render. It writes nothing.
- `sweep-reminder-rows.tsx:SweepReminderRows`: initial state calls `readSweepReminder` from `@/lib/preferences/weekly-sweep`. `save` calls `writeSweepReminder` on every toggle, day, or time change.
- `sweep-reminder-rows.tsx:SweepReminderRows.toggle`: calls `checkNotificationPermission` and `requestNotificationPermission` from `@/lib/notifications` when enabling.
- `sweep-reminder-rows.tsx:SweepReminderRows`: renders a `next/link` to `ROUTES.SWEEP`.
- `sync-account-row.tsx:SyncAccountRow`: calls `getSyncStatus` from `@/lib/sync/config` on mount and on a sign-out click.
- `sync-account-row.tsx:signOutAndReport`: calls `disableSync` from `@/lib/sync/config`. It shows "Signed out" or "Sign out failed", and logs the failure with `logger.error`.
- `sync-account-row.tsx:readStatus`: on failure calls `logger.error("Failed to load sync status")` through `createLogger("UI")` from `@/lib/logger`.
- `sync-auth-token-row.tsx:SyncAuthTokenRow`: subscribes to `getPocketBase().authStore.onChange` from `@/lib/sync/pocketbase-client` through `useSyncExternalStore`.
- `sync-auth-token-row.tsx:copyAuthToken`: calls `navigator.clipboard.writeText(currentStore.token)`. It shows "Auth token copied", "Sign in again to copy your token.", or a copy-failure toast.
- `sync-settings.tsx:SyncSettings`: on mount calls `getAutoSyncConfig` from `@/lib/sync/config`. A failure logs "Failed to load sync config".
- `sync-settings.tsx:SyncSettings.handleAutoSyncToggle`: calls `updateAutoSyncConfig(checked, syncInterval)` from `@/lib/sync/config`, then shows a success or failure toast.
- `sync-settings.tsx:SyncSettings.handleIntervalChange`: sets `setTimeout(..., 500)`, then calls `updateAutoSyncConfig(autoSyncEnabled, newInterval)` and shows a toast. Unmount clears the timeout.
- `sync-settings.tsx:SyncSettings`: the "Sync history" button calls the `onViewHistory` prop. This file makes no router call.
- `trash-settings.tsx:TrashSettings`: reads Dexie live with `useLiveQuery(() => listTrashedTasks())` from `@/lib/trash`.
- `trash-settings.tsx:handleRestore`: calls `restoreFromTrash(task.id)` from `@/lib/trash` and shows a "Restored" toast with the title.
- `trash-settings.tsx:handleDeleteForever`: calls `deleteFromTrashForever(task.id)` from `@/lib/trash` and shows "Deleted permanently".
- `trash-settings.tsx:handleEmptyTrash`: calls `emptyTrash()` from `@/lib/trash` and shows a toast with the deleted count.
- `whats-new-section.tsx:WhatsNewSection`: an effect calls `recordLastSeenVersion(current)` from `@/lib/whats-new/last-seen` when `runningWebVersion()` is truthy.
- `whats-new-section.tsx:WhatsNewSection`: calls `useWhatsNewReleases` from `@/lib/whats-new/load-releases` on every render, even when the caller passes `releases`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
