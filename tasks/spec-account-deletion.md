# Spec: Delete Account & Synced Data (web)

**Status:** Approved 2026-06-17 · **Tier:** Non-trivial · **Author:** Claude (paired with Vinny)

## Goal

Let a signed-in web user permanently delete their cloud account and all tasks synced to
PocketBase (`api.vinny.io`), with an option to also erase the local copy — matching the
capability already shipped on iOS/Mac, against the same backend.

## Background

- iOS/Mac (`/Users/vinnycarpenter/Projects/gsd-iosapp`) already implements this and is live in
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

**Settings — `components/settings/sync-settings.tsx`**

- A red **"Danger zone"** block at the bottom, rendered only when signed in, with a destructive
  "Delete account…" button that opens the dialog.

## Constraints

- Remote delete MUST complete fully before any local data is touched (offline-first safety
  invariant). A network blip must never wipe local while leaving tasks on the server.
- Throttle remote deletes ~100ms (documented PB rule + iOS parity).
- No PocketBase server-side hooks/admin token. User's own session only.
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
11. Sync settings shows the "Delete account…" entry only when signed in.

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
