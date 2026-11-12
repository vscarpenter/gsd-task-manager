---
name: verify-sync-session
description: Model-checks, with TLA+ and TLC, which account each sync write lands in across sign-in, sign-out, switching accounts, Reset Everything, Sign out of all devices, and a second open tab, so a change can't upload one account's tasks into another account. Use when a change touches lib/sync/sync-session.ts, pb-sync-engine.ts (fullSync, runSyncPasses, applyRemoteChange), pb-push.ts (pushLocalChanges, resolvePushPrincipal), pb-pull.ts (pullRemoteChanges, applyRemoteRecords), pb-realtime.ts, pb-auth.ts (ensureValidAuth, refreshAuthOutcome), pocketbase-client.ts, sign-out-everywhere.ts, sync-coordinator.ts, queue.ts (getPending, populateFromExistingTasks), lib/sync/config/ (disableSync, updateSyncConfig), lib/reset-everything.ts, lib/reset-local-data.ts, lib/tasks/crud/helpers.ts (runTaskSyncTransaction), components/sync/use-sync-auth-dialog.ts (persistSyncConfig), the tasks API rules in scripts/setup-pocketbase-collections.sh, or any code that writes sync_config, the sync queue, or local task rows on behalf of a sync. Also use when adding a new sync write path.
---

# Verify the sync session

A TLA+ model of the web app's sync session lives in `docs/formal/sync-session/`. TLC checks every order of the steps in the model. One tab runs a fullSync. Either tab can sign in, sign out, run Reset Everything, edit a task, or change Settings, and a realtime event can arrive. Each await in the code is a point where another step can run. A pass covers the model, not the whole app, so read "Bounds and what's left out" before you trust one.

The promise comes from the header of `lib/sync/sync-session.ts`. A sync belongs to the account that was signed in when it started. Once sync is off or `sync_config` names another account, that sync writes nothing more. The model checks the harm that promise exists to prevent.

## The rules

Each rule is an INVARIANT in `SyncSession.tla`.

| Rule | What the app promises | The harm when it breaks |
|---|---|---|
| `NoRecordInAnotherAccount` | No account's server copy ever holds a task or queued edit from another account. | One person's tasks show up in someone else's account, on every device that account uses. |
| `DeviceHoldsOnlyTheSignedInAccount` | While sync is on for an account, this device holds only that account's tasks and queued edits. | The next push or sign-in uploads the other account's tasks into this one. |

`TypeOK` keeps each variable in its range. It guards the model, not the app.

## What the model found (2026-11-08)

The code broke both rules on that date. Every path below was replayed against the real code, and the replay showed the task in the wrong account. All four findings were fixed on 2026-11-11, and no finding is open. Each fix has a `Broken` value and a `Broken*.cfg` that undo it. The paths below are how each one broke before its fix.

1. **`push-reads-queue-unfenced`** (fixed 2026-11-11). `pushLocalChanges` checked the SDK principal once, then read the queue with no `assertSyncSessionCurrent`. The fix: `readPendingForSession` reads the queue inside a transaction that makes that check, and the push repeats it before each row and inside each queue write. `BrokenPushQueueFence.cfg` removes the queue check and breaks the rule again. The paths below are how it broke before the fix. TLC's path: you sign in as A, and a sync for A starts. You sign in as B in a dialog left open in another tab. `persistSyncConfig` switches to B, since the device holds no tasks yet. B's task arrives and you edit it. A second sign-in as A saves A's token before its own save refuses it. `resolvePushPrincipal` now passes for A, the push reads B's edit, and `upsertRemoteTask` creates it with `owner: A` under A's token. The server accepts it. A second replay found a way in with no stale dialog. The sync tab's `authRefresh` was in flight while the other tab signed out and signed in as B. Its late response then saved A's token over B's, because `clearPocketBase` only detaches the tab that calls it. The refresh runs on every sync in a token's last seven days.
2. **`sign-out-reads-config-early`** (fixed 2026-11-11). `disableSync` called `getSyncConfig()` before `resetSyncConfigState` opened its transaction, then wrote the signed-out row from that copy. If A's sign-in saved in between, the row it wrote kept no `localTaskOwnerUserId`. A's task stayed on the device with no owner recorded, so B could sign in. Then `populateFromExistingTasks` queued A's task, and B's push uploaded it to B. It needed a Sign out click in a dialog that still showed an older session, within the moment A's sign-in took to save. The fix: `disableSync` reads nothing first, and `resetSyncConfigState` reads the row inside its transaction. `BrokenSignOutRead.cfg` moves the read back before the transaction and breaks the rule again.
3. **`settings-writes-stale-config`** (fixed 2026-11-11). `updateAutoSyncConfig` called `updateSyncConfig`, which read the row and put `{...current, ...updates}` with no transaction. One path matched finding 2. The shortest break ran the other way. Settings read A's row while B's sign-in saved, then wrote A's row back. B's task then sat on a device whose `sync_config` named A. The toggle showed only while that tab believed sync was on, and the window was one IndexedDB round trip. The fix: `updateSyncConfig` reads and writes the row in one `rw` transaction over `syncMetadata`. `BrokenSettingsWrite.cfg` splits the read from the write and breaks the rule again.
4. **`populate-after-sign-in`** (fixed 2026-11-11). `persistSyncConfig` committed its transaction, then `populateFromExistingTasks` read `db.tasks` and enqueued each task with no session check. If Reset Everything erased local data between that read and the enqueues, A's task was queued into an empty device. B could then sign in, since the guard counts tasks and not queue rows, and B's push uploaded A's task. The reset had to fit between a few IndexedDB round trips. The fix: the sign-in transaction also scopes `syncQueue` and calls `populateFromExistingTasks` itself. The config and the queue rows commit together or not at all. `BrokenPopulate.cfg` queues the tasks after the commit and breaks the rule again.

`SyncSession.cfg` sets `Broken = "none"` and describes the code as it is. Both rules hold there.

## Run the check

```sh
bash docs/formal/sync-session/check.sh
```

It runs eight configs through `scripts/tlc.sh`, which pins TLC 1.7.4 by hash and finds Java 21. The first run downloads the jar. The whole check takes about 30 seconds. It prints one line per config, which ends with what that config stands for, and exits 0 only when every line says `ok`:

```
ok       SyncSession.cfg          expected pass                               got pass                                 549924 states   9s  (the code today)
ok       BrokenPullFence.cfg      expected DeviceHoldsOnlyTheSignedInAccount  got DeviceHoldsOnlyTheSignedInAccount      3853 states   1s  (broken: pull without the fence)
ok       BrokenSignInGuard.cfg    expected DeviceHoldsOnlyTheSignedInAccount  got DeviceHoldsOnlyTheSignedInAccount      1549 states   0s  (broken: sign-in without the owner check)
ok       BrokenPushPrincipal.cfg  expected NoRecordInAnotherAccount           got NoRecordInAnotherAccount              68777 states   2s  (broken: push without the principal check)
ok       BrokenPushQueueFence.cfg expected NoRecordInAnotherAccount           got NoRecordInAnotherAccount             170165 states   2s  (broken: push reads the queue without the fence)
ok       BrokenSignOutRead.cfg    expected NoRecordInAnotherAccount           got NoRecordInAnotherAccount             236717 states   3s  (broken: sign-out reads sync_config early)
ok       BrokenSettingsWrite.cfg  expected NoRecordInAnotherAccount           got NoRecordInAnotherAccount             495088 states   5s  (broken: Settings writes a stale sync_config)
ok       BrokenPopulate.cfg       expected NoRecordInAnotherAccount           got NoRecordInAnotherAccount             421091 states   5s  (broken: populate runs after sign-in commits)
check.sh: every config matched
```

- `SyncSession.cfg` is the code as it is, with `Broken = "none"`. It must pass. A change that breaks a rule here is the signal this skill exists for.
- Each of the seven `Broken*.cfg` sets `Broken` to one value, which removes one guard the code has today. Each must break the rule its line names, so each rule has been seen to fail.
- Four guards are session checks: the pull's check, the sign-in owner check, the push principal check, and the push's check on the queue read.
- Three guards are transactions. Sign-out reads `sync_config` inside its transaction. Settings reads and writes it in one transaction. Sign-in queues the local tasks inside its transaction.
- `BrokenSignOutRead.cfg`, `BrokenSettingsWrite.cfg`, and `BrokenPopulate.cfg` check only `TypeOK` and `NoRecordInAnotherAccount`. The other five configs check both rules.

A `MISMATCH` line keeps TLC's output and prints the folder it's in. Rerun one config by hand with `bash scripts/tlc.sh docs/formal/sync-session/SyncSession.tla docs/formal/sync-session/<config>`.

Read every result, pass or fail, with the pstack `/statechart` skill. Give it `view.mjs` as the view, and send its output to a scratch folder outside the repo. On a break it tells TLC's shortest path in plain words, such as "the push sends A's task to B's account". The model has far more than 500 states, so the chart only ever draws bug paths. After the first break, `/statechart` stops each run at 100,000 states, so with both rules in the config it can leave the second one unchecked. To read the server rule's path, give it a scratch copy of the config that lists only `TypeOK` and `NoRecordInAnotherAccount`.

## When a change touches this code

1. **See what changed.** Diff the covered code from the sync commit (below) to your working tree: `git diff dd32e08c -- lib/sync lib/reset-everything.ts lib/reset-local-data.ts lib/tasks/crud/helpers.ts components/sync/use-sync-auth-dialog.ts scripts/setup-pocketbase-collections.sh`. Then look for new writers: `rg -n "sync_config|syncQueue\.|enqueue\(|db\.tasks\.(put|add|bulkPut|bulkAdd)|authStore\.save" lib components app`, and compare each hit with the coverage record.
2. **Run the check before you touch the model.** A pass here only says the old description still holds.
3. **Map each change to a model action** through the coverage record. A change has no effect, or the model no longer describes the code, or the promise changed on purpose, or the promise may be broken. Decide from the model, not from the commit message.
4. **Update `SyncSession.tla` from the code**, as "Update the model" says. Write the update before you rerun, and don't shape it by what passes.
5. **Rerun the check and read the result with `/statechart`.** If a config stops matching, replay the path (next section). If everything matches, break the new code's guard once in the model, the way `Broken` does, and confirm a rule fails. A model that can't fail proves nothing.
6. **Move the sync commit** only when every change is accounted for and the check matches.

## Real bug or modeling error

Replay the path against the real code before you call it either. Write a scratch Vitest file in `tests/data/sync/`, with one step per model action. Run it with `bun run test tests/data/sync/<file>.test.ts`, then `mv` it to a scratch folder outside the repo. Never commit a replay. Agents can't run `rm` here.

Keep the SDK real and stub only `fetch` (`vi.stubGlobal('fetch', ...)`), with a fake server that applies the tasks rules from `scripts/setup-pocketbase-collections.sh`. List returns only `owner = auth` records, create needs `body.owner === auth`, and update and delete need the stored owner to match. Make tokens JWT-shaped with an `exp`, and read the caller from the raw `Authorization` header. Start from a `sync_config` row with `pullCursorVersion: SYNC_CONFIG.PULL_CURSOR_VERSION`, as `pocketBaseSyncConfig` in `lib/db-migrations.ts` writes it. Without it, `fullSync` owes a backfill and pulls first. Build rows with `serverRow` from `tests/data/sync/support/fake-pocketbase.ts`.

| Model action | What the replay does |
|---|---|
| `YouSignIn(t, x)` | `getPocketBase().authStore.save(token, { id: x })`, the save `authWithOAuth2Code` makes |
| `SignInSaves`, `PopulateReads`, `PopulateWrites` | `await persistSyncConfig(authState)` from `components/sync/use-sync-auth-dialog.ts` |
| `YouSignOut(t, FALSE)` and its three steps | `await disableSync()` |
| `YouSignOut(t, TRUE)` through `ResetReloads` | `await resetEverything()` (the replay can't reload) |
| `YouChangeAutoSync`, `AutoSyncSaves` | `await updateAutoSyncConfig(true, 5)` |
| `YouEditTask`, `EditSaves` | `await updateTask(id, { title })` |
| `EventArrives(x, r)`, `EventApplies` | capture `getCurrentUserId()`, then `await applyRemoteChange('create', record, thatUser)`, as `handleRealtimeEvent` does |
| `SyncStarts` through `PullApplies` | `fullSync('auto')`, not awaited until its last step |
| `RefreshSent`, `RefreshLands` | a token that expires within seven days, and a fake `auth-refresh` that waits on a promise you resolve: an answer saves the token, a thrown `TypeError` saves nothing |

To land a step between a read and its write, wrap the next call of a Dexie table method. A `vi.spyOn(db.syncMetadata, 'get').mockImplementationOnce(...)` that awaits the real read, then a gate, holds `disableSync` or `updateSyncConfig` after its read. The same wrap on `db.tasks.toArray` holds `populateFromExistingTasks`. Install the spy right before the call, because the first call after it is the one it holds. For `"other"` tab steps that must not touch the sync tab's client, call `vi.resetModules()` and import a second copy of the modules. That gives the other tab its own `pbInstance` and Dexie connection over the same `localStorage` and IndexedDB. Call its `getPocketBase()` once first, as the app does on load, or its `clearPocketBase` has nothing to clear.

- **Every step happens and the harm shows:** it's a bug. Find the commit that brought it in with `git log -L` on the changed function. Report the path in the code's words and the harm in one sentence. Don't weaken a rule or the model to make the check pass, and don't change product code unless the user asks.
- **A step can't happen in the code:** the model is wrong. Fix the action so it matches the code, say what was wrong, and rerun. On 2026-11-08 a replay first failed only because its `sync_config` lacked `pullCursorVersion`. That showed the model had left out the backfill order, so `pullFirst` joined it.

## Update the model

- **The code changed shape.** Edit the action the coverage record names. A Dexie transaction is one action only when the code really runs it in one. An await between a read and a write, including a network call, is two actions.
- **A new sync write path.** Any new code that writes task rows, queue rows, or `sync_config` for a sync is a new action. Fenced inside its transaction, it behaves like `PullApplies`. Unfenced, model it as the code has it and run the check. If a rule breaks, that's a new finding. Replay it, record it under "What the model found", and say how its fix would read the session. Until the fix ships, the `SyncSession.cfg` line in `check.sh` expects that rule.
- **A finding gets fixed.** Rewrite the action to describe the code that shipped. Keep the old behavior as a `BrokenGuards` value, with a `Broken*.cfg` and a `check.sh` line that undo the fix. `SyncSession.cfg` must pass again, and the new config must break the rule its line names.
- **A new guard protects a rule.** Add a `BrokenGuards` value that undoes it, a `Broken*.cfg`, and a line in `check.sh`'s `expectations`.
- **The promise changed on purpose.** Change a rule only with evidence: a spec, an ADR, an owner decision, or the tests and commit message of the change. Put the old wording, the new wording, and the evidence in the commit message and in the rule's comment.
- **The chart changed.** If a new action or variable needs words on the chart, update `state()` and `step()` in `view.mjs`.
- Keep the model update in its own commit, apart from any product fix.

## Coverage record

| Model part | File | Function |
|---|---|---|
| `SessionIs` | `lib/sync/sync-session.ts` | `assertSyncSessionCurrent`, `getSessionOwner` |
| `LocalOwner` | `components/sync/use-sync-auth-dialog.ts`, `lib/sync/config/disable.ts` | `persistSyncConfig`, `resetSyncConfigState`: `localTaskOwnerUserId ?? userId ?? null` |
| `SyncStarts`, `pullFirst`, `FirstPass` | `lib/sync/pb-sync-engine.ts` | `fullSync`, `resolvePullCursor`, `isBackfillOwed`, `runSyncPasses` |
| | `lib/sync/sync-coordinator.ts` | `requestSync`: one fullSync at a time per tab, so one sync process per tab |
| `TokenFresh`, `RefreshSent`, `RefreshLands`, `rt` | `lib/sync/pb-auth.ts`, `lib/sync/pb-sync-engine.ts` | `ensureValidAuth`, `refreshAuthOutcome` (`AUTH_REFRESH_THRESHOLD_SECONDS`); `fullSync` ends with `reportAuthFailure` when `ensureValidAuth` fails |
| `ForgetRefused` | `lib/sync/pocketbase-client.ts`, `lib/sync/error-categorizer.ts` | `forgetRefusedToken` after a 401 (`isSessionRefusal`): clears the shared key only while it holds the refused token |
| `PushChecks`, `CheckLands` | `lib/sync/pb-push.ts`, `lib/sync/pb-sync-helpers.ts` | `createPushSessionCheck` before a create over a 404, `confirmSessionIdentity` (posts to auth-refresh with `pb.send` and saves nothing), `isSessionCheckFailure` stops the loop |
| | `lib/sync/pocketbase-client.ts` | `getPocketBase`, `clearPocketBase`: the late save lands in a throwaway only in the tab that cleared |
| | `pocketbase` SDK 0.28.1 | `RecordService.authResponse` saves unconditionally; `LocalAuthStore` reads the shared `pocketbase_auth` key on every access |
| `PushStarts` | `lib/sync/pb-push.ts`, `lib/sync/queue.ts` | `pushLocalChanges`, `resolvePushPrincipal`, `readPendingForSession` (`assertSyncSessionCurrent`, then `getPending`, in one transaction) |
| `PushSends`, `PushEnds` | `lib/sync/pb-push.ts`, `lib/sync/pb-sync-helpers.ts` | `pushSingleItem`, `upsertRemoteTask` (`owner` from `taskRecordToPocketBase`), `fetchRemoteTaskEntry`; the loop's 429 `break` |
| | `scripts/setup-pocketbase-collections.sh` | tasks `createRule`, `updateRule`, `deleteRule`: `owner = @request.auth.id` |
| `PullFetches` | `lib/sync/pb-pull.ts`, `lib/sync/pb-sync-helpers.ts` | `pullRemoteChanges` (`getCurrentUserId`), `fetchBoundedRemoteTasks`; tasks `listRule` |
| `PullApplies` | `lib/sync/pb-pull.ts` | `applyRemoteRecords` |
| `EventArrives`, `EventApplies` | `lib/sync/pb-realtime.ts`, `lib/sync/pb-sync-engine.ts`, `lib/sync/sync-status-store.ts` | `handleRealtimeEvent`, `applyRemoteChange`; the store subscribes while sync is on |
| `YouSignIn` | `lib/sync/pb-auth.ts` | `loginWithProvider`, `runCodeFlow` (`authWithOAuth2Code`) |
| `SignInSaves` | `components/sync/use-sync-auth-dialog.ts` | `handleOAuthSuccess` (calls `clearPocketBase` on refusal), `persistSyncConfig` (one transaction that also scopes `syncQueue` and calls `populateFromExistingTasks`), `buildSyncConfig`, `loadSyncStatus` (reads the row only when the dialog opens) |
| `PopulateReads`, `PopulateWrites` | `lib/sync/queue.ts`, `lib/sync/config/enable.ts` | `populateFromExistingTasks` after the sign-in commits, only in the `populate-after-sign-in` variant; `enableSync` still calls it outside a transaction and has no production caller |
| `YouSignOut`, `SignOutSaves`, `SignOutClearsToken` | `lib/sync/config/disable.ts`, `lib/sync/sign-out-everywhere.ts`, `components/sync/use-logout.ts` | `disableSync` (reads nothing first), `resetSyncConfigState` (reads the row inside its transaction), `signOutEverywhere`, `performLogout` |
| `ResetWipes`, `ResetReloads` | `lib/reset-everything.ts`, `lib/reset-local-data.ts` | `resetEverything`, `clearLocalStorage`, `reloadAfterReset`, `wipeLocalData`, `clearTables`, `buildPreservedSyncMetadata` |
| `YouChangeAutoSync`, `AutoSyncSaves` | `lib/sync/config/get-set.ts`, `components/settings/sync-settings.tsx` | `updateAutoSyncConfig`, `updateSyncConfig` (one transaction reads and writes the row); the two actions exist only in the `settings-writes-stale-config` variant |
| `YouEditTask`, `EditSaves` | `lib/tasks/crud/helpers.ts`, `lib/tasks/crud/update.ts` | `runTaskSyncTransaction`, `updateTask`; every writer that enqueues through it behaves the same |
| `Broken` values | `pb-pull.ts`, `use-sync-auth-dialog.ts`, `pb-push.ts`, `config/disable.ts`, `config/get-set.ts` | Seven values, each of which undoes one guard above: `pull-skips-fence`, `sign-in-skips-owner-check`, `push-skips-principal-check`, `push-skips-queue-fence`, `sign-out-reads-config-early`, `settings-writes-stale-config`, `populate-after-sign-in` |

These touch the same state, and the model leaves them out on purpose. `updateSyncCursor` and `writeSyncOutcome` (with `RetryManager` inside it) are fenced and keep `enabled`, `userId`, and `localTaskOwnerUserId`. `reconcileDeletedTasks` and `applyRemoteDeletion` only delete rows, and `resurrectOnSight` only restores rows already in Trash. The session checks in `reconcileDeletedTasks` and `resurrectOnSight` are the same `confirmSessionIdentity` as `CheckLands`: a 401 forgets the refused token and ends the sync, and clearing a token only takes a principal away. The push's check before it drops a delete that found nothing (`beforeDroppingDelete`) is left out with the deletes. `deleteRemoteAccountAndTasks` only deletes, through the token's own account. `lib/reset-lock.ts` locks the UI, and no sync path reads it. The archive, Trash, import, and MCP writers enqueue like `EditSaves`.

## Sync commit

**`dd32e08c`** (`chore(release): v14.8.0 (#712)`, on `main`), confirmed 2026-11-08. The model was written against it, and the branch that added it changed no covered code. Every finding above was replayed at this commit.

The same day, a dry run of this skill made `resetSyncConfigState` write `localTaskOwnerUserId: null`. The check still passed until `SignOutSaves` described that code. Then that day's fixed-model config broke `DeviceHoldsOnlyTheSignedInAccount`, and `BrokenPushPrincipal.cfg` broke it before its own rule. The replay showed B's sync pushing A's task into B's account. On the real code, the same replay stops at "Local tasks belong to a different sync account".

On 2026-11-10 the refused-session change (audit P1 item 2) updated `TokenFresh`, `RefreshLands`, and the push (`PushChecks`, `CheckLands`, `ForgetRefused`), and the check matched. The change adds no guard for these two rules: the tasks rules that `PushSends` models already refuse a create sent with another account's token, and clearing a token only takes a principal away. A scratch run in which the push's check saved its answer still passed the fixed-model config of that date. The only other covered change since this commit, `e94022a`, makes `runTaskSyncTransaction`'s scope an async function, which `EditSaves` already assumes. Move this commit to that change's merge commit once it lands on `main`.

On 2026-11-11 the push fence (finding 1) updated `PushStarts`, and the check matched. Its open-finding constant was removed, and `push-skips-queue-fence` joined `BrokenGuards`. The push also checks the session before each row and inside each queue write. The model leaves those checks out, so it allows more than the code does. The sync commit stays at `dd32e08c` until that fix is on `main`.

Also on 2026-11-11, findings 2 to 4 were fixed. `SignInSaves` now queues the local rows in the same step. `YouSignOut` reads nothing, and `SignOutSaves` reads the row it replaces. `YouChangeAutoSync`, `AutoSyncSaves`, `PopulateReads`, and `PopulateWrites` run only in their broken variants. The open-findings constant was retired, and each old finding became a `Broken` value with its own `Broken*.cfg`. The check matched on eight configs. The sync commit still stays at `dd32e08c` until these fixes are on `main`.

Move this commit forward only after you've read every change to covered code since it, updated the model where needed, and seen the check match. If the check is blocked, leave the commit where it is and say so. Record a commit on `main`, because a squash merge drops branch commits.

## Bounds and what's left out

- **Two accounts, A and B, each with one task on the server.** A row, queue row, or record is named by the account its content came from. The device starts signed out, with no tasks.
- **One fullSync, in the sync tab.** The other tab's own sync isn't modeled. Its writes are the same fenced actions, and realtime stands in for its pull. At most one sign-in, one sign-out or reset, one Settings change, one edit, and one realtime event are in flight at once.
- **The UI can start anything at any time.** A dialog or Settings page left open from an earlier session can offer sign-in, Sign out, or the auto-sync toggle after another tab changed the session. That over-approximates the UI, so each finding above says what its path needed in practice.
- **The tasks API rules are as the setup script writes them.** This skill didn't read the production collection's rules.
- **Only fullSync's own `authRefresh` can land late.** The dialog's `validateTokenAndRefresh` and `deleteRemoteAccountAndTasks` send one too, with the same hazard. `confirmSessionIdentity` posts to auth-refresh with `pb.send` and never saves the answer, so none of its checks can land late. Before 2026-11-10 it saved, and in a backfill sync the reconcile's check runs between the pull and the push, the window finding 1's late save needs. A failed refresh saves nothing.
- **Which token the server refuses isn't modeled.** Any refresh or session check may be refused, and a refusal may clear the shared key (`ForgetRefused`). Expiry is left out, so a refresh may succeed or fail at any time.
- **Push rows are never dequeued in the model**, so a row can send again, and a pull fetches the account in one page.
- **PocketBase's own filter on a realtime subscription is left out**, so any account's record can arrive. `handleRealtimeEvent` and the session check still apply.
- **Not modeled:** deletes, Trash, archive, and their queue rows; the cursor fields and the backfill's merge rules; account deletion; the OAuth popup and PKCE handshake; iOS, Android, and the MCP server.

## Related skills

- `/statechart` (pstack): read every result of the check.
- `/maintain-formal-verification-skill` (pstack): bring this model back in line after changes that skipped this skill.
