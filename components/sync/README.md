# Sync

## Overview

This directory has the cloud sync UI.
It has the sync toolbar button, the sign-in and account dialog with its body sections, and the OAuth provider buttons.
Its hooks cover dialog state, sign-out (this device and all devices), sync status display, and sync health notifications.
`persistSyncConfig` is the one function here that writes to Dexie.

## Interface

- `SyncButton` (`sync-button.tsx`): takes no props. It is an icon button (`data-testid="sync-button"`) that syncs or opens `SyncAuthDialog`. It has a tooltip, a pending-count badge, an auth-error badge, and a retry countdown.
- `SyncAuthDialog` (`sync-auth-dialog.tsx`): modal dialog, portaled to `document.body`, that picks a section from dialog state. Props are `isOpen`, `onClose`, `onSuccess?`, and `syncEnabled?`.
- `OAuthButtons` (`oauth-buttons.tsx`): renders the Google, Apple, and GitHub "Continue with" buttons, a waiting status, and Cancel. Props are `onSuccess?`, `onError?`, `onStart?`, and `lastUsedProvider?`.
- `OPEN_SYNC_EVENT` (`open-sync-event.ts`): string constant `"gsd:open-sync"`. It is the window event name that opens the sync sign-in dialog.
- `useSyncDialogState` (`open-sync-event.ts`): hook that returns an `[open, setOpen]` tuple. It also sets open to true when `OPEN_SYNC_EVENT` fires on `window`.
- `RefreshingSection` (`sync-auth-dialog-sections.tsx`): takes no props. It renders a spinner with the text "Checking session...".
- `SessionExpiredSection` (`sync-auth-dialog-sections.tsx`): expired-session notice with `OAuthButtons` and a disconnect button. Props are `syncStatus`, `error`, `isLoading`, `oauthCallbacks`, and `onLogout`.
- `AuthenticatedSection` (`sync-auth-dialog-sections.tsx`): signed-in view with email, provider, an account note, Sign out, and sign-out-of-all-devices. Props are `syncStatus`, `error`, `isLoading`, `logout`, and `signOutEverywhere`.
- `UnauthenticatedSection` (`sync-auth-dialog-sections.tsx`): cloud sync disclosure copy, a privacy policy link, and `OAuthButtons`. Props are `error` and `oauthCallbacks`.
- `LogoutConfirmation` (`sync-auth-dialog-sections.tsx`): warning with the count of unsynchronized changes, Cancel, and "Sign out anyway". Props are `pendingChanges`, `isLoading`, `onCancel`, and `onConfirm`.
- `useLogout` (`use-logout.ts`): hook `(SignOutCallbacks) => LogoutControls`. It signs out this device and asks for confirmation only when pending changes exist.
- `LogoutControls` (`use-logout.ts`): interface with `showLogoutConfirm`, `pendingChanges`, `handleLogout`, `performLogout`, and `cancelLogout`.
- `SignOutCallbacks` (`use-logout.ts`): interface with `onSuccess?`, `onSignedOut`, `setIsLoading`, and `setError`.
- `useSignOutEverywhere` (`use-sign-out-everywhere.ts`): hook `(SignOutCallbacks) => SignOutEverywhereControls`. It always shows a confirmation before it signs out all devices.
- `SignOutEverywhereControls` (`use-sign-out-everywhere.ts`): interface with `showConfirm`, `pendingChanges`, `onRequest`, `onConfirm`, and `onCancel`.
- `useSyncAuthDialog` (`use-sync-auth-dialog.ts`): hook `({ isOpen, onSuccess?, syncEnabled? })`. It returns `isLoading`, `error`, `syncStatus`, `mounted`, `logout`, `sessionExpired`, `isRefreshing`, the OAuth handlers, and `signOutEverywhere`.
- `persistSyncConfig` (`use-sync-auth-dialog.ts`): `async (authState: AuthState)`. It writes the `sync_config` record in a Dexie transaction, then populates the sync queue.
- `SyncStatusInfo` (`use-sync-auth-dialog.ts`): interface `{ enabled: boolean; email: string | null; provider?: string | null }`.
- `useSyncHealth` (`use-sync-health.ts`): hook `({ healthReport, onHealthIssue, onSync })`. It calls `onHealthIssue` for each notifiable issue in an unhealthy report.
- `HealthNotification` (`use-sync-health.ts`): interface `{ id: string; message: string; action?: { label, onClick }; duration: number }`.
- `useSyncStatus` (`use-sync-status.ts`): hook that takes `isEnabled`, `status`, `error`, `nextRetryAt`, `pendingCount`, `onAuthError`, and `lastSuccessfulSyncAt?`. It returns `iconType`, `tooltip`, `pendingCount`, `hasAuthError`, and `retryCountdown`.
- `SyncStatus` (`use-sync-status.ts`): type `'syncing' | 'success' | 'error' | 'conflict' | 'idle'`.
- `IconType` (`use-sync-status.ts`): type `'cloud-off' | 'alert-auth' | 'clock' | 'cloud-syncing' | 'check-success' | 'x-error' | 'alert-conflict' | 'cloud-idle'`.

## Invariants

- `oauth-buttons.tsx:OAuthButtons`: every provider button is `disabled` while `loading !== null`, so one sign-in runs at a time.
- `oauth-buttons.tsx:useOAuthSignIn`: `onSuccess`, `onError`, and `setLoading(null)` run only while `mounted.current` is true.
- `oauth-buttons.tsx:useOAuthSignIn`: `finish()` clears `activeRequestKey` only if it still equals this run's `requestKey`.
- `oauth-buttons.tsx:useOAuthSignIn`: a comment explains the missing `finally` (React Compiler). `finish()` runs the cleanup on both paths.
- `oauth-buttons.tsx:createOAuthRequestKey`: the key format is `oauth_${provider}_${random}`. It uses `crypto.randomUUID()` when available, else `Date.now()` plus `Math.random()`.
- `oauth-buttons.tsx:SignInStatus`: the `role="status"` paragraph is always mounted. A comment says a live region that arrives with its text often goes unannounced.
- `sync-auth-dialog.tsx:SyncAuthDialog`: returns `null` unless `isOpen && state.mounted`.
- `sync-auth-dialog.tsx:DialogBody`: section order is `isRefreshing`, then `syncStatus?.enabled && sessionExpired`, then `syncStatus?.enabled`, then unauthenticated.
- `sync-auth-dialog.tsx:useSyncDialogFocus`: Escape calls `event.stopPropagation()`, then `onClose()`. Other keys go to `trapTab` from `useDialogFocus`.
- `sync-auth-dialog-sections.tsx:SignOutEverywhereConfirmation`: the discarded-changes line renders only when `pendingChanges > 0`.
- `sync-button.tsx:SyncButton.handleSync`: when sync is not enabled, it opens the auth dialog and returns. With `hasAuthError`, it shows a toast, opens the dialog, and returns. Otherwise it awaits `sync()`.
- `sync-button.tsx:SyncButton`: the button is `disabled={isSyncing}`. `TooltipProvider` uses `delayDuration={300}`.
- `sync-button.tsx:SyncStatusOverlays`: the pending badge requires `isEnabled && !hasAuthError && pendingCount > 0`. The countdown requires `!hasAuthError && retryCountdown > 0`.
- `use-logout.ts:useLogout.handleLogout`: when `status.pendingCount > 0`, it sets `showLogoutConfirm` and `pendingChanges` and returns without signing out. Only `AuthenticatedSection` renders `LogoutConfirmation`; `SessionExpiredSection` shows nothing.
- `use-sign-out-everywhere.ts:FALLBACK_NOTICE_MS`: the fallback warning toast lasts `10_000` ms.
- `use-sign-out-everywhere.ts:useSignOutEverywhere.onConfirm`: `finally` always sets `showConfirm` and `isLoading` to false.
- `use-sign-out-everywhere.ts:signOutEverywhereFailure`: `LocalSignOutIncompleteError` gets its own message, prefixed by `err.otherSessionsEnded`. Other errors report "You're still signed in".
- `use-sync-auth-dialog.ts:persistSyncConfig`: throws when `authState.userId` is falsy. The message says the sign-in response did not include an account ID.
- `use-sync-auth-dialog.ts:persistSyncConfig`: throws "Local tasks belong to a different sync account..." when any lifecycle count is above 0, `localTaskOwnerUserId` is truthy, and it differs from `authState.userId`.
- `use-sync-auth-dialog.ts:persistSyncConfig`: `localTaskOwnerUserId` resolves as `existingConfig?.localTaskOwnerUserId ?? existingConfig?.userId ?? null`.
- `use-sync-auth-dialog.ts:buildSyncConfig`: carries `pullCursorVersion` from `existingConfig` only. A comment states that only a completed pull may stamp the contract (ADR 0019).
- `use-sync-auth-dialog.ts:buildSyncConfig`: sets `key: "sync_config"`, `autoSyncEnabled: true`, `autoSyncIntervalMinutes: 2`, and `consecutiveFailures: 0`. `deviceName` is `navigator.userAgent.substring(0, 50)`. It reuses `deviceId` or calls `crypto.randomUUID()`. It sets `localTaskOwnerUserId` to `authState.userId`.
- `use-sync-auth-dialog.ts:buildSyncConfig`: resets `lastSyncAt`, `lastClientUpdatedAt`, `lastServerUpdatedAt`, `lastSuccessfulSyncAt`, `lastFailureAt`, `lastFailureReason`, and `nextRetryAt` to `null` on every sign-in. Only `deviceId` and `pullCursorVersion` carry over from `existingConfig`.
- `use-sync-auth-dialog.ts:useSyncAuthDialog.handleOAuthSuccess`: when `persistSyncConfig` fails, it calls `clearPocketBase()`, sets status to disabled, and throws "Signed in, but sync setup failed. ..." with `cause`.
- `use-sync-auth-dialog.ts:useSyncAuthDialog.handleOAuthStart`: a comment states that a sign-in never sets `isLoading`, because that draws a spinner over the whole dialog.
- `use-sync-auth-dialog.ts:useSyncAuthDialog.handleOAuthError`: sets the error to `null` when `isOAuthCancellation(err)`. Otherwise it uses `getOAuthErrorMessage(err)`.
- `use-sync-auth-dialog.ts:useSyncAuthDialog`: on the transition to open, render resets state with `logout.cancelLogout()`, `signOutEverywhere.onCancel()`, and `setSessionExpired(false)`.
- `use-sync-auth-dialog.ts:loadSyncStatus`: checks `cancellation.cancelled` before and after each `await`. It sets no state once cancelled.
- `use-sync-auth-dialog.ts:validateTokenAndRefresh`: if `isAuthenticated()` is false, it awaits `refreshAuth()` and sets `sessionExpired` to `!refreshed`.
- `use-sync-health.ts:useSyncHealth`: skips reports that are `null`, `healthy`, or have no issues. It also skips reports with a `timestamp` earlier than `mountedAtRef.current`.
- `use-sync-health.ts:useSyncHealth`: skips a report when `healthReport.timestamp - lastNotificationTimeRef.current < SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS`. The cooldown uses report timestamps.
- `use-sync-health.ts:buildNotification`: notifies only for `severity === 'error'` or `type === 'stale_queue'` (with a "Sync Now" action). The id is `sync-health-${issue.type}` and the duration is `SYNC_TOAST_DURATION.LONG`.
- `use-sync-status.ts:useSyncStatus`: `onAuthError` fires only on the transition into an auth error, with `SYNC_TOAST_DURATION.LONG`.
- `use-sync-status.ts:getIconType`: precedence is not enabled, auth error, `retryCountdown > 0`, `showsLastFailure`, then the status icon.
- `use-sync-status.ts:showsLastFailure`: true when `error` is set and the status is neither `'syncing'` nor `'success'`.
- `use-sync-status.ts:getTooltip`: "Synced · Click to sync now" requires `status === 'idle' && pendingCount === 0 && lastSuccessfulSyncAt`.

## Side Effects

- `open-sync-event.ts:useSyncDialogState`: adds and removes a `window` listener for `OPEN_SYNC_EVENT` (`"gsd:open-sync"`).
- `oauth-buttons.tsx:useOAuthSignIn.start`: calls `openOAuthPopup(provider)` from `@/lib/sync/pb-auth`.
- `oauth-buttons.tsx:useOAuthSignIn.runOAuth`: calls `loginWithGoogle`, `loginWithGithub`, or `loginWithApple` from `@/lib/sync/pb-auth` with `{ requestKey, popupWindow }`.
- `oauth-buttons.tsx:useOAuthSignIn`: calls `cancelOAuthLogin(activeRequestKey)` from `@/lib/sync/pb-auth` on `cancel` and on unmount.
- `oauth-buttons.tsx:OAuthButtons`: calls `prepareOAuthLogin` from `@/lib/sync/pb-auth` on `onPointerEnter` and `onFocus` of the button group.
- `oauth-buttons.tsx:CancelSignIn`: focuses the "Cancel sign-in" button on mount.
- `oauth-buttons.tsx:OAuthButtons`: when `loading` clears, focuses the provider button that started the sign-in.
- `sync-auth-dialog.tsx:SyncAuthDialog`: renders through `createPortal(dialogContent, document.body)`.
- `sync-auth-dialog.tsx:useSyncDialogFocus`: on open, focuses the element that matches `[data-dialog-initial-focus]`. It also calls `useDialogFocus` from `@/components/matrix-simplified/use-dialog-focus`.
- `sync-auth-dialog-sections.tsx:ConfirmButtons`: focuses the Cancel button on mount.
- `sync-auth-dialog-sections.tsx:useReturnFocusWhenClosed`: focuses the trigger button when its panel goes from open to closed.
- `sync-auth-dialog-sections.tsx:UnauthenticatedSection`: renders an external link to `https://gsdtaskmanager.com/privacy/`.
- `sync-auth-dialog-sections.tsx:AccountNoteText`: calls `accountNote` and `accountNoteText` from `@/lib/apple-identity`.
- `sync-button.tsx:SyncButton`: calls `useSync` from `@/lib/hooks/use-sync`. `handleSync` awaits its `sync()`.
- `sync-button.tsx:SyncButton`: shows a Sonner `toast(message, { id, duration, action })` for each health notification, and a toast with a "Re-login" action on an auth error.
- `sync-button.tsx:SyncButton.handleSync`: shows "Please re-login to continue syncing" for `SYNC_TOAST_DURATION.MEDIUM`.
- `use-logout.ts:useLogout.handleLogout`: calls `getSyncStatus` from `@/lib/sync/config`.
- `use-logout.ts:useLogout.performLogout`: calls `disableSync` from `@/lib/sync/config`, then `toast.success("Logged out successfully")`.
- `use-sign-out-everywhere.ts:useSignOutEverywhere.onRequest`: calls `getSyncStatus` from `@/lib/sync/config`.
- `use-sign-out-everywhere.ts:useSignOutEverywhere.onConfirm`: calls `signOutEverywhere` from `@/lib/sync/sign-out-everywhere`. It shows "Signed out of all devices" or a warning that the server cannot end other sessions.
- `use-sync-auth-dialog.ts:loadSyncStatus`: reads Dexie with `db.syncMetadata.get("sync_config")` through `getDb` from `@/lib/db`.
- `use-sync-auth-dialog.ts:validateTokenAndRefresh`: calls `isAuthenticated` from `@/lib/sync/pocketbase-client` and `refreshAuth` from `@/lib/sync/pb-auth`.
- `use-sync-auth-dialog.ts:persistSyncConfig`: runs a Dexie `rw` transaction over `tasks`, `archivedTasks`, `deletedTasks`, and `syncMetadata`. It reads `sync_config`, counts three tables, and calls `db.syncMetadata.put(...)`.
- `use-sync-auth-dialog.ts:persistSyncConfig`: calls `getSyncQueue` from `@/lib/sync/queue`, then `queue.populateFromExistingTasks()`.
- `use-sync-auth-dialog.ts:useSyncAuthDialog.handleOAuthSuccess`: calls `clearPocketBase` from `@/lib/sync/pocketbase-client` on a setup failure. On success it shows a "Signed in as" toast with the email.
- `use-sync-auth-dialog.ts:useSyncAuthDialog.handleOAuthError`: calls `isOAuthCancellation` and `getOAuthErrorMessage` from `@/lib/sync/pb-auth`.
- `use-sync-status.ts:useSyncStatus`: calls `useRetryCountdown` from `@/lib/hooks/use-retry-countdown` and `isAuthError` from `@/lib/sync/error-categorizer`.
- `use-sync-health.ts:useSyncHealth`: has no direct storage, network, timer, or listener effects. It only invokes the `onHealthIssue` callback.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
