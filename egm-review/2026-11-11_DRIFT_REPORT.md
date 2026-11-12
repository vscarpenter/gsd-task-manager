# Drift Report, 2026-11-11

README contracts written by `egm-bootstrap` on 2026-11-11, checked against source by fresh readers that did not write them. Only differences are listed.

Labels: `WRONG` (the code contradicts the README), `NOT IN CODE` (the README names something the source lacks), `UNDOCUMENTED` (the code has something a caller needs and the README omits it), `OVERSTATED` (the README calls something an invariant that the code does not enforce or state).

Sections appear in the order the checkers reported. The summary is at the end.

## components/README.md

- `WRONG` Interface says `ImportDialog` takes "optional `existingTaskIds`, `archivedCount`, `trashedCount`, `syncEnabled`, and `onImportComplete`". `onImportComplete` is required: `components/import-dialog.tsx:333` (`onImportComplete: () => void;` in `ImportDialogProps`), and `handleImport` calls it unguarded at line 365.
- `UNDOCUMENTED` `AppFooter` reads two environment variables the README does not name: `process.env.NEXT_PUBLIC_BUILD_NUMBER` (fallback `"dev"`) and `process.env.NEXT_PUBLIC_BUILD_DATE` (fallback `"unknown"`), `components/app-footer.tsx:6-7`. The README only says "the build number and date".
- `UNDOCUMENTED` Erase-local path of `DeleteAccountDialog.handleDelete` (`components/delete-account-dialog.tsx:147-152`, `eraseLocalDataAndScheduleReload` lines 96-106): after the remote delete succeeds it never calls `disableSync`, `onOpenChange(false)`, or `onDeleted`. If `resetEverything` reports `!success` it shows "Cloud account deleted, but local erase was incomplete.", clears `isDeleting`, and leaves the dialog open with no reload. The README documents only the keep-local follow-up calls and the reset-plus-reload happy path, and lists only two of the toasts.

## components/settings/README.md

No drift detected

## components/settings-page/README.md

- `WRONG` Invariant "`notificationToggle` ... aborts enabling when `Notification.requestPermission()` is not `"granted"`" and Side Effect "calls `Notification.requestPermission()` when enabling notifications" both omit the guard. `components/settings-page/use-settings-data.ts:152` only requests permission when `newEnabled && "Notification" in window`; where the API is absent, enabling proceeds straight to `updateNotificationSettings({ enabled: true })` (line 156) with no permission check.
- `OVERSTATED` Invariant "`pickImportFile`: the file picker accepts `application/json` only". The code only sets the picker hint `input.accept = "application/json"` (`components/settings-page/settings-body.tsx:54`); nothing checks `file.type` or the extension. The enforced gates are the size cap (line 58) and `JSON.parse` (line 66).

Coverage: read 47 of 47 source files in full.

## components/sync/README.md

- `WRONG` Invariant on `persistSyncConfig`: "throws 'Local tasks belong to a different sync account...' when any lifecycle count is above 0 and `localTaskOwnerUserId` differs from `authState.userId`". The code also requires `localTaskOwnerUserId` to be truthy (`use-sync-auth-dialog.ts:261-265`). With no existing config (owner resolves to `null`) and local tasks present, it does not throw.
- `OVERSTATED` "`useLogout.handleLogout`: shows a confirmation first when `status.pendingCount > 0`". The hook only sets `showLogoutConfirm` and `pendingChanges` and returns (`use-logout.ts:50-53`). `LogoutConfirmation` is rendered only by `AuthenticatedSection` (`sync-auth-dialog-sections.tsx:130-137`). `SessionExpiredSection` receives `handleLogout` as `onLogout` (`sync-auth-dialog.tsx:176`) and renders no confirmation (`sync-auth-dialog-sections.tsx:37-77`), so on that path with pending changes nothing is shown and no sign-out happens.
- `UNDOCUMENTED` `buildSyncConfig` fields written to `syncMetadata` on every sign-in that the README does not list: `localTaskOwnerUserId: authState.userId` (the README covers only how it is read), and a reset to `null` of `lastSyncAt`, `lastClientUpdatedAt`, `lastServerUpdatedAt`, `lastSuccessfulSyncAt`, `lastFailureAt`, `lastFailureReason`, `nextRetryAt` (`use-sync-auth-dialog.ts:216-230`). Only `deviceId` and `pullCursorVersion` carry over from the existing config.

Checker's note, not drift: in `validateTokenAndRefresh`, a cancellation during `await refreshAuth()` returns at `use-sync-auth-dialog.ts:198` before `setIsRefreshing(false)` at line 199, and the open-transition reset (lines 68-75) does not clear `isRefreshing`. The README describes both accurately. It looks like this can leave "Checking session..." showing.

## components/task-card/README.md

- `WRONG` Overview: "Every mutation goes through a callback prop." `TodayMenuItem` calls `today.add(task)` and `today.remove(task)` on the object from the `useTodayMenu()` context, not a prop (`task-card-actions.tsx:233-243`). The README's own Side Effects section says this, so the overview contradicts it.

## components/ui/README.md

No drift detected

## components/dashboard/README.md

No drift detected

Coverage: read 49 of 49 source files in full (sync 10, task-card 10, ui 16, dashboard 13).

## packages/mcp-server/src/write-ops/README.md

- `WRONG` "a bulk complete throws if any task has `savedAt`" (Invariants). The check only fires when `operation.completed` is true, so a bulk un-complete of a Saved task is allowed: `bulk-operations.ts:261` (`operation.type === 'complete' && operation.completed && tasks.some(...)`).
- `WRONG` "`executeBulkWrite` ... invalidates the cache once at the end" (Side Effects). A bulk complete of a recurring task calls `createTaskInPB` per spawned instance (`bulk-operations.ts:141`), and `createTaskInPB` invalidates on every call (`helpers.ts:63`). So the cache is invalidated once per spawn plus once at `bulk-operations.ts:366`.
- `WRONG` "`applyUpdate`: does two fresh reads, one update, and one cache invalidation." Three things differ:
  - When `input.dependencies` is given, it also does a full `listTasksFresh` read (`task-operations.ts:158`, called from `:295`).
  - The recurring-instance create invalidates a second time (`task-operations.ts:323` to `recurrence.ts:61` to `helpers.ts:63`).
  - On `dryRun` it returns after one read, with no write and no invalidation (`task-operations.ts:303-311`).
- `OVERSTATED` "`updateTaskInPBById`: ... The caller must call `getTaskCache().invalidate()`", and the grouping of the three `...ById` helpers as non-invalidating writes. On the `deleteTask` path, the dependency cleanup writes go through `updateTaskDependenciesInPBById` (`dependency-cleanup.ts:60`) after the only invalidation has already run (`task-operations.ts:387` inside `deletePrimaryTask`, then `cleanDependents` at `:437`). Nothing invalidates after those cleanup writes. The bulk path does invalidate after cleanup (`bulk-operations.ts:363` then `:366`).
- `UNDOCUMENTED` Where the write rate limiter is not used. `createTask` (`task-operations.ts:132`) and `applyUpdate`, which serves `updateTask` and `completeTask` (`task-operations.ts:319`, `:323`), write with no `WriteRateLimiter`. Only `deleteTask` (`:427`) and `executeBulkWrite` (`bulk-operations.ts:358`) build one, and each builds a new instance per call, so the 100 ms spacing does not carry across tool calls. The README describes the limiter but never says which operations bypass it.
- `UNDOCUMENTED` In `deleteTask`, the snapshot of dependents (`snapshotDependents`, `task-operations.ts:435`) does not go through the limiter; only the primary delete and the cleanup writes do. With no dependents it skips `getAuthInfo`, the snapshot and the cleanup entirely (`task-operations.ts:428-432`).
- `UNDOCUMENTED` `deletePrimaryTask` compares against `fresh.clientUpdatedAt || fresh.record.updated` and `task.updatedAt` from the list read (`task-operations.ts:381-382`). The README only says "if the record changed since the read". It also throws a plain `Task not found` error, not `ConflictError`, when the fresh read is null (`:378`).
- `UNDOCUMENTED` `assertFreshUpdatePreflight` throws a plain `Error` ("was deleted between read and write") when the record is gone (`task-operations.ts:242-244`). The README lists only the `ConflictError` case.
- `UNDOCUMENTED` `createTask` adds warnings for a past due date and for more than 10 tags (`task-operations.ts:78-87`), and defaults `notifyBefore` to `DEFAULT_NOTIFY_BEFORE_MINUTES` (15, `task-operations.ts:114`, `constants.ts:20`). The number 10 and the default 15 are not in the README.
- `UNDOCUMENTED` `bulk-operations.ts:spawnNextInstance` logs a warning through `createMcpLogger` on a failed spawn (`bulk-operations.ts:144`) and the failure comes back as an `errors` string while the task still counts as `updated` (`:201-204`). The README's logging list names only `executeBulkWrite` and `cleanDependents`.
- `UNDOCUMENTED` `executeBulkWrite` returns `errors: ['No matching tasks found']` when the snapshot is empty (`bulk-operations.ts:354`) and appends `Task <id>: not found in PocketBase` for each missing id (`:307`). A bulk delete also calls `listTasksFresh` before any write (`:352`).
- `UNDOCUMENTED` `fetchPBSnapshotForTasks` calls `confirmUsersPrincipal` when zero records return (`helpers.ts:188`). `fetchPBRecordIdsForTasks` does not (`helpers.ts:215-224`), though the README lists them together.

## packages/mcp-server/src/tools/README.md

- `OVERSTATED` "`getTaskStats`: it does not throw. Any error returns stats with every field null." `getPocketBase(config)` is called outside the `try` (`sync-status.ts:37`), and `getPocketBase` can throw (it refuses a decoded superuser token, per the comment at `pocketbase-client.ts:147`).
- `UNDOCUMENTED` `getSyncStatus` and `getTaskStats` both call `confirmUsersPrincipal` when the count or listing is empty (`sync-status.ts:16`, `:44`). The Side Effects line for `getSyncStatus` lists only `requireUsersPrincipal`, `health.check()` and `getList(1, 1)`. Effect: an empty account with a refused token reports `healthy: false`.
- `UNDOCUMENTED` `getTaskStats` builds `lastUpdated`, `oldestTask` and `newestTask` all from `client_updated_at || updated` (`sync-status.ts:51-62`), so `newestTask` always equals `lastUpdated` and `oldestTask` is the least recently updated task, not the oldest created.
- `UNDOCUMENTED` `fetchTaskRecords` replaces any PocketBase error with a generic "Failed to fetch tasks from PocketBase" error that keeps only the numeric `status` (`list-tasks.ts:89-100`).
- `UNDOCUMENTED` A filtered `listTasks` call on a cache miss fetches from PocketBase and does not write the cache (`list-tasks.ts:49-51`). The README says filtered requests filter the cached list, which is only true on a hit.

## packages/mcp-server/src/tools/handlers/README.md

- `UNDOCUMENTED` `validateToolArgs` returns `args` unchanged, unvalidated, for a tool name with no schema (`input-schemas.ts:201`). The README says it "parses `args` with the tool's Zod schema".
- `UNDOCUMENTED` Numeric limits in `input-schemas.ts` that the Invariants list leaves out: `timeZone` 1 to 64 characters (`:156`), `search_tasks.query` at least 1 character (`:54`), `get_tag_analytics.limit` a positive integer (`:58`).
- `UNDOCUMENTED` Only the top-level schemas are strict. The bulk `operation` variants and the subtask items are plain `z.object` (`input-schemas.ts:80`, `:104`, `:133-145`), so unknown keys inside them are stripped, not rejected.
- `UNDOCUMENTED` `handleUpdateTask` never reports `recurringInstance` (`write-handlers.ts:53-95`), although `updateTask` creates one when an update completes a recurring task (`task-operations.ts:272`, `:323`). Its non-dry-run branch also drops `validation.warnings` (`write-handlers.ts:75-85`).
- `UNDOCUMENTED` `handleDeleteTask` never sets `isError`, even when `result.partial` is true (`write-handlers.ts:143-170`). The README states the `isError` rule only for `handleBulkUpdateTasks`.
- `UNDOCUMENTED` `handleBulkUpdateTasks` also sets `isError: true` on a dry run whose result carries an error such as "No matching tasks found" (`write-handlers.ts:216`, `bulk-operations.ts:273`).
- `UNDOCUMENTED` `handleGetHelp` with no topic appends a sixth "Additional Resources" section that no topic returns (`system-handlers.ts:245`). `handleGetCacheStats` also returns a `notes` array and `statsReset` (`system-handlers.ts:280-289`); one note says "Cache is invalidated after every write operation", which the delete cleanup path contradicts (see write-ops above).

Matches confirmed: all 20 tool names, and the stated limits (1 to 255, 4, 80, 600, 30, 20, 100, 50, 50, 50, 1 to 10080, 0).

## packages/mcp-server/src/tools/schemas/README.md

- `OVERSTATED` "`write-tools.ts` takes its numeric limits from `SCHEMA_LIMITS`". The `estimatedMinutes` bounds 1 and 10080 and the `notifyBefore` minimum 0 are literals (`write-tools.ts:77`, `:86-87`, `:177`, `:186-187`).
- `UNDOCUMENTED` Limits present in the schemas and absent from the README:
  - `id` is 1 to 255 characters on `update_task`, `complete_task` and `delete_task` (`write-tools.ts:107-108`, `:207-208`, `:233-234`).
  - `taskIds` items are 1 to 255 characters (`:258`).
  - `bulk_update_tasks.operation.tags` takes 1 to 20 tags of 1 to 30 characters (`:285-287`).
  - `update_task` allows at most 50 subtasks (`:142`).
  - `title` has `minLength: 1` (`:17`, `:113`).
- `UNDOCUMENTED` `bulkUpdateTasksTool` also describes `dryRun` as defaulting to true for deletes with no schema default (`write-tools.ts:298-302`). The README notes this only for `deleteTaskTool`.

Coverage: read 24 of 24 source files in full (7 in write-ops, 5 in tools, 7 in tools/handlers, 5 in tools/schemas).

## packages/mcp-server/src/analytics/README.md

No drift detected

## packages/mcp-server/src/api/README.md

- `OVERSTATED` "a network failure is rethrown with the redacted host, not the real one" (`client.ts:fetchWithErrorHandling`). The rethrown message also embeds the underlying `error.message` verbatim (`api/client.ts:70`), and nothing strips a host from that text. Only the `Failed to connect to ...` line is redacted (`api/client.ts:67-69`).

## packages/mcp-server/src/auth/README.md

No drift detected

## packages/mcp-server/src/cli/README.md

No drift detected

## packages/mcp-server/src/server/README.md

No drift detected

## packages/mcp-server/src/text/README.md

No drift detected

## packages/mcp-server/src/utils/README.md

No drift detected

## packages/mcp-server/src/README.md

- `WRONG` "`tools.ts`: re-exports ... the types and mappers of `types.ts`". `tools.ts:12-25` re-exports only `GsdConfig`, `SyncStatus`, `TaskStats`, `Task`, `TaskFilters`, `PBTask`, `syncStatusSchema`, `pbTaskToTask`, and `taskToPBFields`. It does not re-export `PBTaskSnapshotFields`, `pbTaskSnapshotFields` (`types.ts:44-51`), or `taskDependencyPatchToPBFields` (`types.ts:195`).
- `OVERSTATED` "`PRINCIPAL_REJECTION_STATUSES`: only 401 and 403 retire a token". That holds only inside `refreshPrincipal` (`pocketbase-client.ts:124-126`). `usersOwnerId` also calls `retirePrincipal` with no status involved when the record is missing, not in `users`, or a superuser (`pocketbase-client.ts:133-135`), and `getPocketBase` clears the store and `pbToken` for a decoded superuser (`pocketbase-client.ts:69-72`).

## packages/mcp-server/README.md (Package contract section)

- `UNDOCUMENTED` The Interface lists environment variables but omits `APPDATA`, which `src/cli/index.ts:88` (`getClaudeConfigPath`) reads on Windows. The `cli` README does cover it.
- `WRONG` "Setup, validate, and help modes print to stdout". The setup wizard's failure path writes to stderr (`src/cli/setup-wizard.ts:232`), and so does the fatal handler in `src/index.ts:43`.

Matches confirmed: dependency versions, both coverage threshold sets, the Node version, 20 tools, 6 prompts, bulk limits of 50 and 10, and the field limits.

## packages/README.md

No drift detected

Coverage: read 31 of 31 source files in full for the eight `src` READMEs, plus `package.json`, `vitest.config.ts`, `tsconfig.json`, and the three local scripts for the Package contract.

## components/matrix-simplified/README.md

- `OVERSTATED` Invariant "`use-matrix-window-events.ts:useMatrixWindowEvents`: accepts `focusQuadrant` only if it is in `["q1", "q2", "q3", "q4"]`". Only the `?focusQuadrant=` URL parameter is checked (`use-matrix-window-events.ts:133-135`). The `FOCUS_QUADRANT_EVENT` listener passes any truthy `detail.quadrant` straight to `focusQuadrant` (`focusRequestedQuadrant`, lines 166-169).
- `OVERSTATED` Invariant "`intro-copy.ts` (file header comment): the subtext never mentions Q2". The same header comment carves out an exception ("the empty-board hint names Schedule only as a capture marker", `intro-copy.ts:6-7`). Two messages name Schedule: the zero-active message (line 62) and the all-in-Eliminate message (line 75).
- `WRONG` Interface "`useEditDraftState` ... seeds form state from the task (edit) or from `initialDraft` (create)". The due date is never seeded from `initialDraft`: `useDueDateDraft(task)` takes only the task and starts create mode at `"none"` / `undefined` (`use-edit-draft-state.ts:276-286`, called at line 312). `initialDraft.notifyBefore` is also ignored unless `initialDraft.notificationEnabled` is truthy (`useReminderDraft`, line 190).
- `WRONG` Invariant "`help-drawer-sections.tsx:HelpGuideSections`: a comment states that every client's guide shares the section order, and to change both together". The comment's "change both together" refers to each claim and the code it describes, not to the clients (`help-drawer-sections.tsx:5-9`).
- `UNDOCUMENTED` `task-actions.ts:reportTaskMutationError` does not always toast `userMessage`. It shows `taskValidationMessage(error) ?? userMessage` (`task-actions.ts:31`), so a validation limit message replaces the caller's text.
- `UNDOCUMENTED` `whats-new-cue.tsx:WhatsNewCue`: following the "See what's new" link also records the version (`onClick={markSeen}` on the `Link`, `whats-new-cue.tsx:98`). The README lists `recordLastSeenVersion` for Dismiss only. `useWhatsNewCue` also reads releases through `useWhatsNewReleases` (line 62), which the README does not name.
- `UNDOCUMENTED` `task-detail-sheet.tsx:DetailActions`: the toggle button calls `onToggleComplete` and then `onClose`, so toggling closes the sheet (`task-detail-sheet.tsx:302`). It renders only when `onToggleComplete` is passed, and its label is "Mark not done" for a completed task (line 283).
- `UNDOCUMENTED` `index.tsx` grid `onSave`: after a successful `handleSaveForLater` it focuses the capture input (`index.tsx:385`). The capture path reveals the new card with `highlightTaskById(id, { focus: false })` (`index.tsx:341`). Neither focus effect is in Side Effects.
- `UNDOCUMENTED` `capture-bar.tsx`: both `onMoreOptions` paths clear the draft. Shift+`N` calls `setText("")` and `setOverride(null)` when the text has visible characters (`capture-bar.tsx:193-196`), and the Details button always clears (lines 314-315).
- `UNDOCUMENTED` `edit-drawer-fields.tsx:TagsField`: the tag input commits on blur (`onBlur={onAddTag}`, line 251). The README lists only Enter and `,`.

Coverage: read 48 of 48 source files in full. Class-name-only lines were skipped in 24 presentational files and spot-checked where a claim depended on them.

## lib/README.md

- `WRONG` "`weekly-sweep.ts:reasonFor` gives each task one card, from the first group it qualifies for: overdue, escalating, stale, saved, undated schedule." `reasonFor` (`lib/weekly-sweep.ts:91-94`) checks `savedAt` first and returns only `"saved"` or `null` for a saved task. A saved task never gets overdue, escalating, or stale. The real precedence is saved first, then `unsavedReason` (`:71-82`): overdue, escalating, stale, undated schedule. The listed order is only the output order of `GROUPS` (`:97-103`).
- `WRONG` "`archiveOldTasks` and `archiveTaskNow` enqueue a remote `delete` that carries the task. `restoreTask` enqueues an `update`." All three enqueue only when `syncConfig?.enabled` (`lib/archive.ts:120`, `:178`, `:220`). With sync off nothing is queued.
- `WRONG` "`use-scroll-chrome.ts:resolveChromeHidden` never hides above 64 px of scroll." The code is the reverse: it never hides while `y < SCROLL_CHROME.HIDE_AFTER` (`lib/use-scroll-chrome.ts:31`), meaning within the top 64 px. Past 64 px it does hide.
- `WRONG` "`getSafeLegacyCaptureUrl`, `isCapturePayloadUrl`, `getSafePageUrl`. Strip capture payloads and fragments from page URLs." `isCapturePayloadUrl` (`lib/sw-cache-logic.ts:105-116`) strips nothing. It is a boolean predicate: true when the query or the fragment carries `action=capture`.
- `WRONG` "`env-config.ts:resolvePocketBaseUrl` ... An unknown HTTPS host falls back to same-origin." The fallback is not conditioned on HTTPS. Any unmapped host that `detectEnvironment` treats as production returns `window.location.origin` (`lib/env-config.ts:76-78`). The HTTPS condition applies to development hosts only (`:64-69`).
- `UNDOCUMENTED` `env-config.ts:resolvePocketBaseUrl` returns `http://127.0.0.1:8090` for a development host over HTTP, and `""` for a production build with no `window` (`lib/env-config.ts:59-61`, `:76-77`). The README names neither backend target.
- `UNDOCUMENTED` `trash.ts:restoreFromTrash` enqueues a sync `create` for the restored task when sync is enabled (`lib/trash.ts:64`). It also returns quietly, without throwing, when the id is not in Trash (`:58`, `:69-72`).
- `UNDOCUMENTED` `notification-checker.ts:checkSweepReminder` reads `localStorage` keys `gsd:weekly-sweep-reminder` and `gsd:weekly-sweep-reminder-fired`, and writes the latter through `markSweepFired` (`lib/notification-checker.ts:118-120`). The Side Effects entry lists only `tasks`, `notificationSettings`, notifications, and the badge.
- `UNDOCUMENTED` `notification-checker.ts:processNotifications` also returns early when `settings.enabled` is false, after calling `clearAppBadge()`, and when `isInQuietHours(settings)` is true (`lib/notification-checker.ts:80-86`). Neither path updates the badge.
- `UNDOCUMENTED` `db-migrations.ts:migratePocketBase` (version 13) also removes `vectorClock` from `archivedTasks` rows and deletes the `encryption_salt` row from `syncMetadata` (`lib/db-migrations.ts:164`, `:168-170`). The `sync_config` reset keeps the existing `deviceId` (`:160-161`).
- `UNDOCUMENTED` `use-shell-command-handlers.ts` dispatches a sixth window event, `gsd:open-help` (`lib/use-shell-command-handlers.ts:27`, `:97`). `onSelectTask` navigates to `/saved#<id>` for a saved task (`:158`). The README lists five event names.
- `UNDOCUMENTED` `use-auto-archive.ts:runScheduledCheck` also archives on mount and hourly when sync is off (`lib/use-auto-archive.ts:71-75`). The README invariant covers only the sync-on path.
- `UNDOCUMENTED` `smart-views.ts:updateAppPreferences` returns `Promise<AppPreferences>`, the merged row (`lib/smart-views.ts:99-110`).

Matches confirmed on the files flagged for attention: `db.ts`, `db-migrations.ts` (versions 1 to 17), `schema.ts`, `trash.ts` transaction scopes, `reset-everything.ts`, `reset-local-data.ts`, `logger.ts`, and `quadrants.ts`.

Coverage: read 60 of 60 source files in full.

## components/about/README.md

- `WRONG` "Seven files are presentational and take no data." Two of the seven take props: `FooterCta` takes `version` (`footer-cta.tsx:4-8`) and `FeatureCard` takes `icon`, `title`, `description`, `badge`, `className` (`feature-card.tsx:4-13`). The README's own Interface section lists both.
- `UNDOCUMENTED` `mcp-section.tsx:31` hard-codes the install command with a pinned `gsd-mcp-server` version, and `mcp-section.tsx:18` hard-codes the production PocketBase URL in the config string. The version matches `packages/mcp-server/package.json:3` today and needs a hand bump on each MCP release.

## components/command-palette/README.md

No drift detected

## components/onboarding/README.md

No drift detected

## components/saved/README.md

- `UNDOCUMENTED` `SavedItem` renders `<li id={task.id}>` (`saved-item.tsx:30`). That id is the anchor target for the palette deep link `/saved#<taskId>` built in `lib/use-shell-command-handlers.ts:158`, so renaming it breaks the link.

## components/share-task-dialog/README.md

- `UNDOCUMENTED` `handleCopyDetails` calls `onOpenChange(false)` after a successful copy (`index.tsx:81`). The README records the close for the email and native paths but not for copy.

## components/today-strip/README.md

No drift detected

## components/weekly-sweep/README.md

No drift detected

## app/README.md

- `UNDOCUMENTED` `app/globals.css` (784 lines) is mentioned only as an import. It imports `./css/inkwell-tokens.css` and `./css/inkwell-components.css` (`globals.css:6-7`) and defines the `dark` and `pinned` custom variants (`globals.css:136`, `:144`). The child directories `app/css/` and `app/fonts/newsreader/` are not listed and have no README.
- `UNDOCUMENTED` The CSP meta tag is emitted whenever `NODE_ENV !== "production"` (`layout.tsx:24`, `:152`), but the localhost hosts and `configuredPocketBaseOrigin` enter `connect-src` only when `NODE_ENV === "development"` (`layout.tsx:39-57`). Under `NODE_ENV=test` the tag ships without the configured PocketBase origin. This list is hard-coded in `layout.tsx:25-57` and `:137-149`, separate from `config/csp.cjs`.

## app/(archive)/README.md

No drift detected

## app/(archive)/archive/README.md

No drift detected

## app/(dashboard)/README.md

No drift detected

## app/(dashboard)/dashboard/README.md

- `UNDOCUMENTED` `page.tsx` imports `DashboardError` from `@/components/dashboard/dashboard-error` and passes it as the `ErrorBoundary` fallback (`page.tsx:11`, `:83`). The README's component list omits it.

## app/(matrix)/README.md

No drift detected

## app/(sync)/README.md

No drift detected

## app/(sync)/sync-history/README.md

No drift detected

## app/about/README.md

No drift detected

## app/auth/README.md

No drift detected

## app/auth/callback/README.md

No drift detected

## app/saved/README.md

No drift detected

## app/settings/README.md

No drift detected

## app/sweep/README.md

No drift detected

## config/README.md

No drift detected

Coverage: read 54 of 55 source files in full. `app/globals.css` was read as an outline only.

## scripts/lib/README.md

- `WRONG` "`withFirefoxTestHome(...)`: calls `runWithEnv` and returns its result." The function is `async` and awaits the callback, so it always returns a promise (`firefox-test-home.cjs:9,14`).
- `UNDOCUMENTED` `startStaticExportServer` defaults `outputRoot` to `resolve("out")`, relative to the current directory, and `serveProductionExport` takes its `port` default from `PORT` or `DEFAULT_PORT` (`static-export-server.cjs:53,82`). The README signature shows `outputRoot` with no default.

## scripts/README.md

- `WRONG` "`deploy-app.sh`: `aws s3 cp ... --metadata-directive REPLACE` rewrites the metadata of `theme-init.js`", and the ordered step "`theme-init.js` metadata". That step uploads the local `out/theme-init.js` again, and it is skipped when the build has no such file (`deploy-app.sh:72-80`). Only `index.html` is an in-place bucket copy (`deploy-app.sh:83-86`).
- `WRONG` "`triage-run.sh:gh_fail_log`: appends to `gh-errors.log` ... when a `gh` call fails." It also appends when the discovery helper does not run (`triage-run.sh:63`). It first runs `mkdir -p` on the log directory (`triage-run.sh:25`).
- `UNDOCUMENTED` `triage-run.sh` appends three directories to `PATH` (line 6). `GSD_TRIAGE_REPO` and `GSD_TRIAGE_SOURCE` fall back to hard-coded values, and the log and helper paths derive from the source path (lines 8-11).
- `UNDOCUMENTED` `setup-pocketbase-feedback-collection.sh` reads `GET $PB_URL/api/collections/feedback`, `GET $PB_URL/api/gsd/feedback-controls` (twice) and `GET $PB_URL/api/settings` (twice) (lines 185-187, 236-238, 255-257, 308-310, 338-340). It requires `hookVersion == 2` and `ready == true` from the controls route (lines 249, 350).
- `UNDOCUMENTED` `setup-pocketbase-feedback-collection.sh`: the first write sends `createRule: null`, so a run against an existing collection turns anonymous feedback off. A failure at any later check leaves it off (payload line 103, write lines 215-222, comment lines 91-92). The README says only that the PATCH "replaces its fields, indexes, and rules".
- `UNDOCUMENTED` `setup-pocketbase-feedback-collection.sh` forces `logs.maxDays` to 0 or 1 (line 291). The README lists `logs.maxDays` as changed without the value.
- `OVERSTATED` "`setup-pocketbase-collections.sh` ... a second run against the same server exits 1." The script has no existence check and exits 1 only when the response has no `id` (lines 373-392). The refusal of a duplicate is the server's behavior, not something this file enforces.
- `UNDOCUMENTED` `verify-pb-encryption.sh` side effects the README omits:
  - It runs `$PB_BIN superuser upsert` (line 49).
  - It sources `docker/lib/migrations.sh` and builds a fresh migrations folder (lines 45-46).
  - It generates a key with `openssl` and passes it as `GSD_TASKS_ENC_KEY` (lines 25, 50, 53).
  - It creates a user and a task on the local server (lines 94, 113).
  - Its paths are relative, so it must run from the repo root.
- `UNDOCUMENTED` `run-pocketbase-system-test.sh` passes `POCKETBASE_BIN` and `POCKETBASE_OLD_BIN` to the test run (lines 74-75).
- `UNDOCUMENTED` `update-sw-version.cjs` takes the stamped version from `.build-info.json`, falling back to `package.json` (`resolveVersion`, lines 25-36).
- `UNDOCUMENTED` `generate-build-info.cjs` reads the previous `.build-info.json` and raises the patch number on a repeat build of the same package version (lines 15-34). The exported build number can therefore differ from `package.json`.
- `UNDOCUMENTED` `check-code-shape.cjs:validateDebtLedger` also fails when `owner` is blank, when a `maximumRemainingViolations` ceiling is missing, or when a rule's total exceeds its ceiling (lines 109-127). The README names only the deadline.
- `UNDOCUMENTED` `check-dependency-licenses.cjs` defaults `--root` to `node_modules` and `packages/mcp-server/node_modules` (lines 38-41), and it throws on an unknown or incomplete argument (line 34). The file calls `main()` on load with no `require.main` guard (line 181).
- `UNDOCUMENTED` `deploy-cloudfront-response-headers-policy.sh` also exits 1 when `aws` or `jq` is missing or the policy file is absent (lines 30-40). The README gives one exit condition.

Every production or remote write found in the scripts is named in Side Effects, apart from the feedback bullets above.

## README.md (Repository blueprint section)

- `UNDOCUMENTED` `cloudfront-function-url-rewrite.cjs` rewrites a route to `index.md` when the request carries `Accept: text/markdown` (lines 66-69). It also sends a path with CR, LF or NUL to `/index.html` (lines 34-42). The README lists only the `..` case.
- `UNDOCUMENTED` `cloudfront-function-response-headers.cjs` appends `Vary: Accept` and forces the Markdown content type on `.md` paths (lines 33-35, 53-58). The README names only the `Link` header.
- `WRONG` "The MCP server keeps a copy in `packages/mcp-server/src/constants.ts:SCHEMA_LIMITS`." It is not a copy. The MCP object has 10 keys, two of them absent from the web object (`ID_MAX_LENGTH`, `MAX_BULK_TASKS`, lines 8, 16). It lacks `TIME_ENTRY_NOTES_MAX_LENGTH`, `DEFAULT_NOTIFY_MINUTES`, `MAX_TIME_ENTRIES` and every smart-view limit in `lib/constants/schema.ts:9-73`. The eight shared keys hold equal values.
- `OVERSTATED` "Sync errors and logs carry no task text (... `lib/logger.ts:sanitizeMetadata`)." `sanitizeMetadata` masks only keys named `title`, `description`, `tags`, `subtasks` or `notes`, plus the secret-key pattern (`lib/logger.ts:131,149`). Other string values, including `errorMessage` set from `error.message` (line 273), get token masking only (`sanitizeValue`, lines 87-89) and are printed in the prefix (lines 217-222). The log `message` argument is not sanitized. `sanitizeSyncError` does return a fixed code (`error-categorizer.ts:116`).
- `WRONG` "Network, only with sync on: the PocketBase `tasks` and `users` collections, the `/api/gsd/account` and `/api/gsd/sessions` routes, and one realtime subscription." `listAuthMethods` on `users` runs before sign-in completes, so before sync is on (`lib/sync/pb-auth.ts:59-70,184`). The sign-in flow also uses the `/api/gsd/oauth-callback` route (`lib/sync/oauth-callback.ts:19`), which is not listed.
- `UNDOCUMENTED` Global Side Effects omits production effects that sit in `scripts/`:
  - `deploy-cloudfront-function.sh` updates and publishes two functions, updates the distribution and invalidates it (lines 78-99, 133-147).
  - `deploy-cloudfront-response-headers-policy.sh` creates or updates the policy (lines 60, 73).
  - `setup-labels.sh` overwrites repo labels (line 11).
  - `setup-pocketbase-feedback-collection.sh` patches server-wide settings (lines 299-302).
  - `fix-discovery-content-types.sh` rewrites object metadata (lines 27-31).

All ten linked child READMEs exist.

Coverage: read 49 of 59 source files in full. Of the 13 files the Global Invariants cite, 5 were read in full and 8 at the cited symbol only. No script was run.

## lib/tasks/crud/README.md

- `WRONG` "All files log through `createLogger` (`TASK_CRUD` or `TIME_TRACKING`)". `helpers.ts`, `validation-error.ts`, and `index.ts` import no logger and log nothing.
- `WRONG` "`update.ts:keepUnlessGiven` clears ... `notifyBefore` ... when the key is present with `undefined`". The stored field is never cleared: `update.ts:114` wraps the call in `?? defaultReminder`, so an explicit `undefined` resolves to the device default (the README's own D-10 line says the same).
- `UNDOCUMENTED` `update.ts:40-43` passes the raw `updates` object (title, description) to `logger.error` on any failure. The README states the "never logs the raw input" rule for `createTask` only and says nothing about the update path doing the opposite.
- `UNDOCUMENTED` `helpers.ts:enqueueSyncOperation` (lines 45-56) is a no-op when `syncEnabled` is false and calls `scheduleSyncAfterChange()` immediately after the enqueue. The README says only that it enqueues outside the wrapper.

## lib/tasks/README.md

- `OVERSTATED` "`applyArchivedTasks` keeps an id in one table." The function only drops a payload archived row whose id is live (`import-export.ts:255-269`). It never checks `deletedTasks`, so a merge can put an id in both `archivedTasks` and `deletedTasks`. `applyTasks` regenerates ids only against live `tasks` ids (`import-export.ts:389-391`), and in replace mode `bulkAdd`s without looking at the archive or trash (`379-386`). A merged live task, or a replace from a payload with no `archivedTasks` or `deletedTasks` key (`250`, `282` return early), can share an id with a local archived or trashed row.
- `OVERSTATED` "`importTasks` gives every imported task a numeric `notifyBefore`." Only `parsed.tasks` is mapped (`import-export.ts:455-458`). Archived and trashed rows are written as they arrive.
- `WRONG` "Replace uses the backup's default." It does so only when the payload carries `notificationSettings.defaultReminder`. Otherwise replace falls back to this device's value through `readDefaultReminder()` (`import-export.ts:435-438`).
- `UNDOCUMENTED` `smart-view-import-bounds.ts:88` walks `payload.appPreferences` as well as `payload.smartViews`, and the depth, node, and byte limits are aggregate across both. An oversized `appPreferences` aborts the whole import.
- `UNDOCUMENTED` In merge mode `applyArchivedTasks` skips a payload row whose id is already archived locally (`import-export.ts:256-267`), so the local archived row wins. The README states this rule for trash only. `applySmartViews` does the opposite and overwrites an existing view with the same id (`321-328`).
- `UNDOCUMENTED` `saved.ts:returnSavedTask` returns the task unchanged, ignoring `quadrant` and `dueDate` and enqueueing nothing, when the task has no `savedAt` (`saved.ts:36`). `saved.ts:saveTaskForLater` throws the blocker string from `savedPlacementBlocker` (`saved.ts:15-16`).

## lib/analytics/README.md

No drift detected

## lib/constants/README.md

- `UNDOCUMENTED` `schema.ts:29` `SCHEMA_LIMITS.DEFAULT_NOTIFY_MINUTES: 15` is not a validation limit and is not mentioned. The smart view field limits are also unlisted: `SMART_VIEW_ID_MAX_LENGTH` 128, `SMART_VIEW_NAME_MAX_LENGTH` 80, `SMART_VIEW_DESCRIPTION_MAX_LENGTH` 600, `SMART_VIEW_ICON_MAX_LENGTH` 64, `SMART_VIEW_SEARCH_MAX_LENGTH` 600, `SMART_VIEW_DATE_MAX_LENGTH` 64, `SMART_VIEW_MODE_MAX_LENGTH` 64 (`schema.ts:51-64`).

Every number the README does state matches the code.

## lib/feedback/README.md

- `OVERSTATED` "Every mutation clears the cache and notifies." The exported `writeDraft` (`feedback-store.ts:109-112`), `writeLastSentAt` (`134-137`), and `writeNudgeDismissedAt` (`144-147`) write storage without calling `invalidate()`. Only `updateDraft`, `recordNudgeDismissed`, `recordSend`, `clearDraft`, and `resetFeedbackState` invalidate.
- `UNDOCUMENTED` `nudge-eligibility.ts:summarizeEngagement` buckets completion days by UTC day (`utcDay`, lines 44-46, 60). `lib/analytics` buckets by local day, and the code comment at line 43 claiming the two match is stale. The README's "3 distinct completion days" does not say which calendar.
- `UNDOCUMENTED` `feedback-store.ts:clearDraft` also notifies subscribers (line 117), and `toggleVote` returns the input draft untouched for a slug that is not a roadmap slug (line 122).

## lib/hooks/README.md

- `WRONG` "All three read from the sync context." `use-retry-countdown.ts:16-27` takes `nextRetryAt` as an argument and reads no context. Only `useSync` and `useSyncStatus` do.

## lib/notifications/README.md

No drift detected

## lib/preferences/README.md

No drift detected

## lib/smart-views/README.md

No drift detected

## lib/whats-new/README.md

No drift detected

Coverage: read 61 of 62 source files in full. `lib/whats-new/whats-new.json` was read for its shape and version lines only.

## lib/sync/README.md

- `OVERSTATED` "`pb-push.ts:pushLocalChanges` ... aborts the loop on a 429." Only a 429 thrown by the write or the session check aborts (`pb-push.ts:411-421`). A 429 on the per-item lookup is swallowed by `fetchRemoteTaskEntry` (`pb-sync-helpers.ts:251-257`), comes back as `index_unavailable`, charges the row one attempt (`pb-push.ts:252-261`, `302-305`), and the loop continues to the next item.
- `WRONG` "`resurrect-on-sight.ts:resurrectOnSight` ... A failed step does not fail the sync." Two failures do propagate: `listAccount` rethrows `SessionRejectedError` (`resurrect-on-sight.ts:81`), which `fullSync` reports as an auth failure, and `resurrectOnSight` rethrows `StaleSyncSessionError` (`resurrect-on-sight.ts:44`), which ends the sync as `cancelled`. Only other errors are logged and dropped.
- `WRONG` "`sanitizeSyncError` checks in a fixed order: rate limit, auth, not found, validation, server error, network." The first check is the structured `status === 0`, which returns `network_error` before any message matching (`error-categorizer.ts:124-127`). A non-Error value returns `unknown_error` before that (`117-119`).
- `UNDOCUMENTED` Side Effects for `deleteRemoteAccountAndTasks` start at `DELETE /api/gsd/account`. The function first calls `refreshAuthOutcome()` (`pb-account-deletion.ts:228`), which sends `authRefresh` and can clear the local auth token through `forgetRefusedToken` (`pb-auth.ts:385`). That also qualifies the invariant "performs the remote operation only".
- `UNDOCUMENTED` `signOutEverywhere` calls `clearPocketBase()` when `disableSync()` throws, before it raises `LocalSignOutIncompleteError` (`sign-out-everywhere.ts:80-83`). Side Effects list only the `DELETE` and `disableSync()`.
- `UNDOCUMENTED` The push path's local writes carry no session check. `queue.dequeue` (`queue.ts:131-134`), `queue.recordAttemptFailure` (`queue.ts:150-179`) and `settleRowOffset` (`pb-push.ts:87-95`, a write to `tasks`) never call `assertSyncSessionCurrent`. The only fence on a push is `resolvePushPrincipal`, which runs once at the start and compares the in-memory SDK principal (`pb-push.ts:339-346`, `370`). The README lists the session check per function and is silent on push, so a reader could assume every sync write is fenced.

## lib/sync/config/README.md

- `OVERSTATED` "An in-flight sync re-reads the row before each write, so it stops at its first await." The comment at `disable.ts:90-91` says the same, but the code does not bear it out for a push in flight: see the last bullet above (`queue.ts:131-134`, `150-179`, `pb-push.ts:87-95`), and the remote create, update, and delete calls (`pb-push.ts:124-126`, `297`) continue too. Pull, realtime, reconciliation, resurrection, cursor and outcome writes do re-read the row.
- `UNDOCUMENTED` `disableSync` with no `sync_config` row writes nothing to IndexedDB: it calls `clearPocketBase()` and `clearBrowserCaches()` and returns (`disable.ts:84-88`). The queue and history are not cleared and no Trash delete is remembered.

Matches confirmed by name: the Dexie table list of every sync transaction, push-then-pull order with pull first during a backfill, the strictly-newer conflict comparison, the pull cursor rules, the queue row moving to `failed` at 5 retries without deletion, the shared realtime delete guard, and the session-owner check at the start of every transaction the README names.

Coverage: read 30 of 30 source files in full.

## docker/lib/README.md

- `OVERSTATED` "`gsd_build_fresh_migrations` ... returns the status of `cp`": the function runs two `cp` commands with no check between them (`docker/lib/migrations.sh:31-32`), so it returns the status of the second (overlay) copy only. A failed first copy is hidden unless the caller runs under `set -e` (the entrypoint does, `docker-entrypoint.sh:2`).

## docker/pb_fresh_migrations/README.md

No drift detected

## docker/pb_hooks/README.md

- `WRONG` "`encryption-core.d.ts` declares types for that module": the declaration covers the three constants and only four of the six exported functions. `isValidCiphertext` and `jsonFieldString` are exported (`encryption-core.js:97,99`) but absent from `encryption-core.d.ts:2-14`.
- `OVERSTATED` "Every `tasks` hook calls it [`requireValidKey`] first": only the three hooks in `tasks_encryption.pb.js` do. `account_lifecycle.pb.js:38-49` (`onRecordCreateExecute` on `tasks`) never calls it.
- `WRONG` "`encryptRecord` skips a value only when it is valid ciphertext": it also skips `null`, `undefined`, and `""` for text fields (`encryption-core.js:65`) and `null`/`undefined` for JSON fields (`encryption-core.js:70`).
- `UNDOCUMENTED` The feedback gate's full condition: `rateLimits.enabled === true` and exactly one rule with label `feedback:create` and `audience === ""` (`feedback_controls.pb.js:18-23,32` and `47-52,61`). The README lists only the 30/60 numbers and log settings.
- `UNDOCUMENTED` `feedback_controls.pb.js` error types a client sees: `BadRequestError` for a non-superuser `status` (line 11), `InternalServerError` when controls are not ready (lines 33, 62), `TooManyRequestsError` at the 10,000 cap (line 65).

## docker/pb_migrations/README.md

- `WRONG` "The comments in the three later encryption files say deployed databases record the file names": only `1781200000_...js:3-4` and `1781300000_...js:7-8` say that. `1781100000_...js:2-4` says only to keep the shipped migration immutable.
- `WRONG` Table and Side Effects say `1781100000` "sets the vacuum marker" and "creates the table `_gsd_security_state` and inserts the row" without condition: it does so only when `records.length > 0` (`1781100000_harden_task_encryption_cleanup.js:133`), and the whole migration returns early with no `tasks` table (line 18). `1781300000` likewise returns early with no `tasks` table (`1781300000_vacuum_after_prefix_repair.js:14`).
- `UNDOCUMENTED` `1781100000` and `1781200000` return early when no `tasks` table exists (`:18` in each), after the key check. The README states that early return only for `1793030400` and `1794061500`.
- `UNDOCUMENTED` `1793562900_users_auth_token_30_days.js:14-18,26-30`: both directions return silently when no `users` collection exists.

## docker/README.md (Directory contract section)

- `UNDOCUMENTED` Exit paths beyond the three listed: `set -e` (`docker-entrypoint.sh:2`) also ends the script when `gsd_install_state` returns 1 (line 61), when `gsd_build_fresh_migrations` fails (line 68), or when `pocketbase migrate up` fails (lines 72-76).
- `UNDOCUMENTED` "`cleanup`: sends `kill` to both processes on `TERM`, `INT`, or `QUIT`": `cleanup` also runs when either child process exits on its own (`docker-entrypoint.sh:114-115`), so the container exits 0 after a PocketBase or Caddy crash.
- `UNDOCUMENTED` `docker-entrypoint.sh:85` passes `--publicDir=/pb_data/pb_public` to `pocketbase serve`, and lines 74, 82 pass `--hooksDir=/pb_hooks`.
- `UNDOCUMENTED` `Caddyfile:35-58` sets response headers on every response (CSP, HSTS, COOP, CORP, Permissions-Policy, `X-Frame-Options`) and `Caddyfile:119-124` sets cache headers for `/_next/static/*` and HTML. None appear in the contract.
- `UNDOCUMENTED` Build-time network calls beyond `bun install` and the PocketBase download: `apt-get update/install` (`Dockerfile:51`) and `apk add --no-cache libcap sqlite` (`Dockerfile:91`). `sqlite` is what `migrations.sh` needs at runtime.
- `UNDOCUMENTED` `docker-compose.yml:19` sets `SITE_ADDRESS=localhost` in the service environment.

## tools/stagehand/eval/README.md

- `WRONG` "Exit codes: 0 when no case fails, 1 when a case fails": `fail` counts attempts that threw (harness error, timeout, served-model mismatch, post-row write failure), not judge verdicts that were wrong. A case graded `correct: 0` increments `ok` (`run-eval.mjs:478-480,527`).
- `UNDOCUMENTED` More exit-2 paths than "a bad argument or a refused gate": an unparsable `_state.json` (`run-eval.mjs:336`), a duplicate case id after sanitization (`:366-368`), and a non-path-safe split id in `_state.json` (`:376-380`).
- `UNDOCUMENTED` `--model` has a default model id (`run-eval.mjs:28,136,353`). `-h`/`--help` prints usage and exits 0 (`:195`).
- `UNDOCUMENTED` Served-model check: an attempt fails with `failure_class: 'serving_substitution'` when the reported model differs from `--model` beyond a dated-snapshot suffix (`run-eval.mjs:432-441`).
- `UNDOCUMENTED` `runCase` fails an attempt when the verify report has no token usage (`run-eval.mjs:139-141`), and `gradeCase` throws when `goalMet` is not a boolean (`:163-165`).
- `UNDOCUMENTED` `main` reads `train_ids`, `val_ids`, `test_ids`, and `harness_paths` from `<flow>/_state.json` (`run-eval.mjs:228,373`), and reads `<flow>/baseline/ref/<id>` for non-baseline variants (`:444-448`).

## tools/stagehand/page-scripts/README.md

- `OVERSTATED` "`seed-tasks.js:makeRecord` writes every task record field": it writes the required fields and sets `completedAt`, `dueDate`, `estimatedMinutes`, `timeSpent` only conditionally (`seed-tasks.js:89-92`). It never writes `notifyBefore`, `parentTaskId`, `lastNotificationAt`, or `snoozedUntil`, which the file's own header lists as optional fields (`:27-28`).
- `UNDOCUMENTED` `gsdSeed.archived` reads spec field `archivedDaysAgo` (default 30) and adds `archivedAt` (`seed-tasks.js:136`). `gsdSeed.trashed` reads `deletedDaysAgo` (default 2) and adds `deletedAt` (`:205`). Neither field is in the spec list.
- `UNDOCUMENTED` `console-collector.js:41` records a failed request only for a non-ok response. A fetch that rejects (network error) is not recorded in `failedRequests`.

## tools/stagehand/README.md

- `UNDOCUMENTED` `Harness` also exposes the properties `stagehand`, `model`, and `evidenceDir` (`harness.ts:24-26`). `verify.ts` and `smoke.ts` depend on all three. The README lists only the methods.
- `UNDOCUMENTED` `resolveStagehandModel` has a default model when `STAGEHAND_MODEL` is unset or blank (`args.ts:18,81`).
- `UNDOCUMENTED` `smoke.ts:71-73` does a warm-up load of `/` unless the first selected journey is `first-visit-redirect`. `smoke.ts:50` writes `fail-<journey>.png` on a failed journey.
- `UNDOCUMENTED` `harness.ts:resetAppState` and `harness.ts:seed` each reload the last path through `goto` after evaluating their script (`harness.ts:130,135`).

## tools/README.md

No drift detected

## docs/diagrams/reminder-model/README.md (Directory contract section)

No drift detected

## docs/diagrams/task-lifecycle-model/README.md (Directory contract section)

No drift detected

## docs/diagrams/README.md

No drift detected

## docs/formal/sync-convergence/README.md

- `WRONG` "`FastClockHoldOff.cfg`: the baseline with `FastClock = TRUE`": it also lowers `MaxTime` to 3 (baseline is 4).
- `WRONG` "`Broken*.cfg`: one non-`code` `Variant` each": `BrokenNoHoldOff.cfg` also sets `FastClock = TRUE` and `MaxTime = 3`.
- `UNDOCUMENTED` `FindingFastClock.cfg` checks only `TypeOK` and `QuietMeansSameCopy`. Its header says `QuietMeansNewestEdit` is left out on purpose. The other three `Finding*` configs check all four.

## docs/formal/sync-session/README.md

- `WRONG` Overview list of modeled files omits one the module header names: "the tasks API rules in `scripts/setup-pocketbase-collections.sh`" (`SyncSession.tla:12-13`).

## docs/formal/task-tombstones/README.md

- `WRONG` "`Quiet`: every action except `YouSignIn` and `YouSignOut` requires `pend.act = "none"`": `YouDelete`, `YouUndo`, `YouRestoreFromTrash`, and `YouRestoreFromArchive` require the opposite, a pending action of their own kind (`TaskTombstones.tla:188,204,216,229`). Six actions do not require `Quiet`, not two.
- `OVERSTATED` "`NoComeback`: a server copy no newer than the tombstone never takes the task out of Trash or the archive": the module allows resurrect on sight to do so for a delete that never reached the server (`TaskTombstones.tla:562`; comment at `:594-596`).
- `OVERSTATED` "`ServerStaysDeleted`: ... no later push from this device restores it": the flag is set only while the task is still tombstoned here and no delete is pending (`TaskTombstones.tla:440`; comment at `:603-604`).

## docs/formal/README.md

No drift detected

## docs/README.md

- `WRONG` "diagrams: ... plus two TLA+ models": `docs/diagrams/` holds three TLA+ modules in two model directories. "Two model directories" is true; "two models" contradicts `docs/diagrams/README.md:17-18`, which counts three.
- `UNDOCUMENTED` "Two child directories hold source code": `docs/css/` holds four CSS files. Borderline: whether stylesheets count as source here is a judgment call.

Coverage: read 98 of 100 source files in full. No TLC, Docker, or script was run.

---

# Summary

## Counts

| | |
| --- | --- |
| READMEs checked | 77 |
| No drift detected | 38 |
| READMEs with findings | 39 |
| `WRONG` | 38 |
| `OVERSTATED` | 21 |
| `UNDOCUMENTED` | 95 |
| `NOT IN CODE` | 0 |
| Total findings | 154 |

No README names a symbol, file, or route that does not exist. That agrees with the earlier citation check (1,434 citations, all resolved). The errors are in what the READMEs say about real symbols: 59 statements are wrong or stronger than the code.

Most findings by file: `scripts/README.md` 14, `lib/README.md` 13, `packages/mcp-server/src/write-ops/README.md` 12, `components/matrix-simplified/README.md` 10.

`lib/`, the subtree with no independent reader during the bootstrap, has 13 READMEs and 34 findings (11 `WRONG`, 5 `OVERSTATED`, 18 `UNDOCUMENTED`). Its named sync invariants held: transaction table lists, push and pull order, the conflict comparison, the cursor rules, the retry limit, and the session-owner checks.

## How to read the labels

* `WRONG` and `OVERSTATED` are README defects. A reader who trusts the sentence is misled. Fix these first.
* `UNDOCUMENTED` is a coverage gap. Many are small (a default value, an extra exit path). Some are not; see below.
* Several findings describe code behavior that looks unintended. The README is accurate or silent, and the code is the thing to look at.

## Findings that may be code problems, not doc problems

None of these was reproduced. Each is a checker's reading of the code.

1. **Import can put one id in two lifecycle tables.** `lib/tasks/import-export.ts:applyArchivedTasks` checks live ids and, in merge mode, archived ids. It does not check `deletedTasks`. Spot-checked after the run: lines 255-269 show exactly those two checks. Whether a later step removes the duplicate was not traced. This touches the one-id-one-table rule (ADRs 0013, 0015).
2. **A push in flight is not fenced by the session check.** `queue.dequeue`, `queue.recordAttemptFailure`, and `pb-push.ts:settleRowOffset` write without `assertSyncSessionCurrent`. The comment at `lib/sync/config/disable.ts:90-91` says an in-flight sync stops at its first await; for a push it does not.
3. **Sign out from the session-expired view does nothing when changes are pending.** `useLogout.handleLogout` sets a confirm flag that only `AuthenticatedSection` renders.
4. **"Checking session..." can stick.** A cancellation during `refreshAuth()` returns before `setIsRefreshing(false)` (`use-sync-auth-dialog.ts:198`).
5. **MCP cache is stale after a delete with dependents.** `deleteTask` invalidates before the dependency cleanup writes and not after. The server's own `get_cache_stats` note says the cache is invalidated after every write.
6. **MCP write pacing covers deletes and bulk writes only.** `create_task`, `update_task`, and `complete_task` bypass `WriteRateLimiter`, and each call builds a new limiter.
7. **MCP handlers drop results.** `handleUpdateTask` never reports the recurring instance an update can create and drops validation warnings. `handleDeleteTask` never sets `isError` on a partial result.
8. **MCP network errors can carry the real host.** `api/client.ts:70` embeds the underlying `error.message` after the redacted line.
9. **The Docker container exits 0 after PocketBase or Caddy crashes** (`docker-entrypoint.sh:114-115`), so a restart policy of `on-failure` would not restart it.
10. **The Stagehand eval exits 0 when the judge is wrong.** `run-eval.mjs` counts only attempts that threw as failures.
11. **The feedback nudge counts completion days in UTC** while analytics uses local days; the code comment claiming they match is stale.
12. **Enabling notifications skips the permission check** where the `Notification` API is absent (`use-settings-data.ts:152`).
13. **The dev CSP meta tag under `NODE_ENV=test`** ships without the configured PocketBase origin, and its source list is separate from `config/csp.cjs`.

## One checker claim corrected

`lib/tasks/crud/README.md`: the checker reported that `update.ts:40-43` logs the raw `updates` object, including title and description. The object is passed to the logger, but `lib/logger.ts:sanitizeValue` recurses into nested objects through `sanitizeMetadata`, which masks keys named `title`, `description`, `tags`, `subtasks`, and `notes`. So task text in `updates` is masked before output. The related root-README finding still stands in part: `errorMessage` and the log `message` argument get token masking only.

## What this report does not cover

* Checkers read code. Nothing was run: no tests, no scripts, no TLC, no Docker.
* Each README had one checker and one pass. A second pass would likely find more `UNDOCUMENTED` items.
* Two data files were read for shape only (`lib/whats-new/whats-new.json`, `tools/stagehand/eval/cases.json`), and `app/globals.css` as an outline.
* For the root README's Global Invariants, 8 of 13 cited files were read at the cited symbol only.
* The existing text of the five pre-existing READMEs was out of scope. Disagreements there are in `bootstrap_findings.md`.
* No README was changed in response to this report.
