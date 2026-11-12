# Settings page

## Overview

This directory has the settings page shell: the header, the sidebar navigation, and the body that renders the active section.
It has three hooks. One reads the active section from the URL hash, one loads settings state and its mutation handlers, and one builds a storage summary.
Section metadata is a static table in `settings-sidebar-data.ts`. The section components live in [settings](../settings/README.md).

## Interface

- `SettingsPage` (`index.tsx`): takes no props. It wraps in `TooltipProvider delayDuration={300}`, shows `Spinner` until `settings.dataLoaded`, then renders `SettingsSidebar` and `SettingsBody`.
- `SettingsBody` (`settings-body.tsx`): props `{ activeSection, tasks: TaskRecord[], tasksLoading, settings: SettingsData }`. It renders the active section in a `SectionCard` and owns export, the import file picker, and the lazy `ImportDialog`.
- `SectionCard` (`section-card.tsx`): props `{ title, description, children }`. It renders a `<section>` with an `aria-labelledby` id derived from the title.
- `SettingsSidebar` (`settings-sidebar.tsx`): props `{ activeId, onSelect(id), visibleSections: SettingsSectionId[] }`. It renders a mobile pill nav (`data-testid="settings-nav-scroller"`) and a desktop grouped nav.
- `SettingsSectionId` (`settings-sidebar-data.ts`): union type `"appearance" | "features" | "bookmarklet" | "notifications" | "sync" | "archive" | "trash" | "data" | "feedback" | "whats-new" | "about"`.
- `SectionGroup` (`settings-sidebar-data.ts`): union type `"Preferences" | "Data" | "Info"`.
- `SectionMeta` (`settings-sidebar-data.ts`): interface `{ id, label, icon: LucideIcon, description, group }`.
- `SETTINGS_SECTIONS` (`settings-sidebar-data.ts`): `SectionMeta[]` constant of 11 sections.
- `SETTINGS_SECTION_IDS` (`settings-sidebar-data.ts`): constant array of ids mapped from `SETTINGS_SECTIONS`.
- `useActiveSection` (`use-active-section.ts`): `(syncEnabled: boolean) => ActiveSection`. It reads the section from `window.location.hash` through `useSyncExternalStore`.
- `ActiveSection` (`use-active-section.ts`): interface `{ activeSection, visibleSectionIds, selectSection(id) }`.
- `useSettingsData` (`use-settings-data.ts`): `() => SettingsData`. It loads notification settings, sync status, and app preferences on mount.
- `SettingsData` (`use-settings-data.ts`): interface with `dataLoaded`, `showCompleted`, `appPreferences`, `notificationSettings`, `syncEnabled`, and `pendingSync`. Its handlers are `toggleCompleted`, `toggleSmartViews`, `notificationToggle`, `defaultReminderChange`, `soundToggle`, `quietHoursToggle`, `quietHoursChange`, and `markAccountDeleted`.
- `useStorageSummary` (`use-storage-summary.ts`): `(tasks: TaskRecord[]) => StorageSummary`. It combines task counts with live archive and trash stats.
- `StorageSummary` (`use-storage-summary.ts`): interface `{ activeTasks, savedTasks, completedTasks, archivedTasks, trashedTasks, totalTasks, estimatedKb: string }`.

## Invariants

- `settings-body.tsx:pickImportFile`: rejects import files larger than `MAX_IMPORT_BYTES` (`10 * 1024 * 1024`) with an error toast.
- `settings-body.tsx:pickImportFile`: import contents must pass `JSON.parse` before `onReady` runs. A failure shows "Invalid JSON format in import file".
- `settings-body.tsx:pickImportFile`: sets `input.accept = "application/json"` as a picker hint. No code checks the file type or extension.
- `settings-body.tsx:handleExport`: returns `false` when `downloadBackup()` returns `ok` false or throws, and `true` otherwise. A comment says callers gate on the result.
- `settings-body.tsx:handleExport`: a comment explains the missing `finally` (React Compiler). Both paths call `setIsExporting(false)`.
- `settings-body.tsx:SettingsBody`: an unknown `activeSection` falls back to `SETTINGS_SECTIONS[0]` for card metadata.
- `settings-body.tsx:SettingsBody`: the `features` section renders only when `settings.appPreferences` is not `null`. The `sync` section renders only when `settings.syncEnabled`.
- `settings-body.tsx:SELF_CONTAINED_SECTIONS`: maps `bookmarklet`, `trash`, `feedback`, `whats-new`, and `about` to components that take no props.
- `use-active-section.ts:readHashSection`, `readServerSection`: a hash outside `SETTINGS_SECTION_IDS` resolves to `DEFAULT_SECTION` (`"appearance"`). The server snapshot is also `DEFAULT_SECTION`.
- `use-active-section.ts:useActiveSection`: excludes `sync` from `visibleSectionIds` when `syncEnabled` is false.
- `use-active-section.ts:useActiveSection`: if the hash section is not visible, render derives `activeSection` as `DEFAULT_SECTION`.
- `settings-sidebar.tsx:SettingsSidebar`, `groupByGroup`: renders only sections in `visibleSections`, grouped in the order `Preferences`, `Data`, `Info`. It omits empty groups.
- `settings-sidebar.tsx:SettingsSidebar`: a comment requires full-strength muted color on group labels. The `/80` composite measured 3.72:1, which is under AA.
- `use-settings-data.ts:useSettingsData`: sets `dataLoaded` only after all three loads resolve. A load failure is logged and `dataLoaded` stays false.
- `use-settings-data.ts:useSettingsData`: the mount effect ignores results once cleanup sets its `cancelled` flag.
- `use-settings-data.ts:toggleSmartViews`: returns early when `appPreferences` is `null`.
- `use-settings-data.ts:buildNotificationHandlers`: `notificationToggle` returns early when settings are `null`. When `"Notification" in window`, it aborts enabling unless `Notification.requestPermission()` returns `"granted"`. Without that API, it enables with no permission check.
- `use-settings-data.ts:buildNotificationHandlers`: `defaultReminderChange` converts the value with `Number.parseInt(value, 10)`.
- `use-settings-data.ts:buildNotificationHandlers`: each notification handler reloads settings with `getNotificationSettings()` after it mutates.
- `use-storage-summary.ts:countByState`: a task counts as saved if `savedAt` is set, else completed if `completed`, else active.
- `use-storage-summary.ts:useStorageSummary`: `totalTasks` is `tasks.length + archivedTasks + trashedTasks`. `estimatedKb` divides the summed bytes by `BYTES_PER_KB` (1024), to one decimal.
- `use-storage-summary.ts:useStorageSummary`: archived and trashed stats default to 0 while their live queries are undefined.

## Side Effects

- `index.tsx:SettingsPage`: calls `useTasks` from `@/lib/use-tasks`.
- `settings-body.tsx:pickImportFile`: creates an `<input type="file">` with `document.createElement`, calls `input.click()`, and reads the file with `file.text()`.
- `settings-body.tsx:pickImportFile`: shows `toast.error` for an oversize file and for invalid JSON.
- `settings-body.tsx:handleExport`: calls `downloadBackup` from `@/lib/backup-download`.
- `settings-body.tsx:handleExport`: shows `toast.warning(skippedRecordsWarning(skippedCount))`, `toast.success(EXPORT_SUCCESS_MESSAGE)`, or `toast.error("Failed to export tasks")`.
- `settings-body.tsx:handleExport`: calls `logger.error("Export failed", ...)` on a logger from `createLogger("UI")` in `@/lib/logger`.
- `settings-body.tsx:SettingsBody`: calls `router.push("/sync-history")` and `router.push("/archive")`.
- `settings-body.tsx:SettingsBody`: `onImportComplete` shows `toast.success("Tasks imported successfully")`.
- `settings-body.tsx:WhatsNewSection`, `ImportDialog`: lazy dynamic imports of `@/components/settings/whats-new-section` and `@/components/import-dialog`.
- `use-active-section.ts:subscribeToHash`: adds window listeners for `hashchange`, `popstate`, and `gsd:settings-section-selected` (`SECTION_SELECTED_EVENT`). Unsubscribe removes them.
- `use-active-section.ts:readHashSection`: reads `window.location.hash`.
- `use-active-section.ts:selectSection`: calls `window.history.replaceState(null, "", "#" + id)`, then dispatches `new Event("gsd:settings-section-selected")` on `window`.
- `use-settings-data.ts:useSettingsData`: on mount calls `getNotificationSettings` from `@/lib/notifications`, `getSyncStatus` from `@/lib/sync/config`, `getAppPreferences` from `@/lib/smart-views`, and `readShowCompleted` from `@/lib/preferences/show-completed`.
- `use-settings-data.ts:toggleCompleted`: calls `localStorage.setItem(SHOW_COMPLETED_KEY, String(next))`, then dispatches a window `CustomEvent(SHOW_COMPLETED_EVENT, { detail: { show: next } })`. Both constants come from `@/lib/preferences/show-completed`.
- `use-settings-data.ts:toggleSmartViews`: calls `updateAppPreferences` from `@/lib/smart-views`, then dispatches a window `CustomEvent(APP_PREFERENCES_EVENT, { detail: { preferences: updated } })`.
- `use-settings-data.ts:buildNotificationHandlers.notificationToggle`: calls `Notification.requestPermission()` when enabling notifications, only if `"Notification" in window`.
- `use-settings-data.ts:buildNotificationHandlers`: calls `updateNotificationSettings`, `clearAppBadge`, `toggleNotificationSound`, `toggleQuietHours`, and `setQuietHoursEdge` from `@/lib/notifications`.
- `use-settings-data.ts:useSettingsData`: calls `logger.error("Failed to load settings data", ...)` when the mount load throws.
- `use-storage-summary.ts:useStorageSummary`: runs Dexie live queries through `useLiveQuery`. They call `getArchivedStorageStats` from `@/lib/archive` and `getTrashStorageStats` from `@/lib/trash`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
