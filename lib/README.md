# Lib

## Overview

This directory is the domain and data layer of the GSD task manager. It defines the task model, the Zod schemas, the Dexie database, and the operations on top of them. IndexedDB (database `GsdTaskManager`) is the source of truth. Cloud sync is optional and lives in the `sync` subdirectory.

The direct files here cover the database, schema, archive, trash, and reset flows. They also hold logging, filters, quadrants, the capture parser, top three, and weekly sweep. The `use-*` files are React hooks that bind this layer to the UI.

## Interface

Subdirectories:

- [Analytics](./analytics/README.md). Pure dashboard statistics over task arrays.
- [Constants](./constants/README.md). Schema limits, sync settings, and UI timings.
- [Feedback](./feedback/README.md). The anonymous feedback payload, draft store, nudge rule, and submit call.
- [Sync Hooks](./hooks/README.md). React hooks that expose sync state.
- [Notifications](./notifications/README.md). Reminder timing, display, permissions, settings, and the app badge.
- [Preferences](./preferences/README.md). Per-device preferences in `localStorage`.
- [Smart Views](./smart-views/README.md). Smart view types, built-in views, and icons.
- [Sync](./sync/README.md). PocketBase auth, push, pull, realtime, queue, and status. It contains [Sync Config](./sync/config/README.md).
- [Tasks](./tasks/README.md). Dependencies, subtasks, Saved, top three writes, and backup import and export. It contains [Task CRUD](./tasks/crud/README.md).
- [What's New](./whats-new/README.md). Release notes and the post-update cue.

Database, schema, archive, and trash (`db.ts`, `db-migrations.ts`, `schema.ts`, `types.ts`, `archive.ts`, `trash.ts`, `tasks.ts`, `id-generator.ts`, `zod.ts`, `constants.ts`):

- `db.ts:getDb(): GsdDatabase`. Returns the Dexie singleton. Tables: `tasks`, `archivedTasks`, `deletedTasks`, `smartViews`, `notificationSettings`, `syncQueue`, `syncMetadata`, `deviceInfo`, `archiveSettings`, `syncHistory`, `appPreferences`.
- `db-migrations.ts:registerDatabaseVersions(database: Dexie): void`. Registers schema versions 1 to 17 and their upgrade functions.
- `schema.ts:quadrantIdSchema`, `schema.ts:recurrenceTypeSchema`. Enums for the four quadrant ids and `none`, `daily`, `weekly`, `monthly`.
- `schema.ts:subtaskSchema`, `schema.ts:timeEntrySchema`. Schemas for subtasks and time entries.
- `schema.ts:taskDraftSchema`. Schema for user-editable task fields.
- `schema.ts:taskRecordSchema`. Strict schema for a stored task. Export uses it.
- `schema.ts:storedTaskRecordSchema`. Lenient (`.strip()`) schema for records read from IndexedDB or imported.
- `schema.ts:archivedTaskRecordSchema`, `schema.ts:storedArchivedTaskRecordSchema`. Strict and lenient schemas with `archivedAt`.
- `schema.ts:trashedTaskRecordSchema`, `schema.ts:storedTrashedTaskRecordSchema`. Strict and lenient schemas with `deletedAt`.
- `schema.ts:archiveSettingsSchema`, `schema.ts:appPreferencesSchema`, `schema.ts:notificationSettingsSchema`. Schemas for the three settings singletons.
- `schema.ts:filterCriteriaSchema`, `schema.ts:smartViewSchema`. Strict schemas for filter criteria and custom smart views.
- `schema.ts:importPayloadSchema`. Schema for the backup envelope.
- `types.ts`. Types `QuadrantId`, `RecurrenceType`, `Subtask`, `TimeEntry`, `TaskRecord`, `TaskDraft`, `ImportPayload`, `ImportablePayload`, `SmartViewRecord`, `NotificationSettings`, `ArchiveSettings`, `SyncHistoryRecord`, and `AppPreferences`.
- `archive.ts:getArchiveSettings(): Promise<ArchiveSettings>`. Reads archive settings and creates defaults when absent.
- `archive.ts:updateArchiveSettings(updates): Promise<void>`. Updates the settings row.
- `archive.ts:archiveOldTasks(daysOld: number): Promise<number>`. Moves completed tasks older than the cutoff into `archivedTasks`. Returns the count.
- `archive.ts:archiveTaskNow(taskId): Promise<void>`. Moves one live task into the archive.
- `archive.ts:restoreTask(taskId): Promise<void>`. Moves an archived task back to `tasks`.
- `archive.ts:listArchivedTasks()`, `archive.ts:getArchivedCount()`, `archive.ts:getArchivedStorageStats()`. Read the archive, its count, and its footprint.
- `archive.ts:deleteArchivedTask(taskId): Promise<void>`. Deletes an archived task for good.
- `archive.ts:reinstateArchivedTask(task): Promise<void>`. Undo for `deleteArchivedTask`.
- `archive.ts:ArchivedStorageStats`. Interface with `count` and `bytes`.
- `trash.ts:TRASH_RETENTION_DAYS`. The retention window, 30 days.
- `trash.ts:listTrashedTasks()`, `trash.ts:getTrashCount()`, `trash.ts:getTrashStorageStats()`. Read Trash, its count, and its footprint.
- `trash.ts:restoreFromTrash(taskId): Promise<void>`. Returns a trashed task to the board.
- `trash.ts:deleteFromTrashForever(taskId): Promise<void>`. Removes one trashed task for good.
- `trash.ts:emptyTrash(): Promise<number>`. Clears Trash and returns the count.
- `trash.ts:purgeExpiredTrash(): Promise<number>`. Drops rows past the retention window.
- `trash.ts:toTrashedRecord(task): TaskRecord`. Stamps a task with `deletedAt`.
- `tasks.ts`. Barrel. Re-exports the CRUD, subtask, dependency, and import and export functions from `./tasks/*`, plus the `ExportReport` type.
- `id-generator.ts:ID_LENGTH`, `id-generator.ts:generateId(): string`. A 12 character nanoid.
- `zod.ts:z`. Zod configured with `jitless: true`. All schemas import it from here.
- `constants.ts`. Constant objects `TIME_UNITS`, `TIME_MS`, `DND_CONFIG`, `SWIPE_CONFIG`, `TOAST_DURATION`, `NOTIFICATION_TIMING`, `NOTIFICATION_ASSETS`, `TIME_UTILS`, `DATE_CONFIG`, `SMART_VIEWS_CONFIG`, `ARCHIVE_CONFIG`, and `TIME_TRACKING`.

Reset, sync history, notification checker, caches, and environment (`reset-everything.ts`, `reset-local-data.ts`, `reset-lock.ts`, `sync-history.ts`, `notification-checker.ts`, `backup-download.ts`, `browser-cache.ts`, `sw-cache-logic.ts`, `env-config.ts`):

- `reset-everything.ts:resetEverything(options?: ResetOptions): Promise<ResetResult>`. Signs out of sync, wipes local data, and clears app-owned browser storage.
- `reset-everything.ts:reloadAfterReset(): void`. Navigates to `/` so the document is recreated.
- `reset-everything.ts:ResetOptions`, `reset-everything.ts:ResetStep`, `reset-everything.ts:ResetResult`. Options (`preserveTheme`), step names, and the result shape.
- `reset-local-data.ts:wipeLocalData(): Promise<LocalDataWipeResult>`. Clears every IndexedDB table and proves the data is gone.
- `reset-local-data.ts:LocalDataWipeResult`. Interface with `tables` and `errors`.
- `reset-lock.ts:RESET_PENDING_KEY`. Storage key `"gsd-reset-pending"`.
- `reset-lock.ts:ResetLockState`. Type `"unlocked" | "running" | "locked"`.
- `reset-lock.ts:startResetLock(preserveTheme)`, `reset-lock.ts:endResetLock(localDataDeleted)`. Lock the app before a reset and unlock it after.
- `reset-lock.ts:subscribeToResetLock`, `reset-lock.ts:getResetLockSnapshot`, `reset-lock.ts:getResetLockServerSnapshot`. The three parts of a `useSyncExternalStore` store.
- `reset-lock.ts:isResetPending(): boolean`. True while a reset runs or waits for a retry.
- `reset-lock.ts:readPendingPreserveTheme(): boolean`. Reads the theme choice of the pending reset.
- `sync-history.ts:recordSyncSuccess`, `sync-history.ts:recordSyncError`, `sync-history.ts:recordSyncPartial`. Add one row to `syncHistory`.
- `sync-history.ts:getRecentHistory(limit?)`, `sync-history.ts:getHistoryForDevice(deviceId, limit?)`, `sync-history.ts:getHistoryStats()`. Read sync history and totals.
- `sync-history.ts:clearHistory(): Promise<void>`. Clears `syncHistory`.
- `notification-checker.ts:notificationChecker`. Singleton with `checkAndNotify`, `start`, `stop`, `isRunning`, and `getLastCheckTime`.
- `notification-checker.ts:resetTaskNotification(taskId)`, `notification-checker.ts:snoozeTaskNotification(taskId, minutes)`. Reset or snooze one task's reminder state.
- `notification-checker.ts:getDueSoonCount(): Promise<number>`. Counts tasks inside their reminder window, for the badge.
- `backup-download.ts:downloadBackup(): Promise<BackupDownloadResult>`. Writes the backup to a downloaded file.
- `backup-download.ts:runBackupExport(): Promise<boolean>`. Downloads the backup and shows a toast for the outcome.
- `backup-download.ts:skippedRecordsWarning(skippedCount): string`, `backup-download.ts:EXPORT_SUCCESS_MESSAGE`, `backup-download.ts:BackupDownloadResult`. Shared export copy and result shape.
- `browser-cache.ts:clearAppCaches(): Promise<string[]>`. Deletes Cache Storage entries whose name starts with `gsd-`.
- `sw-cache-logic.ts:classifyRequest(pathname, acceptHeader, isSameOrigin, method, hasAuthorizationHeader?, cacheMode?): CacheClassification`. Returns `immutable`, `pages`, `runtime`, or `passthrough`.
- `sw-cache-logic.ts:getCacheNames(cacheVersion, immutableVersion): CacheNameSet`. Returns `gsd-immutable-v{n}`, `gsd-pages-v{version}`, and `gsd-runtime-v{version}`.
- `sw-cache-logic.ts:shouldDeleteCache(cacheName, currentCacheNames): boolean`. True for a stale `gsd-` cache.
- `sw-cache-logic.ts:getSafeLegacyCaptureUrl`, `sw-cache-logic.ts:isCapturePayloadUrl`, `sw-cache-logic.ts:getSafePageUrl`. The two `getSafe*` functions strip capture payloads and fragments from page URLs. `isCapturePayloadUrl` strips nothing: it returns true when the query or the fragment carries `action=capture`.
- `sw-cache-logic.ts:isShareTargetPost(pathname, method, isSameOrigin): boolean`. True for a same-origin POST to `/share-target/`.
- `sw-cache-logic.ts:getShareCaptureUrl(origin, fields): string`. Builds the capture URL for shared content.
- `sw-cache-logic.ts:getEvictionCandidates<T>(keys, maxEntries): T[]`. Returns the oldest keys over the limit.
- `sw-cache-logic.ts:CacheClassification`, `sw-cache-logic.ts:CacheNameSet`, `sw-cache-logic.ts:ShareFields`. Supporting types.
- `env-config.ts:ENV_CONFIG`. Environment config computed once on module load.
- `env-config.ts:getEnvironmentConfig(): EnvironmentConfig`. Detects the environment and resolves the PocketBase URL.
- `env-config.ts:Environment`, `env-config.ts:EnvironmentConfig`. Supporting types.

Logging, dependencies, filters, quadrants, capture parser, and dates (`logger.ts`, `error-logger.ts`, `dependencies.ts`, `filters.ts`, `quadrants.ts`, `smart-views.ts`, `capture-parser.ts`, `escalation.ts`, `due-time.ts`, `due-date-presets.ts`, `snooze-presets.ts`):

- `logger.ts:createLogger(context: LogContext, minLevel?: LogLevel): Logger`. Creates a logger for one context.
- `logger.ts:Logger`. Class with `debug`, `info`, `warn`, `error`, and `child`.
- `logger.ts:maskSensitiveString(value): string`. Masks tokens, authorization values, API keys, and bearer tokens in a string.
- `logger.ts:sanitizeMetadata(metadata?): LogMetadata | undefined`. Replaces sensitive and task-content values with `***`.
- `logger.ts:generateCorrelationId(): string`. Returns a timestamp, counter, and random suffix.
- `logger.ts:LogLevel`, `logger.ts:LogContext`, `logger.ts:LogMetadata`. Supporting types.
- `error-logger.ts:logError(error, context: ErrorContext): LoggedError`. Logs an error with structured context to the console.
- `error-logger.ts:getUserErrorMessage(error, defaultMessage): string`. Maps known errors to user-facing messages.
- `error-logger.ts:ErrorActions`, `error-logger.ts:ErrorMessages`. Constant maps of action names and user-facing messages.
- `error-logger.ts:ErrorContext`, `error-logger.ts:LoggedError`. Supporting types.
- `dependencies.ts:wouldCreateCircularDependency(taskId, dependencyId, allTasks): boolean`. Breadth-first check for a dependency cycle.
- `dependencies.ts:validateDependencies(taskId, dependencies, allTasks)`. Returns `{ valid, error? }`.
- `dependencies.ts:getBlockingTasks`, `dependencies.ts:getBlockedTasks`, `dependencies.ts:getUncompletedBlockingTasks`, `dependencies.ts:getUncompletedBlockedTasks`. Return the tasks on either side of a dependency edge.
- `dependencies.ts:isTaskBlocked`, `dependencies.ts:isTaskBlocking`, `dependencies.ts:getReadyTasks`. Blocked, blocking, and ready checks.
- `filters.ts:applyFilters(tasks, criteria: FilterCriteria, allTasks?): TaskRecord[]`. Applies every filter criterion in sequence.
- `filters.ts`. Re-exports `QuadrantId`, `RecurrenceType`, `FilterCriteria`, `SmartView`, and `BUILT_IN_SMART_VIEWS`.
- `quadrants.ts:quadrants`. Array of four `QuadrantMeta` entries (Do First, Schedule, Delegate, Eliminate).
- `quadrants.ts:quadrantOrder`. The four quadrant ids in matrix order.
- `quadrants.ts:resolveQuadrantId(urgent, important): QuadrantId`. Maps the two flags to a quadrant id.
- `quadrants.ts:parseQuadrantFlags(quadrantId)`. The inverse of `resolveQuadrantId`.
- `quadrants.ts:quadrantForTask(urgent, important)`, `quadrants.ts:quadrantByRdKey(key)`. Look up a `QuadrantMeta`.
- `quadrants.ts:QUADRANT_ACCENT`, `quadrants.ts:QUADRANT_INK`, `quadrants.ts:QUADRANT_WASH`, `quadrants.ts:QUADRANT_HEADER`, `quadrants.ts:QUADRANT_ACCENT_BY_ID`. CSS variable names per quadrant.
- `quadrants.ts:QuadrantMeta`, `quadrants.ts:RedesignQuadrantKey`, `quadrants.ts:RedesignIconKey`. Supporting types.
- `smart-views.ts:getSmartViews(): Promise<SmartView[]>`. Returns built-in views first, then valid custom views.
- `smart-views.ts:getSmartView(id): Promise<SmartView | undefined>`. Returns one view by id.
- `smart-views.ts:getAppPreferences()`, `smart-views.ts:updateAppPreferences(updates)`. Read and write the app preferences row.
- `smart-views.ts:APP_PREFERENCES_EVENT`, `smart-views.ts:AppPreferencesEventDetail`. Event name `"gsd:app-preferences"` and its detail type.
- `capture-parser.ts:parseCapture(input): ParsedCapture`. Parses `!!`, `!`, `*`, and `#tag` tokens from capture text.
- `capture-parser.ts:extractUrlsFromTitle(title): ExtractedUrls`. Removes safe http and https URLs from a title.
- `capture-parser.ts:buildDescription(existing, urls): string`. Appends extracted URLs to a description.
- `capture-parser.ts:ParsedCapture`, `capture-parser.ts:ExtractedUrls`. Result types.
- `escalation.ts:evaluateEscalation(task, now, windowDays, timeZone): EscalationResult`. Decides whether a task is escalating by due date.
- `escalation.ts:daysUntilDue(dueDate, now, timeZone): number | null`. Local calendar days until the due date.
- `escalation.ts:escalationLabel(days): string`. The escalation tag's accessible name.
- `escalation.ts:EscalationTarget`, `escalation.ts:EscalationResult`, `escalation.ts:EscalationTask`. Supporting types.
- `due-time.ts:combine(day, time)`, `due-time.ts:timeOf(iso)`, `due-time.ts:onDate(iso, day)`, `due-time.ts:atTime(iso, time)`, `due-time.ts:formatTimeOf(iso, locale?)`. Build and read a due date's day and optional time of day.
- `due-date-presets.ts:DUE_PRESETS`, `due-date-presets.ts:DuePreset`. The presets `none`, `today`, `this-week`, and `next-week`.
- `due-date-presets.ts:resolveDuePreset(preset, now?): string | undefined`. Returns the preset's `YYYY-MM-DD` day.
- `due-date-presets.ts:localDayOf(iso): string`. The local calendar day of an ISO timestamp.
- `snooze-presets.ts:SNOOZE_PRESETS`. Six presets: 15 minutes, 30 minutes, 1 hour, 3 hours, Tomorrow, and Next week.

Top three, weekly sweep, commands, routes, and utilities (`top-three.ts`, `top-three-session.ts`, `weekly-sweep.ts`, `command-actions.ts`, `routes.ts`, `utils.ts`, `task-links.ts`, `share-capture.ts`, `bookmarklet.ts`, `apple-identity.ts`, `confetti.ts`, `dnd-drop-target.ts`, `focus-restoration.ts`, `pane-overflow.ts`, `prefers-reduced-motion.ts`, `task-card-memo.ts`, `swipe-gesture.ts`):

- `top-three.ts:MAX_PICKS`. The number of slots, 3.
- `top-three.ts:todaysPicks(tasks, now, zone): TodaysPicks`. Returns today's `picks`, `overflow`, and `needsTidy`.
- `top-three.ts:nextRank(tasks, now, zone): number | null`. The lowest free rank, or `null` when today is full.
- `top-three.ts:tidy(tasks, now, zone): FocusWrite[]`. The writes that give the first three picks ranks 1 to 3 and clear the overflow.
- `top-three.ts:suggest(tasks, now, windowDays, zone): string[]`. Suggested task ids in order.
- `top-three.ts:carryOver(tasks, now, zone): CarryOver`. The latest earlier pick date within seven local days.
- `top-three.ts:fromWire(wire)`, `top-three.ts:toWire(task)`, `top-three.ts:pushFocus(current)`. Map the focus pair to and from the wire.
- `top-three.ts:unreadFieldsToCopy(storedContract, local, remote): PullMergeResult`. Decides which never-read fields a newer local row copies.
- `top-three.ts:pullMerge(input: PullMergeInput): PullMergeResult`. Decides one pulled record against its local row.
- `top-three.ts`. Types `TopThreeTask`, `TodaysPicks`, `CarryOver`, `FocusWrite`, `WireFocus`, `PullRow`, `PullMergeInput`, and `PullMergeResult`.
- `top-three-session.ts:tidyDismissal`. In-memory store with `isDismissed`, `dismiss`, `reset`, and `subscribe`.
- `weekly-sweep.ts:sweepCards(tasks, now, windowDays, zone): SweepCard[]`. Returns one card per task that needs a decision, grouped by reason.
- `weekly-sweep.ts:entryShown(lastSweptAt, cardCount, now, zone): boolean`. True with at least one card and no sweep in the last seven local days.
- `weekly-sweep.ts:nextReminder(reminder, now, zone): Date | null`. The next reminder occurrence after `now`.
- `weekly-sweep.ts:dueSweepOccurrence(reminder, now, zone): Date | null`. The reminder occurrence from the last 60 minutes.
- `weekly-sweep.ts:SweepCard`, `weekly-sweep.ts:SweepReminder`. Card (`id`, `reason`) and reminder (`enabled`, `weekday`, `time`) shapes.
- `command-actions.ts:buildCommandActions(handlers, builtInSmartViews, conditions): CommandAction[]`. Builds the command palette's action list.
- `command-actions.ts:CommandAction`, `command-actions.ts:CommandActionHandlers`, `command-actions.ts:CommandSection`. Supporting types.
- `routes.ts:ROUTES`. Routes `HOME`, `DASHBOARD`, `SAVED`, `SWEEP`, `SETTINGS`, and `ABOUT`.
- `routes.ts:ROUTE_VARIANTS`, `routes.ts:isRouteActive(pathname, route): boolean`, `routes.ts:RouteKey`. Pathname variants for the static export and a matcher.
- `utils.ts:cn(...classNames): string`. Merges class names with `clsx` and an extended `tailwind-merge`.
- `utils.ts:isoNow()`, `utils.ts:formatErrorMessage(error)`, `utils.ts:isRepeatClick(event)`, `utils.ts:hasVisibleText(value)`. Small helpers.
- `utils.ts:formatDueDate(value?)`, `utils.ts:formatRelative(value?)`. Format a due date.
- `utils.ts:isOverdue(value?)`, `utils.ts:daysOverdue(value?)`, `utils.ts:isDueToday(value?)`, `utils.ts:isDueThisWeek(value?)`. Due date checks.
- `task-links.ts:sanitizeHttpUrl(candidate): string | null`. Returns a safe http or https URL, or `null`.
- `task-links.ts:getDescriptionSegments(description): DescriptionSegment[]`. Splits a description into text and link segments.
- `task-links.ts:DescriptionSegment`. Union of text and link segments.
- `share-capture.ts:parseShareCaptureParams(params: URLSearchParams): TaskDraft | null`. Parses capture fragment params into a draft.
- `bookmarklet.ts:buildBookmarkletHref(origin, tags): string`. Builds the `javascript:` bookmarklet link.
- `apple-identity.ts:isRelayEmail(email)`, `apple-identity.ts:accountNote(provider, email)`, `apple-identity.ts:accountNoteText(note)`, `apple-identity.ts:AccountNote`. Decide and word the note for an Apple sign-in.
- `confetti.ts:celebrateCompletion(): void`. Fires the completion confetti.
- `dnd-drop-target.ts:containerOf(node)`, `dnd-drop-target.ts:resolveDropQuadrant(over)`, `dnd-drop-target.ts:quadrantTitle(id)`. Resolve a drag node or drop target to a quadrant.
- `focus-restoration.ts:restoreFocusOrMainContent(origin): void`. Returns focus to the opener, or to `#main-content`.
- `pane-overflow.ts:resolvePaneOverflow(sample: PaneScrollSample): boolean`. True when a pane has more content below the visible edge.
- `prefers-reduced-motion.ts:prefersReducedMotion(): boolean`. Reads the OS reduced-motion setting.
- `task-card-memo.ts:TaskCardProps`. The canonical props interface for the task card component.
- `swipe-gesture.ts:lockDirection`, `swipe-gesture.ts:clampSwipeOffset`, `swipe-gesture.ts:resolveSwipeEnd`, `swipe-gesture.ts:beginSwipe`, `swipe-gesture.ts:trackSwipe`, `swipe-gesture.ts:endSwipe`. Pure swipe gesture math.
- `swipe-gesture.ts:LEADING_REVEAL`, `swipe-gesture.ts:TRAILING_REVEAL`, and types `SwipeDirection`, `SwipeOutcome`, `SwipePointer`, `SwipeDrag`.

React hooks (`use-tasks.ts`, `use-auto-archive.ts`, `use-notification-checker.ts`, `use-app-shortcuts.ts`, `use-keyboard-shortcuts.ts`, `use-command-palette.ts`, `use-shell-command-handlers.ts`, `use-drag-and-drop.ts`, `use-error-handler.ts`, `use-view-transition.ts`, `use-scroll-chrome.ts`, `use-count-up.ts`, `use-is-hydrated.ts`):

- `use-tasks.ts:useTasks(): TaskBuckets`. Live query over `tasks`. Returns `all`, `stored`, `saved`, `byQuadrant`, and `isLoading`.
- `use-tasks.ts:keepValidTaskRecords(rows): TaskRecord[]`. Drops records that fail `storedTaskRecordSchema`.
- `use-tasks.ts:TaskBuckets`. The result shape of `useTasks`.
- `use-auto-archive.ts:useAutoArchive()`. Purges expired trash and archives old completed tasks on a schedule.
- `use-notification-checker.ts:useNotificationChecker(): void`. Starts the notification checker on mount and stops it on unmount.
- `use-app-shortcuts.ts:useAppShortcuts(handlers: AppShortcutHandlers): void`. Binds the Option key shortcuts.
- `use-app-shortcuts.ts:isEditableShortcutTarget(target): boolean`, `use-app-shortcuts.ts:hasOpenModal(): boolean`. Guards that suppress shortcuts.
- `use-app-shortcuts.ts:AppShortcutHandlers`. Handlers `onSearch`, `onCapture`, `onReview`, and `onFocusQuadrant`.
- `use-keyboard-shortcuts.ts:useKeyboardShortcuts(handlers, searchInputRef?)`. Binds `n`, `/`, and `?`.
- `use-command-palette.ts:useCommandPalette({ actions, tasks, onSelectTask })`. Manages palette state, filtering, and focus return.
- `use-command-palette.ts:OPEN_COMMAND_PALETTE_EVENT`. Event name `"gsd:open-command-palette"`.
- `use-shell-command-handlers.ts:useShellCommandHandlers(): ShellCommandResult`. Builds the palette and shortcut handlers for the app shell.
- `use-shell-command-handlers.ts:NEW_TASK_EVENT`, `HIGHLIGHT_TASK_EVENT`, `APPLY_SMART_VIEW_EVENT`, `FOCUS_CAPTURE_EVENT`, `FOCUS_QUADRANT_EVENT`. Window event names `gsd:new-task`, `gsd:highlight-task`, `gsd:apply-smart-view`, `gsd:focus-capture`, and `gsd:focus-quadrant`.
- `use-shell-command-handlers.ts:ApplySmartViewEventDetail`, `FocusQuadrantEventDetail`, `ShellShortcutHandlers`. Supporting types.
- `use-drag-and-drop.ts:useDragAndDrop(onError: DragErrorHandler)`. Returns `sensors`, `activeId`, `statusMessage`, `announcements`, `handleDragStart`, and `handleDragEnd`.
- `use-drag-and-drop.ts:DragErrorHandler`. Error callback type.
- `use-error-handler.ts:useErrorHandler()`. Returns a function that logs an error and shows a toast.
- `use-error-handler.ts:useErrorHandlerWithUndo()`. Returns `handleError` and `handleSuccess` (a toast with an Undo action).
- `use-view-transition.ts:useViewTransition()`. Returns `navigateWithTransition` and `isPending`.
- `use-scroll-chrome.ts:useScrollChrome(enabled: boolean): boolean`. True when the topbar should be hidden.
- `use-scroll-chrome.ts:resolveChromeHidden(sample: ChromeScrollSample): boolean`, `use-scroll-chrome.ts:SCROLL_CHROME`. The pure rule and its thresholds.
- `use-count-up.ts:useCountUp(target, duration = 500): string`. Animates a number from 0 to the target on mount.
- `use-is-hydrated.ts:useIsHydrated(): boolean`. False on the server snapshot, true after hydration.

## Invariants

Database, schema, archive, and trash:

- `db-migrations.ts:registerDatabaseVersions` sets the current schema version to 17. Version 16 added `deletedTasks`, and version 17 added the `savedAt` index on `tasks`.
- `db-migrations.ts:DELETED_TASKS` indexes `deletedAt`, because the retention sweep queries a range (ADR 0015).
- `db-migrations.ts:findResurrectedTaskIds` (version 15) deletes a live duplicate of an archived id only when the task is still archivable: completed, with a `completedAt` before the cutoff.
- `db-migrations.ts:migratePocketBase` (version 13) clears `syncQueue`, resets `sync_config`, and removes `vectorClock` from task rows.
- `db.ts:getDb` throws when `indexedDB` is undefined.
- `schema.ts:taskRecordSchema` is `.strict()`. `schema.ts:storedTaskRecordSchema` is `.strip()`, so a record with a harmless extra field is kept.
- `schema.ts:archivedTaskRecordSchema` is the only strict schema that declares `archivedAt`. Validating archived rows with `taskRecordSchema` rejects every one, silently.
- `schema.ts:importPayloadSchema` treats every store beyond `tasks` as optional. An absent key means the backup says nothing about that store, which differs from an empty array (ADR 0014).
- `schema.ts:importPayloadSchema` accepts `version` as a string or a number and normalizes it to a string.
- `schema.ts:importPayloadSchema.smartViews` is deliberately unvalidated. One bad view must not abort the tasks, archive, trash, and settings in the same file.
- `schema.ts:deriveQuadrant` fills in `quadrant` from `urgent` and `important` when an imported task omits it. It runs only at the import boundary.
- `schema.ts:normalizeFocusPair` turns an invalid `focusDate` and `focusRank` pair into neither field at the import boundary. `storedFocusFields` reads a bad stored value as unset.
- `schema.ts:taskDraftSchema` limits `focusRank` to 1 through 3 and `estimatedMinutes` to 1 through 10080. An estimate of 0 reads as unset.
- `schema.ts:smartViewSchema` requires `isBuiltIn: false`. Built-in views are derived at read time and never stored.
- `schema.ts:archiveSettingsSchema` limits `archiveAfterDays` to 30, 60, or 90.
- `zod.ts` sets `jitless: true`, so Zod never probes `new Function` under the production CSP.
- `archive.ts:archiveOldTasks`, `archive.ts:restoreTask`, and `archive.ts:archiveTaskNow` each run one `rw` transaction over `tasks`, `archivedTasks`, and `syncQueue`.
- `archive.ts:restoreTask` and `archive.ts:archiveTaskNow` resolve the sync config and queue before the transaction opens. Awaiting a non-Dexie promise inside a transaction lets it commit early.
- `archive.ts:archiveOldTasks` writes with `bulkPut`, not `bulkAdd`. One duplicate key would abort every archive run on the device.
- `archive.ts:chooseArchiveSnapshot` never replaces an existing archived row with an older or unparseable live copy.
- `archive.ts:archiveOldTasks` skips tasks with `savedAt` and tasks without `completedAt`.
- `archive.ts:archiveOldTasks` and `archive.ts:archiveTaskNow` enqueue a remote `delete` that carries the task. `archive.ts:restoreTask` enqueues an `update`. All three enqueue only when sync is enabled.
- `archive.ts:reinstateArchivedTask` writes only when the id is absent, inside one transaction on `archivedTasks`. It enqueues nothing, because `archivedTasks` is never synced.
- `trash.ts:TRASH_RETENTION_DAYS` is deliberately not configurable. Trash retention is a safety floor (ADR 0015).
- `trash.ts:restoreFromTrash` runs one transaction over `tasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`. An id lives in exactly one lifecycle table (ADR 0013).
- `trash.ts:restoreFromTrash`, `deleteFromTrashForever`, `emptyTrash`, and `purgeExpiredTrash` each call `forgetForResurrect` in the same transaction as the Trash write.
- `trash.ts:purgeExpiredTrash` compares instants, not strings, and keeps a row whose `deletedAt` is missing or unparseable.

Reset, sync history, notification checker, caches, and environment:

- `reset-everything.ts:runResetSteps` runs three steps in order: sync sign-out, local data, browser storage. Each step catches and reports its own errors.
- `reset-everything.ts:resetEverything` puts the reset lock on before the first step. The lock comes off only when local data is verified gone, so a failed step or a closed tab leaves GSD locked.
- `reset-everything.ts:shouldSkipLocalStorageKey` removes only app-owned keys: `pocketbase_auth`, `theme`, and keys that start with `gsd-` or `gsd:`. It never removes the reset marker, and keeps `gsd-theme` when `preserveTheme` is set.
- `reset-local-data.ts:clearTables` clears every table in one `rw` transaction over all tables. It keeps `deviceId` in a fresh, signed-out `sync_config` row.
- `reset-local-data.ts:wipeIndexedDb` deletes the whole database when the clear cannot be verified. A reset never reports success while tasks remain.
- `reset-local-data.ts:deleteUnlessBlocked` fails instead of waiting when another open tab blocks the delete.
- `reset-local-data.ts:wipeLocalData` also calls `resetWeeklySweepState`, because sweep state lives outside IndexedDB.
- `reset-lock.ts:endResetLock` unlocks only when local data is gone. Otherwise the app stays locked until a retry succeeds.
- `reset-lock.ts:readStoredMarker` counts an unreadable store as no marker, so a browser with storage disabled never locks for good.
- `reset-lock.ts:readPendingPreserveTheme` keeps the theme when the marker is missing or malformed.
- `sync-history.ts:cleanupOldRecords` keeps the newest 100 records (`MAX_HISTORY_RECORDS`). `getRecentHistory` caps its limit at the same value.
- `notification-checker.ts:processNotifications` returns early while a reset is pending, when notifications are unsupported, or when permission is not granted.
- `notification-checker.ts:processNotifications` filters `tasks` in memory. `completed` is a boolean, and IndexedDB cannot index booleans.
- `notification-checker.ts:checkSweepReminder` fires whether task reminders are on or off, and quiet hours do not defer it. One occurrence fires once.
- `notification-checker.ts:markNotificationSent` reads and writes in one transaction on `tasks` and writes only the reminder fields. `isSameReminder` skips the mark when the task changed.
- `notification-checker.ts:checkAndNotify` never overlaps itself (`isChecking`). `start` does nothing when already running.
- `backup-download.ts:runBackupExport` always reports skipped records. A skipped record must never vanish quietly.
- `sw-cache-logic.ts` is the canonical source for service worker cache routing. `scripts/generate-sw-cache-logic.cjs` generates `public/sw-cache-logic.js` from it. Edit only this file.
- `sw-cache-logic.ts:classifyRequest` passes through non-GET, cross-origin, authorized, `no-store`, `/api`, and `/_` requests.
- `sw-cache-logic.ts:getSafePageUrl` strips the fragment. Page fragments are client state and must never become Cache API keys.
- `sw-cache-logic.ts:getShareCaptureUrl` puts shared content in the fragment, which never reaches a request, a log, or a cache key.
- `env-config.ts:resolvePocketBaseUrl` maps `gsd.vinny.dev` to `https://api.vinny.io`. An unmapped production host falls back to same-origin, over HTTP or HTTPS, so data never goes to an unrelated default backend.
- `env-config.ts:getEnvironmentConfig` lets `NEXT_PUBLIC_POCKETBASE_URL` override the resolved URL.

Logging, dependencies, filters, quadrants, capture parser, and dates:

- `logger.ts:sanitizeMetadata` masks any key that matches `SENSITIVE_KEY_PATTERN` (token, password, email, session, and similar). It also masks task content keys `title`, `description`, `tags`, `subtasks`, and `notes` (SEC-011).
- `logger.ts:TASK_CONTENT_KEY_PATTERN` matches exact key names, so diagnostic keys such as `titleLength` stay readable.
- `logger.ts:formatLogPrefix` takes the sanitized metadata, never the caller's. `tests/data/sync/pb-push.test.ts` asserts a task title never reaches it.
- `logger.ts:Logger.error` logs to the console only. Nothing leaves the device. The stack is omitted in production.
- `logger.ts:getMinLogLevel` is `info` in production or on a non-localhost host, and `debug` otherwise.
- `error-logger.ts:logError` passes both the summary string and the metadata through the logger's masking.
- `dependencies.ts:wouldCreateCircularDependency` treats a self-dependency as circular. It uses an iterative breadth-first search with a visited set.
- `dependencies.ts:validateDependencies` rejects a self-reference, a missing dependency task, and a cycle.
- `dependencies.ts:getUncompletedBlockedTasks` does not count a completed dependent. A dependency edge outlives the work it described.
- `filters.ts:filterByTags` requires a task to have all the given tags. `filterByOverdue`, `filterByDueToday`, and `filterByDueThisWeek` exclude completed tasks.
- `quadrants.ts:resolveQuadrantId` derives the quadrant from `urgent` and `important`: both is `urgent-important`, important only is `not-urgent-important`, urgent only is `urgent-not-important`, neither is `not-urgent-not-important`.
- `quadrants.ts:QUADRANT_INK` is for quadrant titles set as text. `QUADRANT_ACCENT` is for fills, rules, and spines.
- `smart-views.ts:getSmartViews` reads at most `MAX_SMART_VIEWS + 1` rows. When the store holds more than the limit it returns only built-in views.
- `smart-views.ts:getSmartViews` gives built-in views the id `built-in-{name in kebab case}` and a fixed date. It drops stored rows that fail `smartViewSchema`.
- `smart-views.ts:getAppPreferences` states that custom view creation and pinning are deliberately absent on the web. The stored pin fields stay for data continuity.
- `capture-parser.ts:sanitizeTitleUrl` accepts only http and https URLs with a hostname and no credentials. It rejects URLs of 2048 characters or more.
- `capture-parser.ts:sanitizeTitleUrl` returns the raw trimmed URL, not `url.href`, so captures stay byte-identical across platforms.
- `capture-parser.ts:extractUrlsFromTitle` leaves unsafe candidates in the title and deduplicates repeats. A title that becomes empty reads `"Review link below"`.
- `capture-parser.ts:parseCapture` lowercases and deduplicates tags, drops tags over 30 characters, and caps the list at 20. Dropped tags are still stripped from the title.
- `capture-parser.ts:TAG_PATTERN` is pinned by `tests/fixtures/cross-platform/capture-parser-corpus.json`.
- `capture-parser.ts:parseCapture` maps `!!` to urgent and important, `!` to urgent, and `*` to important.
- `escalation.ts:evaluateEscalation` is a pure signal and never changes a task. iOS and Android implement the same rule against `tests/fixtures/cross-platform/escalation-corpus.json`.
- `escalation.ts:evaluateEscalation` never escalates a completed, saved, or already urgent task, or any task while the window is `null` (Off).
- `due-time.ts:timeOf` treats a due date as all day only when hour, minute, second, and millisecond are all zero in local time. Nothing extra is stored (D-1).
- `due-date-presets.ts:resolveDuePreset` maps `this-week` to the coming Friday (Saturday rolls to the next Friday) and `next-week` to the next Monday strictly after today.

Top three, weekly sweep, commands, routes, and utilities:

- `top-three.ts` holds pure functions that never change a task. iOS and Android implement the same rules against `tests/fixtures/cross-platform/top-three-corpus.json`.
- `top-three.ts` expects callers to pass only rows from the active store. No selector reads archived or trashed rows.
- `top-three.ts:hasPick` requires a real calendar date and a rank from 1 to 3. `isEligible` excludes completed and saved tasks.
- `top-three.ts:byConflictRule` orders picks by lowest rank, then newest `updatedAt`, then id. This is the two-device conflict rule.
- `top-three.ts:tidy` writes nothing for a gap in ranks alone, and skips rows that are already right.
- `top-three.ts:suggest` orders suggestions: overdue Q1, escalating, Q1 with a due date, then the rest of Q1.
- `top-three.ts:carryOver` is an offer, never a write. It looks back at most 7 local days.
- `top-three.ts:toWire` sends unset as `""` and `0`, because PocketBase never stores a null number. `fromWire` turns an invalid pair into both fields unset.
- `top-three.ts:pushFocus` takes the focus keys from the current row, never the queued payload. With no current row, both keys stay off the wire.
- `top-three.ts:pullMerge` lets a strictly newer remote win. The same version takes the remote only while a backfill is due.
- `top-three.ts:unreadFieldsToCopy` copies focus fields only below `FOCUS_CONTRACT_VERSION` and `savedAt` only below `SAVED_AT_CONTRACT_VERSION`, and only into empty local fields.
- `top-three-session.ts:tidyDismissal` lives in memory only. Nothing is written to a task or to disk, so the offer returns on the next launch.
- `weekly-sweep.ts` is pure and never changes a task. iOS and Android implement the same rule against `tests/fixtures/cross-platform/sweep-corpus.json`.
- `weekly-sweep.ts` counts every age in local calendar days in the given zone, never elapsed time.
- `weekly-sweep.ts:reasonFor` gives each task at most one card. A task with `savedAt` gets only saved, or no card. Any other task gets the first match of overdue, escalating, stale, undated schedule.
- `weekly-sweep.ts` thresholds: stale at 14 days, saved at 30 days, entry shown after 7 days.
- `weekly-sweep.ts:SweepReminder.weekday` is ISO, where 1 is Monday and 7 is Sunday.
- `weekly-sweep.ts:dueSweepOccurrence` returns only an occurrence from the last 60 minutes. A missed occurrence does not fire later.
- `weekly-sweep.ts:wallTimeToInstant` shifts a time in a daylight-saving gap forward, and takes the first occurrence in an overlap.
- `command-actions.ts:buildCommandActions` adds the sync actions only when `isSyncEnabled` is true and the handler exists. Smart view labels carry the name only, with no glyph.
- `utils.ts:cn` extends `tailwind-merge` with the Inkwell type ramp: `display`, `h1`, `h2`, `h3`, `body`, `small`, `caption`, `eyebrow`. A ramp class is then not dropped next to a text color.
- `utils.ts:formatRelative` and `utils.ts:daysOverdue` count calendar days, not 24 hour blocks.
- `utils.ts:isDueThisWeek` includes overdue tasks.
- `task-links.ts:sanitizeHttpUrl` accepts only http and https URLs with a hostname, no credentials, no control characters, and at most 2048 characters.
- `task-links.ts:getDescriptionSegments` renders at most twice `TASK_DESCRIPTION_MAX_LENGTH` characters.
- `share-capture.ts:parseShareCaptureParams` reads capture details from the URL fragment. Fragments never enter requests, access logs, referrers, or cache keys.
- `share-capture.ts:parseShareCaptureParams` returns a draft that is neither urgent nor important, with a clamped title and at most 20 tags.
- `bookmarklet.ts:buildBookmarkletHref` percent-encodes the whole source and opens GSD with `noopener,noreferrer`.
- `apple-identity.ts:accountNote` returns a note only for the `apple` provider. It mirrors the iOS `AppleIdentity`.
- `confetti.ts` creates the confetti with `useWorker: false`, because the CSP blocks a blob worker. It does nothing under reduced motion or without a 2D canvas.
- `confetti.ts:loadLibrary` clears a failed load, so the next celebration retries the import.
- `dnd-drop-target.ts:resolveDropQuadrant` resolves a card drop target through its sortable container. Keyboard dragging resolves `over` to a neighboring card, not a pane.
- `pane-overflow.ts:resolvePaneOverflow` treats a position within 1 pixel of the bottom as at the bottom.
- `swipe-gesture.ts` matches the iOS `SwipeRevealRow` rules. A leading swipe reveals one button and commits on a full swipe. A trailing swipe reveals two and is tap only.
- `swipe-gesture.ts:lockDirection` gives ties to the vertical scroller.

React hooks:

- `use-tasks.ts:useTasks` passes no default result to `useLiveQuery`. A default would pin `isLoading` to false and show empty states before IndexedDB is read.
- `use-tasks.ts:useTasks` keeps saved tasks (`savedAt` set) out of `all` and `byQuadrant`. `stored` holds every valid row.
- `use-tasks.ts:keepValidTaskRecords` uses the lenient schema, so a record with a harmless legacy field is kept.
- `use-auto-archive.ts` archives only after a completed pull while sync is on, at most once an hour (B-46). A sweep from stale local data could delete a task that another device reopened.
- `use-auto-archive.ts:runScheduledCheck` always purges trash, on mount and hourly. Trash retention is not gated on the archive toggle (ADR 0015).
- `use-auto-archive.ts:syncIsOn` assumes sync is on when its state cannot be read, so archiving waits for a pull.
- `use-app-shortcuts.ts:useAppShortcuts` matches physical key codes, because macOS Option changes `event.key`. It handles Option with Slash, N, R, and digits 1 to 4.
- `use-app-shortcuts.ts:shouldIgnore` and `use-keyboard-shortcuts.ts:useKeyboardShortcuts` ignore repeats, composition, editable targets, and any key press behind an open modal.
- `use-keyboard-shortcuts.ts:useKeyboardShortcuts` ignores keys pressed with Meta, Ctrl, or Alt.
- `use-command-palette.ts:useCommandPalette` shows task matches only for a search of 2 or more characters, limited to active tasks and `MAX_COMMAND_PALETTE_RESULTS`.
- `use-command-palette.ts:executeAction` drops the focus return target for a `handoff` action. The destination owns focus.
- `use-shell-command-handlers.ts:useShellCommandHandlers` dispatches a window event on the matrix route and navigates with a query string elsewhere.
- `use-shell-command-handlers.ts:onImportTasks` only navigates to `/settings#data`. Import needs the merge or replace confirmation there.
- `use-drag-and-drop.ts:useDragAndDrop` announces the outcome only after the write settles. The drag-end announcement reports intent.
- `use-drag-and-drop.ts:handleDragEnd` writes nothing when the drop target is not a quadrant or is the task's current quadrant.
- `use-view-transition.ts:navigateWithTransition` adds a trailing slash to routes for the static export, and falls back to `router.push` without the View Transitions API.
- `use-scroll-chrome.ts:useScrollChrome` is inert unless `enabled` and at widths above 767 px. It samples scroll once per animation frame.
- `use-scroll-chrome.ts:resolveChromeHidden` never hides within the top 64 px of scroll and ignores movement under 8 px.
- `use-count-up.ts:useCountUp` renders 0 during hydration, so the first client render matches the static export. It skips animation under reduced motion.

## Side Effects

Database, schema, archive, and trash:

- `db.ts:getDb` opens the IndexedDB database `GsdTaskManager` and keeps the instance in module state.
- `db-migrations.ts` upgrade functions rewrite rows in `tasks`, `archivedTasks`, `syncQueue`, `syncMetadata`, `deviceInfo`, `archiveSettings`, and `appPreferences` when a version upgrade runs.
- `archive.ts` reads and writes `tasks`, `archivedTasks`, `archiveSettings`, and `syncQueue`. `getArchiveSettings` writes default settings on first read.
- `trash.ts` reads and writes `deletedTasks`, `tasks`, `syncQueue`, and the remembered-ids row in `syncMetadata`. It logs through the `TASK_CRUD` logger.
- `zod.ts` changes Zod's global config on import.
- `schema.ts`, `types.ts`, `tasks.ts`, `id-generator.ts`, and `constants.ts`: None.

Reset, sync history, notification checker, caches, and environment:

- `reset-everything.ts:resetEverything` calls `disableSync()`, clears or deletes IndexedDB, removes app-owned `localStorage` keys, and resets feedback state.
- `reset-everything.ts:reloadAfterReset` sets `window.location.href`.
- `reset-local-data.ts:wipeLocalData` clears every Dexie table, may delete the database, and removes the weekly sweep keys from `localStorage`.
- `reset-lock.ts` reads and writes the `gsd-reset-pending` key and listens to `storage` events on `window`.
- `sync-history.ts` reads and writes the `syncHistory` table.
- `notification-checker.ts:notificationChecker` runs a `setInterval` (1 minute by default), reads `tasks` and `notificationSettings`, updates reminder fields on `tasks`, shows notifications, and sets the app badge.
- `notification-checker.ts:resetTaskNotification` and `snoozeTaskNotification` write `tasks` directly, with no sync queue entry.
- `backup-download.ts:downloadBackup` creates a Blob URL, clicks a temporary anchor to download `gsd-tasks-{timestamp}.json`, and revokes the URL. `runBackupExport` shows `sonner` toasts.
- `browser-cache.ts:clearAppCaches` deletes Cache Storage caches.
- `env-config.ts` reads `window.location` and `process.env.NEXT_PUBLIC_POCKETBASE_URL` on module load.
- `sw-cache-logic.ts`: None.

Logging, dependencies, filters, quadrants, capture parser, and dates:

- `logger.ts:Logger` writes to `console.debug`, `console.log`, `console.warn`, and `console.error`. `generateCorrelationId` advances a module-level counter.
- `error-logger.ts:logError` writes to `console.error`.
- `smart-views.ts:getSmartViews` and `getSmartView` read the `smartViews` table. `getAppPreferences` reads and `updateAppPreferences` writes the `appPreferences` table.
- `dependencies.ts`, `filters.ts`, `quadrants.ts`, `capture-parser.ts`, `escalation.ts`, `due-time.ts`, `due-date-presets.ts`, and `snooze-presets.ts`: None.

Top three, weekly sweep, commands, routes, and utilities:

- `confetti.ts` runs `warmLibraryWhenIdle` on module load, which fetches the `canvas-confetti` chunk during idle time.
- `confetti.ts:celebrateCompletion` appends one fixed, full-screen canvas to `document.body` and sets a 150 ms `setTimeout` for the second burst.
- `focus-restoration.ts:restoreFocusOrMainContent` moves DOM focus.
- `top-three-session.ts:tidyDismissal` keeps module-level state and notifies its listeners.
- `prefers-reduced-motion.ts:prefersReducedMotion` reads `window.matchMedia`.
- The other files in this group: None.

React hooks:

- `use-tasks.ts:useTasks` reads the `tasks` table through `useLiveQuery` and logs quarantined records through the `DB` logger.
- `use-auto-archive.ts:useAutoArchive` runs an hourly `setInterval`, subscribes to `getSyncCoordinator().onPulled`, and writes `tasks`, `archivedTasks`, `deletedTasks`, and `syncQueue` through `archiveOldTasks` and `purgeExpiredTrash`.
- `use-notification-checker.ts:useNotificationChecker` starts and stops the notification checker's timer.
- `use-app-shortcuts.ts` and `use-keyboard-shortcuts.ts` add and remove a `keydown` listener on `window`.
- `use-command-palette.ts:useCommandPalette` listens to `keydown` on `document` and `gsd:open-command-palette` on `window`. It moves focus on close and may dispatch `highlightTask`.
- `use-shell-command-handlers.ts:useShellCommandHandlers` calls `router.push`, sets the theme, dispatches window events, runs the backup export, and triggers a manual sync.
- `use-drag-and-drop.ts:handleDragEnd` writes through `moveTaskToQuadrant`.
- `use-error-handler.ts` logs through `logError` and shows `sonner` toasts.
- `use-view-transition.ts:navigateWithTransition` calls `document.startViewTransition` and `router.push`.
- `use-scroll-chrome.ts:useScrollChrome` listens to `scroll` on `window` and to a media query change, and uses `requestAnimationFrame`.
- `use-count-up.ts:useCountUp` uses `requestAnimationFrame`.
- `use-is-hydrated.ts`: None.

## Verification

- Run: `bun run test`
