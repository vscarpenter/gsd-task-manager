# Sync

## Overview

This package is the optional cloud sync layer. It signs a user in to a self-hosted PocketBase server with OAuth, pushes queued local changes, pulls remote changes, and listens for realtime updates. IndexedDB stays the source of truth. Sync is off until a user signs in.

The sync state lives in the Dexie `syncMetadata`, `syncQueue`, and `syncHistory` tables. The PocketBase SDK keeps the auth token in `localStorage`.

## Interface

Subdirectory:

- [Sync Config](./config/README.md). Reads and writes the `sync_config` row, and enables and disables sync. `config.ts` re-exports its eight functions.

Auth, client, and account (`pb-auth.ts`, `oauth-callback.ts`, `pocketbase-client.ts`, `pb-account-deletion.ts`, `sign-out-everywhere.ts`, `sync-session.ts`):

- `pocketbase-client.ts:getPocketBase(): PocketBase`. Returns the SDK singleton for `ENV_CONFIG.pocketBaseUrl`.
- `pocketbase-client.ts:clearPocketBase(): void`. Clears the auth store and drops the singleton.
- `pocketbase-client.ts:forgetRefusedToken(pb, refusedToken): void`. Clears the auth store only when it still holds the refused token.
- `pocketbase-client.ts:isAuthenticated(): boolean`. True when the auth store is valid.
- `pocketbase-client.ts:getCurrentUserId(): string | null`. Returns the signed-in user's record id.
- `pb-auth.ts:OAuthProvider`. Type `'google' | 'github' | 'apple'`.
- `pb-auth.ts:AuthState`, `pb-auth.ts:OAuthLoginOptions`. Login result and options (`popupWindow`, `requestKey`, `timeoutMs`).
- `pb-auth.ts:prepareOAuthLogin(): void`. Fetches the auth methods before the click.
- `pb-auth.ts:openOAuthPopup(provider): Window | null`. Opens a blank popup for the provider page.
- `pb-auth.ts:loginWithProvider(provider, options?): Promise<AuthState>`. Runs the OAuth manual code flow.
- `pb-auth.ts:loginWithGoogle`, `pb-auth.ts:loginWithGithub`, `pb-auth.ts:loginWithApple`. Wrappers over `loginWithProvider`.
- `pb-auth.ts:cancelOAuthLogin(requestKey): void`. Aborts an in-flight sign-in.
- `pb-auth.ts:isOAuthCancellation(error): boolean`. True when the user ended the sign-in.
- `pb-auth.ts:getOAuthErrorMessage(error): string`. Returns a message for a failed sign-in.
- `pb-auth.ts:AuthRefreshOutcome`. Type `'refreshed' | 'no-session' | 'rejected' | 'unreachable'`.
- `pb-auth.ts:refreshAuthOutcome(): Promise<AuthRefreshOutcome>`. Refreshes the token and reports how it ended.
- `pb-auth.ts:refreshAuth(): Promise<boolean>`. True when the refresh succeeded.
- `pb-auth.ts:ensureValidAuth(): Promise<boolean>`. Confirms a usable session for a background operation.
- `oauth-callback.ts:OAUTH_CALLBACK_CHANNEL`. BroadcastChannel name `'gsd-oauth-callback'`.
- `oauth-callback.ts:OAUTH_REDIRECT_PATH`. Server bounce path `'/api/gsd/oauth-callback'`.
- `oauth-callback.ts:OAuthCallbackMessage`, `oauth-callback.ts:OAuthRelayOutcome`, `oauth-callback.ts:OAuthProviderError`. Relay message, relay outcome (`'delivered' | 'unclaimed' | 'invalid'`), and error type.
- `oauth-callback.ts:parseOAuthCallback(search): OAuthCallbackMessage | null`. Parses `state`, `code`, and `error` from a query string.
- `oauth-callback.ts:relayOAuthCallback(fragment, ackWaitMs?): Promise<OAuthRelayOutcome>`. The callback page calls it to relay the result.
- `oauth-callback.ts:waitForOAuthCallback(expectedState, signal): Promise<string>`. Resolves with the code relayed for this tab's state.
- `pb-account-deletion.ts:deleteRemoteAccountAndTasks(options?): Promise<DeleteAccountResult>`. Deletes the user's remote tasks, then the user record.
- `pb-account-deletion.ts:DeleteAccountResult`, `pb-account-deletion.ts:DeleteAccountOptions`. Result (`ok`, `stage`, `authRejected`, `error`, `remoteTasksErased`) and options (`throttleMs`).
- `sign-out-everywhere.ts:signOutEverywhere(): Promise<SignOutEverywhereResult>`. Ends every session for the user, then signs out on this device.
- `sign-out-everywhere.ts:SignOutEverywhereResult`. Interface with `otherSessionsEnded`.
- `sign-out-everywhere.ts:LocalSignOutIncompleteError`. Thrown when the server call ran but local sign-out failed.
- `sync-session.ts:StaleSyncSessionError`. Thrown when a sync write belongs to an ended session.
- `sync-session.ts:getSessionOwner(config): string | null`. Returns the account a sync runs for.
- `sync-session.ts:assertSyncSessionCurrent(ownerId): Promise<void>`. Throws unless `sync_config` still names `ownerId` as the enabled account.

Types and toasts (`types.ts`, `notifications.ts`):

- `types.ts:PBSyncConfig`. The `sync_config` row stored in `syncMetadata`.
- `types.ts:BackgroundSyncConfig`. Auto-sync settings.
- `types.ts:SyncQueueItem`, `types.ts:SyncQueueItemStatus`. A queued operation and its status (`'pending' | 'failed'`).
- `types.ts:RemoteTaskIndexEntry`. Interface with `pbRecordId` and `clientUpdatedAt`.
- `types.ts:ResurrectOnSightRecord`. The `resurrect_on_sight` row with `taskIds`.
- `types.ts:DeviceInfo`. The `device_info` row.
- `types.ts:PBSyncResult`. Sync result with status `'success' | 'error' | 'partial' | 'already_running' | 'cancelled'`.
- `types.ts:SyncConfig`, `types.ts:SyncResult`. Deprecated aliases of `PBSyncConfig` and `PBSyncResult`.
- `notifications.ts:notifySyncSuccess(pushedCount, pulledCount, options?)`. Shows a success toast when changes moved.
- `notifications.ts:notifySyncError(error, isPermanent?, options?)`. Shows an error toast.
- `notifications.ts:SyncNotificationOptions`. Interface with `enabled`.

Push, pull, engine, and realtime (`pb-push.ts`, `pb-pull.ts`, `pb-sync-engine.ts`, `pb-realtime.ts`):

- `pb-sync-engine.ts:fullSync(triggeredBy: 'user' | 'auto' = 'auto'): Promise<PBSyncResult>`. Runs one full sync and records its outcome.
- `pb-sync-engine.ts:applyRemoteChange(action, record, ownerId): Promise<void>`. Applies one realtime create, update, or delete to IndexedDB.
- `pb-sync-engine.ts`. Also re-exports `pushLocalChanges`, `PushResult`, and `pullRemoteChanges`.
- `pb-push.ts:pushLocalChanges(sessionOwnerId: string): Promise<PushResult>`. Pushes every pending queue item to PocketBase.
- `pb-push.ts:PushResult`. Interface with `pushedCount`, `failedCount`, `lastError`, `authenticated`, and `retryAfterMs`.
- `pb-pull.ts:pullRemoteChanges(lastClientUpdatedAt, options?)`. Fetches remote tasks at or past the cursor and applies them. Returns `pulledCount`, `skippedCount`, `authenticated`, and `maxObservedTimestamp`.
- `pb-pull.ts:PullOptions`. Interface with `mergeSameVersion` and `storedContractVersion`.
- `pb-pull.ts:unreadFieldRepair(local, remote, storedContractVersion): TaskRecord | null`. Returns a local row repaired with fields its build never read, or `null`.
- `pb-realtime.ts:subscribe(deviceId: string): Promise<void>`. Subscribes to the `tasks` collection over SSE.
- `pb-realtime.ts:unsubscribe(): void`. Stops the realtime subscription.

Helpers, wire mapping, queue, resurrection, and coordinator (`pb-sync-helpers.ts`, `task-mapper.ts`, `queue.ts`, `resurrect-ids.ts`, `resurrect-on-sight.ts`, `sync-coordinator.ts`):

- `pb-sync-helpers.ts:THROTTLE_MS`. Delay between API requests, 100 ms.
- `pb-sync-helpers.ts:delay(ms): Promise<void>`. Resolves after a timeout.
- `pb-sync-helpers.ts:escapeFilterValue(value): string`. Escapes a value for a PocketBase filter expression.
- `pb-sync-helpers.ts:assertSafeRecordId(value, label?): void`. Throws unless the value is a safe id.
- `pb-sync-helpers.ts:getDeviceId(): Promise<string>`. Reads the device id from `sync_config`, or `'unknown'`.
- `pb-sync-helpers.ts:getCurrentUserId`. Re-export from `pocketbase-client.ts`.
- `pb-sync-helpers.ts:fetchBoundedRemoteTasks(options): Promise<RecordModel[]>`. Fetches a complete, capped task listing page by page.
- `pb-sync-helpers.ts:fetchRemoteTaskIndex(ownerId)`. Returns a map of task id to `RemoteTaskIndexEntry`, plus `fetchSucceeded`.
- `pb-sync-helpers.ts:fetchRemoteTaskEntry(ownerId, taskId)`. Looks up one remote task. Returns `entry` and `fetchSucceeded`.
- `pb-sync-helpers.ts:confirmSessionIdentity(ownerId): Promise<void>`. Asks the server whether this session is the owner's.
- `pb-sync-helpers.ts:SessionIdentityMismatchError`, `pb-sync-helpers.ts:SessionRejectedError`. Errors for another account's record and for a refused token.
- `pb-sync-helpers.ts:readClientUpdatedAt(record): string | undefined`. Reads the raw `client_updated_at`.
- `pb-sync-helpers.ts:isBeyondClockSkew(iso, nowMs?): boolean`. True for a stamp past the skew ceiling.
- `pb-sync-helpers.ts:holdsOffFarFutureRemote(rawUpdatedAt, taskId): Promise<boolean>`. True when a far-future remote meets a pending queued write.
- `pb-sync-helpers.ts:isRemoteNewerThanArchive(remoteUpdatedAt, archivedAt, nowMs?): boolean`. Decides whether a remote edit outranks a local tombstone.
- `pb-sync-helpers.ts:mapOverLocalCopy(record, remoteTask, ...localCopies): TaskRecord | null`. Maps a pulled record over this device's copy.
- `task-mapper.ts:PBTaskRecord`. Shape of a task in the PocketBase `tasks` collection (snake_case fields).
- `task-mapper.ts:PocketBaseTaskIdentity`, `task-mapper.ts:PocketBaseRealtimeEnvelope`. Parsed identity and realtime envelope shapes.
- `task-mapper.ts:taskRecordToPocketBase(task, ownerId, deviceId, defaultNotifyBefore): Partial<PBTaskRecord>`. Maps a local task to the wire format.
- `task-mapper.ts:pocketBaseToTaskRecord(record, existingLocal?): TaskRecord | null`. Validates and maps a remote record to a local task.
- `task-mapper.ts:placementToWire(current)`. Returns `saved_at`, `focus_date`, and `focus_rank` from the current row.
- `task-mapper.ts:clampClientTimestamp(iso, nowMs?): string`. Caps a far-future client timestamp.
- `task-mapper.ts:getPocketBaseTaskId(record): string | null`, `task-mapper.ts:getPocketBaseTaskIdentity(record)`, `task-mapper.ts:getPocketBaseRealtimeEnvelope(record)`. Validated readers of record fields.
- `queue.ts:SyncQueue`. Class with `enqueue`, `getPending`, `getPendingCount`, `getFailed`, `dequeue`, `dequeueBulk`, `recordAttemptFailure`, `clear`, `getForTask`, and `populateFromExistingTasks`.
- `queue.ts:getSyncQueue(): SyncQueue`. Returns the singleton queue.
- `queue.ts:isPendingSyncQueueItem(item): boolean`. True for a row a push will attempt.
- `queue.ts:classifyRemoteDeletion(rowsForTask): RemoteDeletionDecision`. Decides what a remote deletion may do to one local task.
- `queue.ts:RemoteDeletionVerdict`, `queue.ts:RemoteDeletionDecision`. Verdict `'protect' | 'abandon' | 'apply'`, plus `staleRowIds`.
- `resurrect-ids.ts:rememberForResurrect(taskIds): Promise<void>`. Remembers ids whose delete never reached the server.
- `resurrect-ids.ts:forgetForResurrect(taskIds): Promise<void>`. Forgets ids.
- `resurrect-ids.ts:readRememberedTaskIds(): Promise<string[]>`. Reads the remembered ids.
- `resurrect-ids.ts:trashDeleteTaskIds(rows): string[]`. Returns the task ids of queued Trash deletes.
- `resurrect-on-sight.ts:resurrectOnSight(ownerId): Promise<void>`. Brings back each remembered task the account still lists.
- `sync-coordinator.ts:SyncCoordinator`. Class with `requestSync`, `onPulled`, `isSyncing`, `getStatus`, and `cancelPending`.
- `sync-coordinator.ts:getSyncCoordinator(): SyncCoordinator`. Returns the singleton coordinator.
- `sync-coordinator.ts:SyncStatus`. Interface for the coordinator's status snapshot.

Scheduling, errors, health, retry, and status (`background-sync.ts`, `error-categorizer.ts`, `health-monitor.ts`, `retry-manager.ts`, `sync-provider.tsx`, `sync-status-poll.ts`, `sync-status-store.ts`):

- `background-sync.ts:BackgroundSyncManager`. Class with `start(config, deviceId?)`, `stop()`, `isRunning()`, and `scheduleDebouncedSync()`.
- `background-sync.ts:getBackgroundSyncManager(): BackgroundSyncManager`. Returns the singleton manager.
- `error-categorizer.ts:isTransientError(error: Error): boolean`. Matches network, timeout, 5xx, and 429 message text.
- `error-categorizer.ts:isAuthError(error: Error): boolean`. Matches 401, 403, and auth message text.
- `error-categorizer.ts:isSessionRefusal(error: unknown): boolean`. True only for `status === 401`.
- `error-categorizer.ts:isTransientSyncFailure(error: unknown): boolean`. True for failures the retry machinery already handles.
- `error-categorizer.ts:SyncErrorCode`. Union of `rate_limited`, `unauthorized`, `validation_failed`, `not_found`, `server_error`, `network_error`, and `unknown_error`.
- `error-categorizer.ts:sanitizeSyncError(error: unknown): SyncErrorCode`. Turns a thrown value into a stable code.
- `error-categorizer.ts:parseRetryAfterMs(value): number | null`. Parses a `Retry-After` header as seconds or an HTTP date.
- `error-categorizer.ts:extractRetryAfterMs(error: unknown): number | null`. Reads a captured `retryAfterMs` from an error's response body.
- `health-monitor.ts:HealthMonitor`. Class with `check(): Promise<HealthReport>`.
- `health-monitor.ts:getHealthMonitor(): HealthMonitor`. Returns the singleton monitor.
- `health-monitor.ts:HealthIssue`, `health-monitor.ts:HealthReport`. Issue types are `stale_queue`, `token_expired`, `server_unreachable`, and `failed_items`.
- `retry-manager.ts:RetryManager`. Class with `recordFailure`, `recordSuccess`, `getNextRetryDelay`, `shouldRetry`, `getRetryCount`, and `canSyncNow`.
- `retry-manager.ts:getRetryManager(): RetryManager`. Returns the singleton manager.
- `retry-manager.ts:RecordFailureOptions`. Interface with `retryAfterMs`.
- `sync-provider.tsx:SyncProvider({ children })`. App-level React provider that owns the sync lifecycle.
- `sync-provider.tsx:useSyncContext(): SyncState`. Reads sync state from the nearest provider.
- `sync-provider.tsx:SyncState`. `SyncStatusSnapshot` plus `sync(): Promise<PBSyncResult>`.
- `sync-status-store.ts:SyncStatusStore`. Class with `subscribe`, `getSnapshot`, `dispatch`, `start`, and `stop`.
- `sync-status-store.ts:createSyncStatusStore(): SyncStatusStore`. Creates a store.
- `sync-status-store.ts:SyncStatusSnapshot`, `sync-status-store.ts:initialSyncStatus`, `sync-status-store.ts:SyncStatusAction`. Snapshot shape, its initial value, and the reducer's actions.
- `sync-status-poll.ts:guardPoll(poll, run): () => Promise<void>`. Wraps a status poll so a failed read is logged and dropped.
- `sync-status-poll.ts:SyncStatusPoll`. Type `'enabled' | 'coordinator' | 'pendingCount' | 'health'`.

## Invariants

Auth, client, and account:

- `pb-auth.ts` uses the OAuth2 manual code flow. It never uses the SDK's realtime `authWithOAuth2({ provider })` form, which delivers the code to whichever realtime client the `state` names.
- `pb-auth.ts:ALLOWED_OAUTH_PROVIDERS` is a runtime whitelist of `google`, `github`, and `apple`. `loginWithProvider` throws for any other value.
- `pb-auth.ts:preparedAuthMethods` is taken by one sign-in, so a state and PKCE verifier are never reused.
- `pb-auth.ts:DEFAULT_OAUTH_TIMEOUT_MS` is 10 minutes. It only bounds a sign-in nobody returns to.
- `pb-auth.ts:AUTH_REFRESH_THRESHOLD_SECONDS` is 7 days, matching iOS and Android. PocketBase refreshes only a token that has not expired.
- `pb-auth.ts:ensureValidAuth` returns false for a rejected refresh even when the token is unexpired, because the session was revoked. An unreachable server keeps a still-valid token usable.
- `pb-auth.ts:refreshAuthOutcome` forgets a token the server refuses with a session refusal, so the sync dialog offers sign-in.
- `oauth-callback.ts:waitForOAuthCallback` ignores a message for any other state. Only the tab that started sign-in holds the matching state and verifier.
- `oauth-callback.ts:waitForOAuthCallback` acknowledges the message it takes, so the callback page can tell a delivered sign-in from an abandoned one.
- `oauth-callback.ts:boundedParam` drops a parameter longer than 2048 characters. `oauth-callback.ts:ACK_WAIT_MS` is 3000.
- `pocketbase-client.ts:getPocketBase` turns off SDK auto-cancellation, so concurrent requests do not cancel each other.
- `pocketbase-client.ts:clearPocketBase` swaps the retired client onto an in-memory store. A late `authRefresh` response for the signed-out account then lands in a throwaway.
- `pocketbase-client.ts:forgetRefusedToken` clears only the refused token. Another tab may have saved a new one while the refusal was in flight.
- `pb-account-deletion.ts:deleteRemoteAccountAndTasks` deletes remote tasks first, then the user record. The `owner` field is plain text, so deleting the user does not cascade.
- `pb-account-deletion.ts:drainRemoteTasks` reports success only after a complete listing comes back empty. It gives up after 3 passes (`MAX_ERASURE_PASSES`).
- `pb-account-deletion.ts:isRouteNotDeployed` treats only a real 404 as an absent route. An offline failure reports status 0.
- `pb-account-deletion.ts` performs the remote operation only. The caller touches local state only after a confirmed remote success. One exception: its opening `refreshAuthOutcome()` call can clear a refused auth token.
- `sign-out-everywhere.ts:signOutEverywhere` keeps the user signed in when a failure leaves the other sessions in doubt.
- `sign-out-everywhere.ts:outcomeOfFailedRevoke` treats a 404 as "this device only" and a 401 on an unexpired token as "already rotated".
- `sync-session.ts:assertSyncSessionCurrent` must run before the first write, inside a transaction that scopes `syncMetadata`. The check and the write then commit or abort together.
- `sync-session.ts` reads persisted state, not memory, so the fence also covers a second tab and a sync that outlives a reload.

Types:

- `types.ts:PBSyncConfig.lastServerUpdatedAt` is deprecated. It must never be reused as a `client_updated_at` cursor.
- `types.ts:PBSyncConfig.localTaskOwnerUserId` survives logout, so a later login cannot replay one user's local tasks into another account.
- `types.ts:SyncQueueItem.status` moves to `'failed'` at `MAX_RETRIES` instead of the row being deleted, so unsynced edits are kept.
- `types.ts:ResurrectOnSightRecord` is device-local and never synced.

Push, pull, engine, and realtime:

- `pb-sync-engine.ts:runSyncPasses` pushes, then pulls, on an ordinary sync. While a backfill is owed it pulls first, so no push sends a never-read field empty.
- `pb-sync-engine.ts:isBackfillOwed` is true when the stored contract version is missing or below `SYNC_CONFIG.PULL_CURSOR_VERSION` (ADR 0020). A backfill pulls with a `null` cursor and `mergeSameVersion`.
- `pb-sync-engine.ts:updateSyncCursor` stamps this build's version only after a completed pull, never the highest seen. It merges cursor fields into the current row, not the start-of-sync snapshot.
- `pb-sync-engine.ts:writeSyncOutcome` commits retry state and history in one transaction over `syncMetadata` and `syncHistory`, with the session check. A sync that outlived its session records nothing.
- `pb-sync-engine.ts:fullSync` returns `cancelled` when the session ends partway. It leaves no cursor, retry state, history row, or toast.
- `pb-sync-engine.ts:reportSyncError` persists and shows only the sanitized error code. PocketBase 4xx bodies can echo task titles.
- `pb-pull.ts:applyRemoteRecords` and `pb-sync-engine.ts:applyRemoteChange` run one `rw` transaction over `tasks`, `archivedTasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`. Each calls `assertSyncSessionCurrent` first.
- `pb-pull.ts:applyPreparedRecord` and `pb-sync-engine.ts:applyRemoteChange` skip a remote record for an archived or trashed id unless `isRemoteNewerThanArchive` says the remote edit is newer. A newer edit removes the tombstone row in the same transaction.
- `pb-pull.ts:acceptsRemoteVersion` is last-write-wins. A strictly newer remote wins. A same-version remote is accepted only during a backfill.
- `pb-pull.ts:pullRemoteChanges` filters and sorts on `client_updated_at`, never the system `updated` field. It queries with `>=` and sorts by `client_updated_at,task_id,id`.
- `pb-pull.ts:pullRemoteChanges` advances the cursor only from records committed locally. `findMaxAppliedClientUpdated` clamps future values to now, and `CURSOR_OVERLAP_MS` subtracts 30 seconds.
- `pb-pull.ts:repairUnreadFields` is a repair, not a pull. It does not count as pulled and does not move the cursor.
- `pb-pull.ts:reconcileDeletedTasks` runs one transaction over `tasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`. It skips reconciliation when the remote index fetch failed.
- `pb-pull.ts:reconcileDeletedTasks` calls `confirmSessionIdentity` before it deletes anything. An empty listing is also what a rejected token gets.
- `pb-pull.ts:planRemoteAbsence` protects a task with a push-eligible queue row. It moves a task whose queue rows are all retry-exhausted to Trash (`bulkPut`).
- `pb-sync-engine.ts:applyRemoteDeletion` uses the same `classifyRemoteDeletion` as the pull, in one transaction over `tasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`.
- `pb-sync-engine.ts:localCopyHolds` applies a realtime create or update only when the remote is strictly newer. A far-future remote over a pending local write is held off.
- `pb-push.ts:resolvePushPrincipal` refuses a push when the SDK principal is not the session owner. It throws `StaleSyncSessionError`. The check runs once, at the start of `pushLocalChanges`, and compares the in-memory SDK principal.
- The push path's local writes never call `assertSyncSessionCurrent`. This covers `queue.ts:dequeue`, `queue.ts:recordAttemptFailure`, and `pb-push.ts:settleRowOffset` (a write to `tasks`).
- `pb-push.ts:pushUpsert` and `pb-push.ts:pushDelete` skip and dequeue a stale operation when the remote is strictly newer. They record an attempt failure when the remote lookup failed.
- `pb-push.ts:isRemoteNewer` never treats a remote stamp beyond now plus `MAX_CLIENT_CLOCK_SKEW_MS` as newer, so a local edit can heal a poisoned record.
- `pb-push.ts:isStaleDelete` skips an archive's delete when the remote is newer than the archived version (B-46).
- `pb-push.ts:createPushSessionCheck` confirms the session before a create and before dropping a delete that found no remote record. A refused token reads as a guest and 404s every lookup.
- `pb-push.ts:pushLocalChanges` stops on a session check failure without charging queue rows. A retired row never re-arms.
- `pb-push.ts:pushLocalChanges` runs sequentially with `THROTTLE_MS` between items, and aborts the loop when an item throws a 429. A 429 on the per-item lookup (`pb-sync-helpers.ts:fetchRemoteTaskEntry`) charges that row one attempt, and the loop continues.
- `pb-push.ts:recordItemFailure` persists a stable error code only, never the raw message.
- `pb-push.ts:upsertRemoteTask` takes `saved_at`, `focus_date`, and `focus_rank` from the current row (`placementToWire`), not the queued payload.
- `pb-push.ts:resolveNotifyBefore` never sends a null offset (D-10). It sends the payload's value, else the stored row's, else this device's default.
- `pb-push.ts:settleRowOffset` writes the resolved offset only when the row's `updatedAt` still matches. It bumps no stamp and queues nothing.
- `pb-realtime.ts:subscribe` is single-flight per device. A generation counter discards a subscription that a newer call replaced.
- `pb-realtime.ts:handleRealtimeEvent` skips an echo only when both device ids are non-empty and equal. It drops events whose `ownerId` is not the current user.

Helpers, wire mapping, queue, resurrection, and coordinator:

- `pb-sync-helpers.ts:fetchBoundedRemoteTasks` never materializes more than `SYNC_CONFIG.MAX_REMOTE_TASKS` records. It throws on malformed pagination, a total that changes mid-scan, or a page that makes no progress.
- `pb-sync-helpers.ts:fetchRemoteTaskIndex` fails closed. A malformed or duplicate row returns an empty index with `fetchSucceeded: false`.
- `pb-sync-helpers.ts:fetchRemoteTaskEntry` treats a 404 as "no remote record, fetch succeeded". Any other error is a failed fetch.
- `pb-sync-helpers.ts:assertSafeRecordId` accepts 1 to 50 characters of letters, digits, hyphens, and underscores. `escapeFilterValue` rejects values over 500 characters.
- `pb-sync-helpers.ts:confirmSessionIdentity` reads the auth-refresh answer and drops it, never saves it. A saved answer could land over a newer sign-in.
- `pb-sync-helpers.ts:confirmSessionIdentity` throws `SessionRejectedError` on a session refusal, after it forgets the refused token. The caller must then write nothing.
- `pb-sync-helpers.ts:isRemoteNewerThanArchive` is the shared tombstone comparison for pull and realtime. It returns false for missing or unparseable timestamps and for a far-future stamp.
- `pb-sync-helpers.ts:holdsOffFarFutureRemote` must run inside a transaction that scopes `syncQueue`. Only pending rows count (S-AND-02).
- `pb-sync-helpers.ts:mapOverLocalCopy` keeps device-local fields from the live, archive, or Trash copy (S-IOS-02).
- `task-mapper.ts:pocketBaseToTaskRecord` validates with `pbTaskRecordSchema` and returns `null` for a record that fails. Limits mirror `SCHEMA_LIMITS`.
- `task-mapper.ts:pocketBaseToTaskRecord` clamps `client_updated_at` to now plus `MAX_CLIENT_CLOCK_SKEW_MS` (5 minutes).
- `task-mapper.ts:localReminderState` keeps `notificationSent`, `lastNotificationAt`, and `snoozedUntil` from the local copy. A pull that moves the due date resets them.
- `task-mapper.ts:pocketBaseToTaskRecord` always takes `parentTaskId` from the local record. It has no wire field (WEB-PULL-PARENT).
- `task-mapper.ts:taskRecordToPocketBase` always sends a numeric `notify_before` (D-10). Empty optional strings go out as `''`.
- `task-mapper.ts:placementToWire` reads placement from the current row. A row no longer in `tasks` sends none of the keys, so the server keeps its values (C4-6).
- `task-mapper.ts:pbTaskRecordSchema` never rejects a record for a bad `focus_date` or `focus_rank`. `focusFromWire` turns an invalid pair into neither field.
- `queue.ts:recordAttemptFailure` moves a row to `'failed'` at `SYNC_CONFIG.MAX_RETRIES` instead of deleting it. It truncates `lastError` to 500 characters.
- `queue.ts:getPending` never returns a failed row, and nothing re-arms one.
- `queue.ts:isPendingSyncQueueItem` treats an undefined status as pending, for rows that predate v14.
- `queue.ts:classifyRemoteDeletion` protects a task with any pending row. With only failed rows the verdict is `'abandon'`, and the caller moves the task to Trash.
- `queue.ts:classifyRemoteDeletion` returns `staleRowIds` that the caller deletes in the same transaction. A dead row can never outlive the task it guarded.
- `queue.ts:populateFromExistingTasks` enqueues a `create` only for a task with no queue rows.
- `resurrect-ids.ts:rememberForResurrect` and `forgetForResurrect` need the caller's transaction to scope `syncMetadata`.
- `resurrect-ids.ts:forgetForResurrect` runs on every way out of Trash, in the same transaction, so the list is never longer than Trash (S-WEB-05).
- `resurrect-ids.ts:trashDeleteTaskIds` counts only deletes with no payload. An archive's delete carries the task and is not remembered.
- `resurrect-ids.ts` uses plain Dexie with no SDK imports, so Trash and task writers can use it without pulling in sync.
- `resurrect-on-sight.ts:applyResurrections` runs one transaction over `tasks`, `archivedTasks`, `deletedTasks`, `syncQueue`, and `syncMetadata`, with the session check first.
- `resurrect-on-sight.ts:resurrectOnSight` forgets nothing without a complete listing for the confirmed owner. A failed step does not fail the sync, with two exceptions. It rethrows `SessionRejectedError` from the listing and `StaleSyncSessionError` from the apply step.
- `resurrect-on-sight.ts:resurrectOne` leaves an archive row standing. It moves a task out of Trash only when the account lists it, and removes the Trash row in the same step.
- `resurrect-on-sight.ts:takeIfStrictlyNewer` applies last-write-wins to a copy that is already live.
- `sync-coordinator.ts:requestSync` holds `isRunning` across backoff checks, the sync, and the queue drain. Two `fullSync` runs can never overlap.
- `sync-coordinator.ts:queueRequest` deduplicates pending requests. A user request supersedes an auto request.
- `sync-coordinator.ts:canRunAutoSync` blocks an auto sync during retry backoff or after max retries. A user sync bypasses backoff.
- `sync-coordinator.ts:pullCompleted` gates `onPulled` listeners. A pull that skipped records does not count.
- `sync-coordinator.ts:notifyPulled` runs listeners on a microtask and does not await them. A failing listener is logged.

Scheduling, errors, health, retry, and status:

- `background-sync.ts:BackgroundSyncManager` does not own realtime SSE. It is the periodic safety net and the event-triggered scheduler.
- `background-sync.ts:performSyncIfNeeded` skips a sync while offline, and skips periodic and debounced syncs while the page is hidden. It allows at most one sync per 15 seconds (`MIN_SYNC_INTERVAL_MS`).
- `background-sync.ts:start` stops a running instance before it starts again, and starts no timers when `config.enabled` is false.
- `error-categorizer.ts:isSessionRefusal` counts only a 401. A 403 more likely comes from something in front of the server and says nothing about the session.
- `error-categorizer.ts:sanitizeSyncError` strips all original message content. PocketBase 4xx responses can echo task content into `syncQueue.lastError` or `syncHistory.errorMessage`.
- `error-categorizer.ts:sanitizeSyncError` checks in a fixed order. A non-Error value returns `unknown_error`, then a structured `status` of 0 returns `network_error`. Message matching follows: rate limit, auth, not found, validation, server error, network.
- `error-categorizer.ts:isTransientSyncFailure` trusts the structured `status` field (0, 429, or 5xx) before message text. Unknown errors return false, so new failure modes still log as errors.
- `retry-manager.ts:resolveRetryDelay` lets a server `Retry-After` win over the backoff schedule, clamped to `MAX_RETRY_AFTER_MS`.
- `retry-manager.ts:getNextRetryDelay` uses `RETRY_DELAYS` (5 s, 10 s, 30 s, 60 s, 300 s) and caps at the last value.
- `retry-manager.ts:shouldRetry` is false once `consecutiveFailures` reaches `MAX_RETRIES`.
- `retry-manager.ts:recordFailure` persists only the sanitized failure code as `lastFailureReason`.
- `health-monitor.ts:HealthMonitor` keeps no timer of its own. The sync status store calls `check()` on its schedule.
- `health-monitor.ts:check` returns healthy with no issues while sync is disabled.
- `health-monitor.ts:checkAuth` tries a silent refresh through `ensureValidAuth` before it reports `token_expired`.
- `health-monitor.ts:checkServerConnectivity` skips the network call when `navigator.onLine` is false.
- `sync-provider.tsx:SyncProvider` mounts once, creates one store, and starts it once. `useSyncContext` throws outside a provider.
- `sync-status-store.ts:SyncStatusStore` is the one owner of sync status polling. Every poll runs through `guardPoll`.
- `sync-status-store.ts:mergeIfChanged` returns the same reference when a poll changes nothing, so no `useSync()` consumer re-renders.
- `sync-status-store.ts:checkEnabled` publishes the enabled flag before it reconciles realtime and background sync. Waiting would show a signed-in user as signed out.
- `sync-status-store.ts:hasStatusToWatch` keeps the 500 ms status poll running while a sync is in flight, even after sign-out. A stalled status would leave the sync button locked.
- `sync-status-store.ts:reducePollAction` clears `pendingCount` and `healthReport` when sync switches off.
- `sync-status-store.ts:readSyncEnabled` is local only: an auth-store check and one IndexedDB read.

## Side Effects

Auth, client, and account:

- `pocketbase-client.ts:getPocketBase` creates the SDK client, which reads and writes the auth token in `localStorage`. It sets an `afterSend` hook that copies `Retry-After` into a 429 body as `retryAfterMs`.
- `pb-auth.ts:loginWithProvider` calls `listAuthMethods` and `authWithOAuth2Code` on the `users` collection, navigates a popup to the provider, and sets a timeout.
- `pb-auth.ts:openOAuthPopup` calls `window.open('about:blank', ...)`.
- `pb-auth.ts:refreshAuthOutcome` calls `authRefresh` on the `users` collection.
- `oauth-callback.ts:relayOAuthCallback` and `oauth-callback.ts:waitForOAuthCallback` open the `gsd-oauth-callback` BroadcastChannel and post messages on it.
- `pb-account-deletion.ts:deleteRemoteAccountAndTasks` first calls `refreshAuthOutcome()`, which sends `authRefresh` and can clear the local auth token through `forgetRefusedToken`. It then sends `DELETE /api/gsd/account`. On a 404 it lists remote tasks, deletes each `tasks` record with a throttle, then deletes the `users` record.
- `sign-out-everywhere.ts:signOutEverywhere` sends `DELETE /api/gsd/sessions`, then calls `disableSync()`. When `disableSync()` throws, it calls `clearPocketBase()` before it raises `LocalSignOutIncompleteError`.
- `sync-session.ts:assertSyncSessionCurrent` reads `syncMetadata`.
- `notifications.ts` shows `sonner` toasts.
- These files log through the `SYNC_AUTH` logger.

Push, pull, engine, and realtime:

- `pb-push.ts:pushLocalChanges` creates, updates, and deletes records in the PocketBase `tasks` collection. It dequeues or charges `syncQueue` rows and may update `notifyBefore` on a `tasks` row.
- `pb-pull.ts:pullRemoteChanges` lists the PocketBase `tasks` collection and writes `tasks`, `archivedTasks`, and `deletedTasks`. Reconciliation also deletes `tasks` rows and `syncQueue` rows.
- `pb-sync-engine.ts:fullSync` reads and writes the `sync_config` row in `syncMetadata`, writes `syncHistory`, and shows toasts through `notifySyncSuccess` and `notifySyncError`.
- `pb-sync-engine.ts:applyRemoteChange` writes `tasks`, `archivedTasks`, `deletedTasks`, and `syncQueue`.
- `pb-realtime.ts:subscribe` opens an SSE subscription with `pb.collection('tasks').subscribe('*', ...)` and keeps it in module state.
- These files log through the `SYNC_ENGINE` and `SYNC_REALTIME` loggers.

Helpers, wire mapping, queue, resurrection, and coordinator:

- `pb-sync-helpers.ts:fetchBoundedRemoteTasks` and `fetchRemoteTaskEntry` call `getList` and `getFirstListItem` on the PocketBase `tasks` collection.
- `pb-sync-helpers.ts:confirmSessionIdentity` sends `POST /api/collections/users/auth-refresh` and may clear the auth store.
- `pb-sync-helpers.ts:getDeviceId` reads `syncMetadata`. `holdsOffFarFutureRemote` reads `syncQueue`.
- `queue.ts:SyncQueue` reads and writes the `syncQueue` table. `populateFromExistingTasks` reads `tasks`.
- `resurrect-ids.ts` reads, writes, and deletes the `resurrect_on_sight` row in `syncMetadata`.
- `resurrect-on-sight.ts:resurrectOnSight` lists the PocketBase `tasks` collection, confirms the session, and writes `tasks`, `deletedTasks`, and `syncMetadata`.
- `sync-coordinator.ts:SyncCoordinator` calls `fullSync`, reads `syncMetadata`, and keeps run state in memory.
- `task-mapper.ts:pocketBaseToTaskRecord` logs a validation failure through the `SYNC_PULL` logger.

Scheduling, errors, health, retry, and status:

- `background-sync.ts:BackgroundSyncManager` runs a periodic `setInterval`, a 10 second initial `setTimeout`, and a debounce `setTimeout`. It listens to `visibilitychange` on `document` and `online` on `window`, and removes both on `stop()`.
- `background-sync.ts:performSyncIfNeeded` calls `getSyncCoordinator().requestSync('auto')`.
- `health-monitor.ts:check` reads `syncMetadata` and `syncQueue`, may refresh the auth token, and calls `pb.health.check()`.
- `retry-manager.ts:RetryManager` reads and writes the `sync_config` row through `getSyncConfig` and `updateSyncConfig`.
- `sync-status-store.ts:SyncStatusStore` runs four timers. The enabled check and the pending count run every 2 s. Coordinator status runs every 500 ms. Health runs after 10 s, then every 5 min.
- `sync-status-store.ts:applySyncServices` subscribes or unsubscribes realtime and starts or stops the background sync manager.
- `sync-provider.tsx:runManualSync` calls `requestSync('user')` and sets a `setTimeout` that resets status to idle (3 s after success, 10 s after an error).
- `error-categorizer.ts` and `sync-status-poll.ts`: None, apart from a warning log in `guardPoll`.

## Verification

- Run: `bun run test`
