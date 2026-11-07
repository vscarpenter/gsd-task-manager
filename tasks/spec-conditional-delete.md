# Spec: conditional delete

**Status:** draft, 2026-11-07. Spec only; nobody builds it in sprint 2. Lead review, then Vinny.
**Backlog:** B-47 remainder (SPEC-4). Sprint 1 closed B-47's client half. Each client skips a delete when the server copy changed after it was queued, or after the archived version (web `isStaleDelete`, iOS #49, Android `remoteEditedAfterArchive`).
**Evidence:** code paths come from reading web `main` at `816a2b7`, iOS `main` at `4c4d44a`, and Android `main` at `8433a23`. PocketBase behavior in section 9 is expected from the documented rule syntax and hasn't been run. Section 9 is the named check that runs it, once owner item 24 lets a pane start a bare server.

## 1. Goal

A Trash or Archive delete reaches the server only if no other device edited the task since this client last checked it. Edit beats delete then holds on every client, with no window between the check and the delete.

## 2. The race today

Each client checks for a stale delete, then sends an unconditional `DELETE`:

| Client | Check | Delete | Window |
|---|---|---|---|
| Web | `fetchRemoteTaskEntry`, then `isStaleDelete` (`lib/sync/pb-push.ts:101-105`, `:170-179`) | `pb.collection('tasks').delete(id)` (`:180`) | one request, per item |
| iOS | per-drain index, then `isStaleDelete` (`GSDSync/SyncEngine.swift:216`, `:253-259`) | `deleteTask(recordId:)` (`GSDWire/PocketBaseTaskWrite.swift:58-60`) | the whole drain |
| Android | per-drain index, then `remoteEditedAfterQueued` and `remoteEditedAfterArchive` (`SyncEngine.kt:276-280`, `:306-321`) | `remote.deleteTask(recordId)` (`SyncEngine.kt:281`, `PocketBaseApi.kt:119-121`) | the whole drain |

If another device's edit lands between the check and the `DELETE`, the edit is lost on the server. It also comes back on no device: every client pulls the deletion, and the editing device's own row goes with it. The native clients hold the widest window, because their index is fetched once for the whole drain.

## 3. The design

Make the server refuse a delete when the record changed since the client looked. Hosted PocketBase runs no hooks (ADR 0016), so the rule lives in the `tasks` collection's API rules, which hosted does honor.

### 3.1 The rule

```
deleteRule:
@request.auth.id != "" && owner = @request.auth.id &&
(@request.query.expect_client_updated_at = "" || client_updated_at = @request.query.expect_client_updated_at)
```

- **CD-1.** A client that sends `expect_client_updated_at` gets a delete only while the stored `client_updated_at` equals that value exactly. It's a compare-and-swap on the stamp the client just checked.
- **CD-2.** A request without the parameter deletes as today. Every shipped build, and MCP, keeps working without an upgrade.
- **CD-3.** Ownership is unchanged. Another owner's record is still refused.

The parameter is plain text, compared as text. The client sends the stored string exactly as it read it, never a reformatted or parsed copy. Clients write the stamp in more than one ISO form (`.000Z`, `+00:00`), so a string rebuilt from a parsed date can miss the stored one.

### 3.2 What a client does

- **CD-4.** Before a delete, a client runs its stale check exactly as today. If the delete isn't stale, it sends `DELETE /api/collections/tasks/records/<id>?expect_client_updated_at=<stamp>`, with the raw stamp it checked.
- **CD-5.** The value is percent-encoded as a query component, including `+` as `%2B`. A raw `+` decodes as a space, so every stamp with an offset would be refused forever. Foundation's `URLComponents` leaves `+` unencoded by default, so iOS sets `percentEncodedQueryItems` itself.
- **CD-6.** A refused delete is re-checked, not retried blind. The client reads that one record again (`task_id` filter, `fields=id,task_id,client_updated_at`).
  - Gone: the delete is done, and the queue item is removed.
  - Present, and the fresh stamp makes the delete stale: the item is removed without deleting. The next pull brings the edit, and it beats the local Trash or Archive row under the existing conditional tombstone (ADR 0013, ADR 0015).
  - Present, and still not stale: one immediate retry with the fresh stamp. A second refusal spends a retry like any failed attempt.
- **CD-7.** An archive's delete takes the same path. B-47's archived-payload rule stays the stale check; the condition only closes the window after it.
- **CD-8.** Native clients keep the raw `client_updated_at` string in their per-drain index next to the parsed date, because the condition needs the stored text.

### 3.3 Rollout

- **CD-9.** Order is free. A new client against a server without the rule sends a parameter the old rule ignores, so it deletes as today. An old client against a server with the rule omits the parameter, so it deletes as today too. Each side closes the race as it arrives.

## 4. Inputs and outputs

- **Request:** `DELETE /api/collections/tasks/records/<recordId>?expect_client_updated_at=<percent-encoded stored stamp>`, with the user's auth token as today. No body.
- **Responses:** `204` when deleted. A refusal is expected to be `404`, because PocketBase hides a record its rule doesn't match. Section 9 confirms the status, since a client can't tell a refusal from a record that's already gone without re-reading (CD-6).
- **Stored data:** no change. No new field, no Dexie or GRDB or Room migration, no backup envelope change, no pull contract bump. `lib/schema.ts` doesn't change.
- **Server config:** the `tasks` collection's `deleteRule` only (section 3.1).

## 5. Constraints

- **Privacy:** the parameter carries a timestamp the server already stores. It carries no task content.
- **Compatibility:** CD-2 keeps every shipped client and MCP working. Hosted stays hookless.
- **Cost:** one extra read, only after a refusal, which needs another device's edit inside the window. No extra request on the normal path.
- **Code shape (web):** the delete branch of `pushSingleItem` is already near the 40-line function limit. The build moves it into its own helper (for example `deleteRemoteTask`) rather than growing it. `pb-push.ts` stays under the ~400-line file limit.
- **Bundle:** a few lines in a module every route already loads.
- **Never** run `scripts/update-pocketbase-tasks-schema.sh` without `PB_URL` set: it defaults to production.

## 6. Edge cases

- **Offline:** no request goes out, so nothing changes. The item stays queued, as today.
- **Empty or missing stamp:** a remote entry with no usable `client_updated_at` already fails the version check before any delete (web `hasUsableRemoteVersion`, iOS `recordFailedAttempt`). Nothing new.
- **Concurrent edits on two devices:** the case this spec exists for. The edit that lands first changes the stamp, and the delete that checked the old stamp is refused, then re-checked (CD-6).
- **Two devices deleting the same task:** the first delete wins. The second gets a `404` because the record is gone, and its re-read finds nothing, so the item counts as done.
- **A far-future stamp:** the stale checks treat a stamp past the skew ceiling as not newer, so the delete proceeds. The condition compares text, so it still matches the far-future value the client read.
- **The same stamp written twice:** an edit that keeps the same `client_updated_at` isn't seen by the condition. Every client stamps a new time on each edit, so it doesn't happen today.
- **An edit with an older stamp:** a device with a slow clock can write a stamp older than the one checked. The condition still refuses the delete, because it asks for an exact match, not a newer stamp. The re-check then finds it not stale and retries once (CD-6).
- **Dependencies:** deleting a task already removes it from other tasks' dependency lists locally, and that stays. A refused delete brings the task back through the pull, but not those references. That's today's stale-delete behavior, unchanged here.
- **Circular dependencies:** not affected. The condition looks only at the deleted record's stamp.
- **Schema migration:** none. A client that upgrades mid-queue sends the parameter on its next delete, and an old queue item needs nothing new.
- **Realtime:** a successful conditional delete emits the same realtime `delete` event as today. Section 9 confirms that.

## 7. Out of scope

- Building any of it in sprint 2.
- MCP's `delete_task` and bulk delete (`packages/mcp-server/src/write-ops/helpers.ts:93`, `:242`). They delete on the user's explicit command right after a lookup, with no queued stale check. CD-2 keeps them working.
- Updates. A push checks for a newer remote, then sends an unconditional `PATCH`, which has the same window. Last-write-wins with skew limits makes that window rarer and less harmful, and it needs its own decision. The same rule pattern on `updateRule` would close it.
- Permanent delete from Trash, which is local on every client (ADR 0015).
- Syncing Trash or Archive.
- A hooks-based design. Hosted runs no hooks (ADR 0016), and one API rule serves hosted and self-hosted alike.
- Requiring the parameter. That would break deletes from every older build and from MCP (section 11).

## 8. Files, by client

| | Change |
|---|---|
| Server, hosted | Vinny sets `deleteRule` (section 3.1) in the admin UI, or with `scripts/update-pocketbase-tasks-schema.sh` and `PB_URL` set. A manual step, like the top three fields |
| Server, scripts | `scripts/setup-pocketbase-collections.sh` (`deleteRule`, line 90) and `scripts/update-pocketbase-tasks-schema.sh` (`.deleteRule = owner_rule`, line 129) |
| Server, self-hosted Docker | A migration in `docker/pb_migrations/` that sets the same rule, with `tests/docker-migrations.test.ts` |
| Web | `lib/sync/pb-push.ts`: the delete branch, a raw-stamp read, and the CD-6 re-check. Pass the stamp through the SDK's `delete(id, { query })`, and let AC-2's test pin the `%2B` |
| iOS | `GSDWire/PocketBaseTaskWrite.swift` (`deleteTask` takes the stamp; explicit `%2B`), `GSDSync/SyncEngine.swift` (raw stamp in the index; CD-6 on a 404) |
| Android | `PocketBaseApi.kt` (`deleteTask` takes the stamp and encodes `+` as `%2B`, pinned by AC-2's test), `SyncEngine.kt` (raw stamp in the index; CD-6) |
| Docs | A web ADR for the rule, and an iOS dated note |

## 9. Named check on a bare PocketBase 0.40.4 (waits on owner item 24)

Run it on a hookless server, as hosted runs: `sprint/pb/bin/pocketbase` on a sprint port, under the `pocketbase` lock, never `api.vinny.io`. Create the collection with `scripts/setup-pocketbase-collections.sh` and `PB_URL` set, then apply the section 3.1 rule. Record each request and response in the PR.

1. **CHECK-1:** a `DELETE` with the matching stamp returns `204`, and the record is gone.
2. **CHECK-2:** a `DELETE` with a different stamp is refused, and the record stays. Record the exact status and body; this spec expects `404`.
3. **CHECK-3:** a `DELETE` without the parameter returns `204`, as an older build sends it (CD-2).
4. **CHECK-4:** another user's token is refused, with or without the parameter (CD-3).
5. **CHECK-5:** a stamp with a `+00:00` offset matches when sent as `%2B`, and is refused when sent as a raw `+` (CD-5).
6. **CHECK-6:** a realtime subscriber gets the `delete` event for a conditional delete that succeeds.
7. **CHECK-7:** an empty parameter (`?expect_client_updated_at=`) behaves like no parameter. That's what the rule's `= ""` branch assumes for a missing key.

If CHECK-2 or CHECK-7 comes back different, this spec goes back to the Lead before anyone builds it.

## 10. Acceptance criteria

1. **AC-1 (CD-4):** a delete that isn't stale sends `expect_client_updated_at` with the raw stamp the client checked.
2. **AC-2 (CD-5):** a stamp with a `+` offset reaches the server as `%2B`.
3. **AC-3 (CD-6):** a refused delete whose task is gone counts as done and leaves the queue.
4. **AC-4 (CD-6):** a refused delete whose task was edited after the delete leaves the queue without deleting. The next pull restores the edit, and it beats the local Trash or Archive row.
5. **AC-5 (CD-6):** a refused delete still not stale retries once with the fresh stamp. A second refusal spends a retry.
6. **AC-6 (CD-7):** an archive's delete is conditional too.
7. **AC-7 (CD-2, CD-9):** with the rule in place, a delete without the parameter still deletes. Without the rule, a conditional delete still deletes.
8. **AC-8 (CD-8):** native clients send the stored text, not a reformatted date.
9. **AC-9:** section 9 passes on a bare PocketBase 0.40.4, recorded in the server PR.

## 11. Decisions for Vinny

1. **Apply the rule to hosted.** It's a manual change to one API rule, and the order against client releases doesn't matter (CD-9).
2. **Keep the parameter optional for good.** Requiring it would close the race for older builds too, but their deletes would fail instead. Recommended: keep it optional.
3. **MCP stays unconditional.** Recommended, for the reasons in section 7.
4. **Updates later, or not.** The same pattern on `updateRule` would close the matching update race. Recommended: a separate backlog item, decided on its own.

## 12. Test stubs

Each client uses the same names, so the three can be compared. Web stubs sit in `tests/data/sync/pb-push-conditional-delete.test.ts`; iOS in `GSDSyncTests/`, and Android in `core/sync/src/test/`.

```ts
import { describe, it } from 'vitest';

describe('conditional delete (spec-conditional-delete.md)', () => {
  it('a non-stale delete is conditional on the stamp it checked', () => {});                    // AC-1
  it('a delete stamp with an offset is sent with + encoded', () => {});                          // AC-2
  it('a refused delete whose task is gone counts as done', () => {});                            // AC-3
  it('a refused delete whose task was edited after it leaves the queue without deleting', () => {}); // AC-4
  it('the next pull after a refused delete restores the edit over the trash row', () => {});    // AC-4
  it('a refused delete still not stale retries once with the fresh stamp', () => {});           // AC-5
  it('a second refusal spends a retry', () => {});                                               // AC-5
  it("an archive's delete is conditional too", () => {});                                       // AC-6
  it('a delete without the parameter still deletes, as an older build sends it', () => {});     // AC-7, fake server with the rule
  it('a conditional delete against a server without the rule deletes as today', () => {});      // AC-7
});
```

Native-only:

- `the drain index keeps the stored stamp text` (AC-8), on iOS and Android.

The server PR records CHECK-1 to CHECK-7 (AC-9). They're steps on a real server, not unit tests.
