# Spec: Delete Account & Synced Data (web)

**Status:** Approved 2026-06-17 · **Tier:** Non-trivial · **Author:** Claude (paired with Vinny)

**Shipped differently, 2026-11-12.** The feature is live. The module now tries one server route first, and the client-side flow below is its fallback. Dated notes under Inputs / Outputs, Constraints, and Test Stubs say what changed. Background, Edge Cases, Out of Scope, and Acceptance Criteria still describe the fallback as first approved. The code is in `lib/sync/pb-account-deletion.ts`, `components/delete-account-dialog.tsx`, and `components/settings/sync-danger-zone.tsx`.

## Goal

Let a signed-in web user permanently delete their cloud account and all tasks synced to
PocketBase (`api.vinny.io`), with an option to also erase the local copy — matching the
capability already shipped on iOS/Mac, against the same backend.

## Background

- iOS/Mac (`/Users/vinnycarpenter/Projects/GSD/gsd-iosapp`) already implements this and is live in
  production. Reference flow: `SyncEngine.eraseAllRemote()` deletes every remote task, then
  `AuthService.deleteAccount()` issues `DELETE /api/collections/users/records/{id}` with the
  user's own JWT (no superuser). `SessionStore.deleteAccount(eraseLocalData:)` orchestrates and
  optionally wipes local.
- The `owner` field on the `tasks` collection is `text`, **not** a relation, so deleting the user
  record does **not** cascade-delete tasks. Tasks MUST be deleted first, or they orphan.
- Self-delete with the user token already works against `api.vinny.io` (proven by the live iOS
  feature), so no PocketBase server/admin changes are required for the web port.

## Inputs / Outputs

**Module — `lib/sync/pb-account-deletion.ts`**

```ts
export interface DeleteAccountResult {
  ok: boolean;
  stage: 'tasks' | 'account' | 'done';
  authRejected?: boolean; // true on 401/403 — session is dead, auth should be cleared
  error?: string;         // sanitized, short
}

// Performs the REMOTE operation only. Does NOT touch local data — the caller decides that.
export async function deleteRemoteAccountAndTasks(): Promise<DeleteAccountResult>;
```

Behaviour (mirrors iOS ordering exactly):

1. `refreshAuth()` (best-effort); resolve `userId` via `getCurrentUserId()`.
   - No `userId` / not authenticated → `{ ok:false, stage:'tasks', authRejected:true }`.
2. `fetchRemoteTaskIndex(userId)` (existing helper, `lib/sync/pb-sync-helpers.ts`).
   - `fetchSucceeded === false` → `{ ok:false, stage:'tasks', error }` (ABORT — never orphan).
3. For each indexed record: `pb.collection('tasks').delete(pbRecordId)`, **throttled 100ms** between
   deletes (PocketBase 429-avoidance, matches iOS).
   - Any delete throws → ABORT `{ ok:false, stage:'tasks', authRejected?, error }`. Auth kept unless 401/403.
4. `pb.collection('users').delete(userId)`.
   - 401/403 → `{ ok:false, stage:'account', authRejected:true }`.
   - Other error → `{ ok:false, stage:'account', error }`.
5. Success → `{ ok:true, stage:'done' }`.

**Shipped, 2026-11-12:**

- The function takes an optional `{ throttleMs }`, and the result adds `remoteTasksErased`.
- Step 1 calls `refreshAuthOutcome()`, which makes no request without a token. With no `userId` and an unreachable server, the result has `authRejected: false`, so the user can retry.
- After step 1 the module sends `DELETE /api/gsd/account`, one server transaction (`docker/pb_hooks/account_lifecycle.pb.js`). Success ends the flow. A 404 means the route isn't deployed, and steps 2 to 4 run as the fallback. Any other error returns `stage: 'account'`.
- The module's header comment says `api.vinny.io` doesn't load that hook, which would make the fallback the production path. This note didn't check the server.
- The fallback lists and deletes in up to 3 passes. It deletes the user record only after a complete listing comes back empty. If the third listing still finds tasks, it deletes them and then fails with "Remote tasks kept reappearing", without listing again.

**UI — `components/delete-account-dialog.tsx`** (adapted from `reset-everything-dialog.tsx`)

- Props: `{ open: boolean; onOpenChange: (open: boolean) => void; onDeleted?: () => void }`.
- Rust warning banner; "what will be deleted" list (cloud account + all synced tasks).
- `exportFirst` checkbox + "Export Now" (reuses existing export path).
- `eraseLocal` checkbox **"Also erase all tasks from this browser"** — default **OFF** (keep local).
- Typed confirmation `<input>` gating the delete button on the literal string `DELETE`.
- On confirm → `deleteRemoteAccountAndTasks()`, then on `ok`:
  - `eraseLocal === true` → `resetEverything({ preserveTheme: true })` then `reloadAfterReset()`.
  - `eraseLocal === false` → `disableSync()` (clears auth + sync state; tasks stay → local-only),
    then `onDeleted?.()` and close.

**Shipped, 2026-11-12:** the props add a required `onExport`. Both options are switches, and the export one reads "Export my tasks first (recommended)". With it on, the delete button stays disabled until an export succeeds. If the local erase fails after the remote delete, the dialog says so, stays open, and doesn't reload. On a rejected session the dialog shows a sign-in-again toast and stays open. If the fallback already deleted some tasks, the toast says that first. The dialog clears no auth itself. A token the server refuses with a 401 at step 1 is forgotten there (`forgetRefusedToken`).

**Settings — `components/settings/sync-settings.tsx`**

- A red **"Danger zone"** block at the bottom, rendered only when signed in, with a destructive
  "Delete account…" button that opens the dialog.

**Shipped, 2026-11-12:** the block, button, and dialog live in `components/settings/sync-danger-zone.tsx`, which `sync-settings.tsx` renders. The gate is `settings.syncEnabled` in `components/settings-page/settings-body.tsx`, which is sync turned on, with no check of the auth store.

## Constraints

- Remote delete MUST complete fully before any local data is touched (offline-first safety
  invariant). A network blip must never wipe local while leaving tasks on the server.
- Throttle remote deletes ~100ms (documented PB rule + iOS parity).
- No PocketBase server-side hooks/admin token. User's own session only.
  (2026-11-12: a server hook now exists for the self-host image, and the module tries its route first. Still no admin token.)
- File size < ~400 lines; functions < ~40 lines (coding-standards).
- Reuse existing seams: `fetchRemoteTaskIndex`, `getCurrentUserId`, `refreshAuth`, `getPocketBase`,
  `disableSync`, `resetEverything`, `reloadAfterReset`, `Dialog`, `Button`, `sonner` toasts.

## Edge Cases

- Zero remote tasks → skip the loop, delete account, succeed.
- Task index fetch fails → abort, account NOT deleted, auth kept, retry works.
- Mid-loop delete failure → abort at stage `tasks`, account NOT deleted; retry re-fetches only
  survivors (idempotent).
- Account delete 401/403 → session dead; clear auth, surface "session expired".
- Account delete transient (5xx/network) → keep auth, allow retry.
- Local wipe failure after remote success → best-effort; remote is already gone, user is committed.
- Not signed in (no token) → `authRejected`, nothing attempted.

## Out of Scope

- No PocketBase server-side hook or cascade delete (tasks deleted client-side — matches iOS).
- No new settings navigation section (placement is the sync "Danger zone").
- No iOS/Mac changes.
- No revocation of the Google/GitHub OAuth grant itself (only the PB user record — matches iOS).
- Re-signup later remains possible (`deviceId` preserved by `resetEverything`).
- No bulk/transactional PocketBase batch API (individual throttled deletes — matches iOS, proven).

## Acceptance Criteria

1. `deleteRemoteAccountAndTasks()` deletes every remote task **then** the user record, in that order.
2. When the task index fetch fails, the user record is NOT deleted and `ok` is false.
3. When a task delete fails mid-loop, the user record is NOT deleted and `stage === 'tasks'`.
4. When not authenticated (no `userId`), it returns `authRejected` without hitting the network.
5. When the user-record delete returns 401/403, the result is `authRejected` with `stage === 'account'`.
6. With zero remote tasks, it deletes the account and returns `ok` (no task deletes attempted).
7. Remote deletes are throttled (delete called once per record).
8. Dialog: the delete button is disabled until `DELETE` is typed.
9. Dialog: on success with `eraseLocal` checked, `resetEverything` is invoked; unchecked, `disableSync`.
10. Dialog: on a failed remote delete, an error toast shows and the dialog stays open.
11. Sync settings shows the "Delete account…" entry only when signed in. (Shipped, 2026-11-12: the gate is `settings.syncEnabled`, with no auth check. See the note under "Settings" in Inputs / Outputs.)

## Test Stubs

`tests/data/pb-account-deletion.test.ts`
- `deletes_all_remote_tasks_then_the_user_record_in_order`
- `aborts_without_deleting_account_when_task_index_fetch_fails`
- `aborts_at_stage_tasks_when_a_task_delete_fails`
- `returns_authRejected_when_not_authenticated`
- `returns_authRejected_when_user_delete_is_forbidden`
- `succeeds_with_zero_remote_tasks`
- `deletes_each_remote_task_exactly_once`

`tests/ui/delete-account-dialog.test.tsx`
- `delete_button_disabled_until_DELETE_is_typed`
- `erase_local_checked_calls_resetEverything_on_success`
- `keep_local_calls_disableSync_on_success`
- `shows_error_toast_and_stays_open_on_remote_failure`

**Shipped, 2026-11-12:** the four dialog tests exist under these names, with 7 more beside them. `tests/data/pb-account-deletion.test.ts` uses sentence names instead of the seven above. The file covers six of the seven behaviors: five in its 404-fallback block, and the unauthenticated case in a test outside it. The server route is tested with a 401 and a 403, and a fallback task delete with a 403. No test covers a forbidden user-record delete in the fallback. New tests cover the server route, the 100ms throttle, and the refusal when tasks keep reappearing.
