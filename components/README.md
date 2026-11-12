# Components

## Overview

This directory has the React components of the GSD Task Manager web app.
Its 20 direct files are app-level pieces: layout wrappers, providers, the error boundary, and service worker registration.
They also include the import, reset, and delete-account dialogs, and a task timer.
Feature UI lives in 14 subdirectories, each with its own contract.
The app is a Next.js static export.

## Interface

Direct files:

- `ClientLayout` (`client-layout.tsx`): `({ children })`. It calls `useAutoArchive()` and `useNotificationChecker()`, and wraps children in `SyncProvider` from `@/lib/sync/sync-provider`.
- `QueryProvider` (`query-provider.tsx`): `{ children }`. It wraps children in `QueryClientProvider` with one `QueryClient`, created once through `useState`.
- `ThemeProvider` (`theme-provider.tsx`): `{ children }`. It wraps children in the next-themes `ThemeProvider` with `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`.
- `ThemeToggle` (`theme-toggle.tsx`): button with a tooltip and no props. It switches between `light` and `dark` from `resolvedTheme`.
- `ErrorBoundary` (`error-boundary.tsx`): `({ children, fallback? })`. It renders `fallback` or a full-screen `role="alert"` fallback with Reload page and Go home buttons.
- `GlobalErrorListener` (`global-error-listener.tsx`): takes no props and renders `null`. It shows a throttled error toast on window `unhandledrejection`.
- `FirstTimeRedirect` (`first-time-redirect.tsx`): takes no props and renders `null`. An effect redirects visitors without the `gsd-has-launched` flag to `/about`.
- `PwaRegister` (`pwa-register.tsx`): takes no props and renders `null`. It registers `/sw.js`, watches for updates, and registers periodic background sync when supported.
- `PwaUpdateToast` (`pwa-update-toast.tsx`): takes no props. After a `pwa-update-available` event it shows an "Update Available" alert with "Refresh Now" and "Later".
- `WebMcpRegister` (`webmcp-register.tsx`): takes no props and renders `null`. It provides a context with one tool (`create_task`) to `navigator.modelContext`.
- `Navigator.modelContext` (`webmcp-register.tsx`): `declare global` augmentation that adds optional `modelContext?: WebMCPProvider` to `Navigator`.
- `ResetLockGate` (`reset-lock-gate.tsx`): `{ children }`. It renders children only while the reset lock is `unlocked` and no lock was shown. Otherwise it renders a progress or locked screen.
- `ResetEverythingDialog` (`reset-everything-dialog.tsx`): confirmation dialog that runs the reset. Props are `open`, `onOpenChange`, `onExport: () => Promise<boolean>`, the task counts, `syncEnabled`, and `pendingSync`.
- `DeleteAccountDialog` (`delete-account-dialog.tsx`): confirmation dialog that deletes the remote account and can erase local data. Props are `open`, `onOpenChange(open)`, `onExport(): Promise<boolean>`, and optional `onDeleted()`.
- `ImportDialog` (`import-dialog.tsx`): renders an invalid-file dialog or a Merge or Replace choice. Props are `open`, `onOpenChange`, `fileContents: string | null`, `existingTaskCount`, `onImportComplete`, and optional `existingTaskIds`, `archivedCount`, `trashedCount`, and `syncEnabled`.
- `AppFooter` (`app-footer.tsx`): takes no props. It renders a link to `https://vinny.dev/`, the build number and date, and a `Link` to `/settings#feedback`. The build number comes from `NEXT_PUBLIC_BUILD_NUMBER` (fallback `"dev"`) and the date from `NEXT_PUBLIC_BUILD_DATE` (fallback `"unknown"`).
- `GsdLogo` (`gsd-logo.tsx`): `({ className?, size = 28 })`. It renders an `aria-hidden` SVG of four rects filled `var(--q1)` to `var(--q4)` and a check path.
- `TaskDescription` (`task-description.tsx`): `{ description: string; className?: string }`. It renders segments from `getDescriptionSegments` as text spans or external links.
- `TaskTimer` (`task-timer.tsx`): `{ task: TaskRecord; onStartTimer(taskId); onStopTimer(taskId); compact?; className? }`. It renders a start and stop button with live elapsed time, total tracked, and the estimate.
- `CommandPalette` (`command-palette.tsx`): pure re-export. The statement is `export { CommandPalette } from "./command-palette/index";`.
- `TaskCard` (`task-card.tsx`): pure re-export. The statement is `export { TaskCard } from "@/components/task-card/index";`.

Subdirectories:

- [about](./about/README.md): sections of the About page, a scroll reveal wrapper, and a copyable code panel.
- [command-palette](./command-palette/README.md): the `cmdk` command dialog and its rows.
- [dashboard](./dashboard/README.md): presentational panels for the dashboard and review surface.
- [matrix-simplified](./matrix-simplified/README.md): the matrix page, `AppShell`, the edit drawer, and the task mutation handlers.
- [onboarding](./onboarding/README.md): the welcome tour dialog and the gate that opens it.
- [saved](./saved/README.md): the Saved page, its item editor, and its action hooks.
- [settings](./settings/README.md): the section components that the settings page renders.
- [settings-page](./settings-page/README.md): the settings page shell, sidebar, and data hooks.
- [share-task-dialog](./share-task-dialog/README.md): the dialog that shares one task as plain text.
- [sync](./sync/README.md): the sync button, the sign-in dialog, the OAuth buttons, and the sync hooks.
- [task-card](./task-card/README.md): the sortable task card, its rows, and the swipe gesture.
- [today-strip](./today-strip/README.md): the Today strip and the context for card menus.
- [ui](./ui/README.md): shared primitives, Radix wrappers, and the toast systems.
- [weekly-sweep](./weekly-sweep/README.md): the weekly sweep page, card, and session hook.

## Invariants

- `delete-account-dialog.tsx:DeleteAccountDialog`: Delete is enabled only when `confirmText === "DELETE"` and (`!exportFirst || hasExported`). `handleDelete` returns early if `!canDelete`.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleExport`: sets `hasExported` from the boolean that `onExport()` resolves. A comment states that only a real success unlocks the delete gate.
- `delete-account-dialog.tsx:deleteAccountFormReducer`: `setExportFirst` with `false` resets `hasExported`. `reset` restores `INITIAL_DELETE_FORM_STATE` but keeps the in-flight `isDeleting` flag.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleDelete`: `deleteRemoteAccountAndTasks()` runs first. The code touches local data (`resetEverything` or `disableSync`) only when `result.ok`.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleClose`: closing does nothing while `isDeleting`. Switches, the input, and buttons are disabled while `isDeleting`.
- `delete-account-dialog.tsx:INITIAL_DELETE_FORM_STATE`: defaults are `exportFirst: false` and `eraseLocal: false`. A comment says tasks stay on this device by default.
- `delete-account-dialog.tsx:failureMessage`: message precedence is `result.remoteTasksErased` (split by `authRejected`), then `authRejected`, then `stage === "tasks"`, then a generic message.
- `reset-everything-dialog.tsx:ResetEverythingDialog`: `canReset` requires `confirmText === "RESET"` and (`!exportFirst || hasExported`). `handleReset` returns early otherwise.
- `reset-everything-dialog.tsx:handleExport`: sets `hasExported` to the boolean that `onExport()` resolves, so only a successful export unlocks the reset gate.
- `reset-everything-dialog.tsx:resetFormReducer`: turning `exportFirst` off clears `hasExported`. `resetInputs` clears `confirmText`, `exportFirst`, and `hasExported`, and keeps `preserveTheme`.
- `reset-everything-dialog.tsx:INITIAL_RESET_FORM_STATE`: `preserveTheme` defaults to `true` and `exportFirst` to `false`.
- `reset-everything-dialog.tsx:handleClose`: the dialog cannot close while `isResetting` is true.
- `reset-everything-dialog.tsx:resetFailureMessage`: a `local-data` entry in `failedSteps` yields "Your tasks were not deleted". A comment states that the step clears IndexedDB in one transaction.
- `reset-lock-gate.tsx:ResetLockGate`: children render only when `lockState === "unlocked"` and `shownLock === null`. Once a lock was shown, the app does not remount before reload.
- `reset-lock-gate.tsx:useReloadAfterUnlock`: unlocking from `locked` reloads at once. Unlocking from any other shown lock reloads after `UI_TIMING.RESET_RELOAD_DELAY_MS`.
- `reset-lock-gate.tsx:useReloadWhenOwnLockOutlivesMarker`: reloads only when a storage event removes `RESET_PENDING_KEY` (`newValue === null`) and `getResetLockSnapshot()` is still `locked`.
- `reset-lock-gate.tsx:retryReset`: retry reloads unless `result.failedSteps` includes `local-data`. In that case it returns a "Couldn't delete your data." error string.
- `import-dialog.tsx:ImportDialog`: if `fileContents` is set and `checkImportFile(fileContents)` returns `!ok`, it renders `InvalidFileDialog` with `check.message`.
- `import-dialog.tsx:ImportChoiceDialog.handleImport`: returns early when `fileContents` is falsy. The mode is `"replace" | "merge"`.
- `import-dialog.tsx:ImportChoiceDialog.requestReplace`: when `cloudDeletes` (`syncEnabled && liveDeletes !== 0`), Replace requires the `ReplaceConfirm` step before `handleImport("replace")`.
- `import-dialog.tsx:parseImportTaskCount`: returns the array length, or 0 for a valid JSON object with no `tasks` key. It returns `null` for empty contents, a parse error, a non-object, or a non-array `tasks`.
- `import-dialog.tsx:parseImportImpact`: `hasArchive` and `hasTrash` are own-property checks for `archivedTasks` and `deletedTasks`. A comment states that an absent key leaves that store alone and a present key replaces it.
- `import-dialog.tsx:SETTINGS_KEYS`: the reported settings keys are `notificationSettings`, `archiveSettings`, and `appPreferences`.
- `import-dialog.tsx:liveDeleteCount`: returns `null` when file ids are `null`, and `existingCount` when `existingIds` is undefined. Otherwise it counts existing ids that the file lacks.
- `import-dialog.tsx:ImportChoiceDialog`: the Merge, Replace, confirm, and Cancel controls are disabled while `isImporting`.
- `error-boundary.tsx:ErrorBoundaryClass.render`: when `hasError`, renders `props.fallback ?? <ErrorFallback>`. Otherwise it renders children.
- `error-boundary.tsx:navigateHome`: uses a hard `window.location.href = "/"`. A comment states that a soft navigation may keep the state that caused the error.
- `first-time-redirect.tsx:FirstTimeRedirect`: the effect returns early, with flag and route untouched, when `isResetPending()` from `@/lib/reset-lock` is true.
- `first-time-redirect.tsx:FirstTimeRedirect`: the effect returns early when localStorage `gsd-has-launched` is set. The code writes the flag only after the visitor leaves `/about`.
- `first-time-redirect.tsx:SEEN_ABOUT_KEY`: a comment states that `public/theme-init.js` reads and writes the same `gsd-seen-about` key.
- `global-error-listener.tsx:THROTTLE_MS`: is 2000. A toast fires only when `now - lastToastTime >= THROTTLE_MS`.
- `pwa-register.tsx:PwaRegister`: the effect returns early when `window` is undefined or `serviceWorker` is not in `navigator`.
- `pwa-register.tsx:onUpdateFound`: dispatches `pwa-update-available` only when the new worker state is `installed` and `navigator.serviceWorker.controller` exists.
- `pwa-register.tsx:register`: registers periodic sync only after `navigator.serviceWorker.ready` and when `periodicSync` is in the registration. `minInterval` is `NOTIFICATION_TIMING.BACKGROUND_SYNC_INTERVAL_MINUTES * NOTIFICATION_TIMING.MS_PER_MINUTE`.
- `pwa-register.tsx:register`: does not log periodic sync errors named `NotAllowedError` or `InvalidStateError`. Registration failures log as errors only for `TypeError` or `DOMException`.
- `pwa-update-toast.tsx:handleUpdate`: a comment requires the `controllerchange` listener to attach before the `SKIP_WAITING` post, to avoid a race.
- `pwa-update-toast.tsx:handleUpdate`: a `reloadTriggered` flag prevents duplicate reloads. A fallback reload fires after 2000 ms if `controllerchange` has not fired.
- `pwa-update-toast.tsx:handleUpdate`: with no waiting worker reference, it reloads the page directly.
- `query-provider.tsx:QueryProvider`: query defaults are `STALE_TIME_MS = 30_000`, `GC_TIME_MS = 300_000`, `retry: 2`, and `refetchOnWindowFocus: false`.
- `task-description.tsx:segmentKeys`: React keys are `${offset}-${segment.type}` from cumulative character offsets. A comment states that segments partition the description left to right and never reorder.
- `task-description.tsx:TaskDescription`: link segments render with `target="_blank"` and `rel="noopener noreferrer"`.
- `task-timer.tsx:TaskTimer`: clamps `elapsedSeconds` with `Math.max(0, ...)`. It is 0 when no timer is running.
- `task-timer.tsx:TaskTimer`: `isOverEstimate` requires a defined `estimatedMinutes` above 0 and `totalTimeSpent > estimatedMinutes`.
- `task-timer.tsx:handleToggle`: the button is disabled while `isLoading`. The handler clears loading, then rethrows errors from `onStartTimer` and `onStopTimer`.
- `theme-provider.tsx:ThemeProvider`: applies the theme to both attributes, `["class", "data-theme"]`.
- `theme-toggle.tsx:ThemeToggle`: dark state follows `resolvedTheme === "dark"`, not the stored setting. The interactive button renders only after `useIsHydrated()` is true.
- `webmcp-register.tsx:WebMcpRegister`: skips registration when `isResetPending()` is true or `navigator.modelContext?.provideContext` is absent.
- `webmcp-register.tsx:TOOLS`: the `create_task` schema requires `title` and sets `additionalProperties: false`. Title length runs from 1 to `SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH`.
- `webmcp-register.tsx:TOOLS`: other limits are `SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH`, `SCHEMA_LIMITS.TAG_MAX_LENGTH`, and `SCHEMA_LIMITS.MAX_TAGS`.
- `webmcp-register.tsx:TOOLS.execute`: defaults are a trimmed title, `urgent` false, `important` true, `recurrence: "none"`, empty `subtasks` and `dependencies`, and `notificationEnabled: true`.

## Side Effects

- `client-layout.tsx:ClientLayout`: calls `useAutoArchive` from `@/lib/use-auto-archive` and `useNotificationChecker` from `@/lib/use-notification-checker`. It mounts `SyncProvider`.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleDelete`: calls `deleteRemoteAccountAndTasks` from `@/lib/sync/pb-account-deletion`.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleDelete`: on the keep-local path, calls `disableSync` from `@/lib/sync/config`, then `onOpenChange(false)` and `onDeleted?.()`.
- `delete-account-dialog.tsx:eraseLocalDataAndScheduleReload`: calls `resetEverything({ preserveTheme: true })` from `@/lib/reset-everything`.
- `delete-account-dialog.tsx:eraseLocalDataAndScheduleReload`: sets a `setTimeout` of `UI_TIMING.RESET_RELOAD_DELAY_MS`, then calls `reloadAfterReset` from `@/lib/reset-everything`.
- `delete-account-dialog.tsx:DeleteAccountDialog.handleDelete`: the erase-local path never calls `disableSync`, `onOpenChange(false)`, or `onDeleted`. On success it shows a success toast that announces the reload, and the dialog stays open until the reload.
- `delete-account-dialog.tsx:eraseLocalDataAndScheduleReload`: when `resetEverything` reports `!success`, it shows "Cloud account deleted, but local erase was incomplete." and schedules no reload. `handleDelete` then clears `isDeleting` and leaves the dialog open.
- `delete-account-dialog.tsx:DeleteAccountDialog`: shows Sonner toasts for failure (`failureMessage(result)`) and success ("Account deleted. Your tasks remain on this device.").
- `reset-everything-dialog.tsx:handleReset`: calls `resetEverything` from `@/lib/reset-everything` with `{ preserveTheme }` and shows a success or error toast.
- `reset-everything-dialog.tsx:handleReset`: sets a `setTimeout` of `UI_TIMING.RESET_RELOAD_DELAY_MS` that calls `reloadAfterReset`.
- `reset-everything-dialog.tsx:handleExport`, `delete-account-dialog.tsx:DeleteAccountDialog.handleExport`: call the parent's `onExport` prop.
- `reset-lock-gate.tsx:ResetLockGate`: subscribes through `useSyncExternalStore` to `subscribeToResetLock`, `getResetLockSnapshot`, and `getResetLockServerSnapshot` from `@/lib/reset-lock`.
- `reset-lock-gate.tsx:useReloadWhenOwnLockOutlivesMarker`: adds a window `storage` listener while locked. It calls `reloadAfterReset` when `RESET_PENDING_KEY` is removed.
- `reset-lock-gate.tsx:useReloadAfterUnlock`: calls `reloadAfterReset` at once, or through a `setTimeout` of `UI_TIMING.RESET_RELOAD_DELAY_MS`.
- `reset-lock-gate.tsx:retryReset`: calls `resetEverything` with `preserveTheme: readPendingPreserveTheme()` from `@/lib/reset-lock`, then `reloadAfterReset`.
- `reset-lock-gate.tsx:ResetLockScreen`: calls `screenRef.current?.focus({ preventScroll: true })` on mount and when `running` changes.
- `import-dialog.tsx:ImportChoiceDialog.handleImport`: calls `importFromJson(fileContents, mode)` from `@/lib/tasks`, then `onImportComplete()` and `onOpenChange(false)`.
- `import-dialog.tsx:ImportChoiceDialog.handleImport`: on failure, calls `logger.error("Import failed", ...)` through `createLogger("IMPORT")` and shows an error toast.
- `import-dialog.tsx:ImportDialog`: calls `checkImportFile` from `@/lib/tasks/import-check`.
- `import-dialog.tsx:ImportChoiceDialog`, `InvalidFileDialog`: call `useBackToClose(open, ...)` from `@/components/matrix-simplified/use-back-to-close`.
- `error-boundary.tsx:ErrorBoundaryClass.componentDidCatch`: calls `logger.error("Error caught by boundary", ...)` through `createLogger("ERROR_BOUNDARY")`. It also calls `this.fallbackRef.current?.focus({ preventScroll: true })`.
- `error-boundary.tsx:RecoveryActions`, `navigateHome`: call `window.location.reload()` and set `window.location.href = "/"`.
- `first-time-redirect.tsx:FirstTimeRedirect`: reads localStorage `gsd-has-launched`. It writes `localStorage.setItem("gsd-has-launched", "true")` when sessionStorage `gsd-seen-about` is set and the route is not ABOUT.
- `first-time-redirect.tsx:FirstTimeRedirect`: calls `sessionStorage.setItem("gsd-seen-about", "true")` on the ABOUT route.
- `first-time-redirect.tsx:FirstTimeRedirect`: calls `router.replace("/about")` from the `next/navigation` router.
- `global-error-listener.tsx:GlobalErrorListener`: adds a window `"unhandledrejection"` listener and removes it on cleanup. It shows `toast.error("An unexpected error occurred")`.
- `pwa-register.tsx:register`: calls `navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })`, then awaits `navigator.serviceWorker.ready`.
- `pwa-register.tsx:register`: calls `periodicSync.register("check-notifications", { minInterval })` when supported.
- `pwa-register.tsx:PwaRegister`: adds a document `visibilitychange` listener that calls `registration.update()` when visible. It also adds `updatefound` and `statechange` listeners.
- `pwa-register.tsx:onUpdateFound`: dispatches a window `CustomEvent` named `pwa-update-available` with the new worker as `detail`.
- `pwa-update-toast.tsx:PwaUpdateToast`: adds a window `pwa-update-available` listener and removes it on cleanup.
- `pwa-update-toast.tsx:handleUpdate`: adds a `navigator.serviceWorker` `controllerchange` listener, then calls `waitingWorker.postMessage({ type: "SKIP_WAITING" })`.
- `pwa-update-toast.tsx:handleUpdate`: sets a 2000 ms `setTimeout` as a reload fallback and calls `window.location.reload()`.
- `task-description.tsx:TaskDescription`: a link `onClick` calls `event.stopPropagation()`.
- `task-timer.tsx:TaskTimer`: runs a `setInterval` of 1000 ms that updates `now` while a timer runs. Cleanup clears it.
- `task-timer.tsx:handleToggle`: calls the `onStopTimer` or `onStartTimer` prop with `task.id`.
- `theme-provider.tsx:ThemeProvider`: passes `storageKey="gsd-theme"` and `scriptProps={{ src: "/theme-init.js" }}` to the next-themes `ThemeProvider`.
- `theme-toggle.tsx:ThemeToggle`: a click calls `setTheme` from `next-themes` with `"light"` or `"dark"`.
- `webmcp-register.tsx:WebMcpRegister`: calls `navigator.modelContext.provideContext({ tools: TOOLS })` on mount.
- `webmcp-register.tsx:TOOLS.execute`: dynamically imports `@/lib/tasks` and calls `createTask`. It returns `id`, `quadrant`, and `createdAt`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
