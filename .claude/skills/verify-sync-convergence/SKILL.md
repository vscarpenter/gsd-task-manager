---
name: verify-sync-convergence
description: Model-checks, with TLA+ and TLC, that one task synced between two web devices and PocketBase ends with every copy holding the newest edit, so a change can't silently lose an edit or leave a device stuck on an old copy. Use when a change touches lib/sync/queue.ts, lib/sync/pb-push.ts, lib/sync/pb-pull.ts, lib/sync/pb-sync-engine.ts (fullSync, applyRemoteChange, updateSyncCursor), lib/sync/task-mapper.ts (clampClientTimestamp, pocketBaseToTaskRecord), lib/sync/pb-sync-helpers.ts (fetchRemoteTaskEntry, holdsOffFarFutureRemote, isBeyondClockSkew), lib/sync/sync-coordinator.ts, lib/sync/pb-realtime.ts, lib/sync/retry-manager.ts, SYNC_CONFIG in lib/constants/sync.ts, or a local write path that enqueues a sync row (lib/tasks/crud/update.ts, helpers.ts, and the other writers in lib/tasks/crud/).
---

# Verify sync convergence

The model lives in `docs/formal/sync-convergence/`. It follows one task on two web devices (A and B) and the PocketBase server. It covers the push queue, the pull cursor, last-write-wins, realtime events, the far-future hold-off, and one fullSync at a time per device.

## The property and the harm

The property: once both devices are quiet, both devices and the server hold the same copy of the task, and it's the newest edit either device made by `client_updated_at`.

The harm when it breaks: an edit you made shows on one device and never reaches the other, with no error that says so.

"Quiet" means each device has no pending queue row, no sync running, no realtime event on its way, and a completed pull after the server's last write. The model splits the property into two rules so a counterexample says which half broke, and adds a third rule that guards the hold-off:

| Rule | In plain words |
|---|---|
| `QuietMeansSameCopy` | Once both devices are quiet, both show the server's copy. |
| `QuietMeansNewestEdit` | Once both devices are quiet, the server holds the newest edit. |
| `UnsentEditStays` | An unsent edit stays on screen until a newer edit replaces it. A fast clock's copy never replaces it. |

## Run it

```sh
bash docs/formal/sync-convergence/check.sh
```

It runs every config through `bash scripts/tlc.sh`, which pins and hash-checks TLC 1.7.4 on Java 21. It prints one line per config and exits 0 only when every result matches its expected outcome. The full run takes about a minute and a half. Name configs to run only those, such as `bash docs/formal/sync-convergence/check.sh SyncConvergence FindingPushRace`. The last lines print the folder that holds TLC's output for each config, counterexamples included.

Expected result at the sync commit:

| Config | Expected | What it adds to the code |
|---|---|---|
| `SyncConvergence` | holds (414,897 states) | Nothing: edits on both devices, pushes that fail and retry, syncs that fail, lost realtime events |
| `FastClockHoldOff` | holds (1,629,373 states) | A client with a fast clock saves the task once; checks only `UnsentEditStays` |
| `FindingOtherTaskCursor` | breaks `QuietMeansSameCopy` | Another task's record moves the shared pull cursor (finding 1) |
| `FindingPushRace` | breaks `QuietMeansSameCopy` | The other device writes between a push's read and its write (finding 2) |
| `FindingRetriesRunOut` | breaks `QuietMeansSameCopy` | Pushes keep failing until a row's retries run out (finding 3) |
| `FindingFastClock` | breaks `QuietMeansSameCopy` | A client with a fast clock saves the task once (finding 4) |
| `BrokenPushOverwritesNewer` | breaks `QuietMeansNewestEdit` | Push drops its `isRemoteNewer` check |
| `BrokenFailedPushDropsRow` | breaks `QuietMeansNewestEdit` | A failed push dequeues its row |
| `BrokenCursorFollowsClock` | breaks `QuietMeansSameCopy` | Every pull moves the cursor to now minus the overlap |
| `BrokenApplyIgnoresStamps` | breaks `UnsentEditStays` | Pull and realtime skip the strictly-newer check |
| `BrokenNoHoldOff` | breaks `UnsentEditStays` | `holdsOffFarFutureRemote` always says no |

Each finding config differs from a config that holds by one environment constant, so its break comes from that one addition. The broken variants are code mutations, chosen with the `Variant` constant, that prove each rule can fail. A finding config that starts to hold means someone fixed that finding, and a broken variant that starts to hold means the model stopped checking that rule. Either one is a reason to look, not a pass.

Read every result, failing or passing, with the `/statechart` skill, giving it `SyncConvergence.tla`, the config, and the view at `docs/formal/sync-convergence/view.mjs`. It tells each counterexample as its shortest path in the reader's words. The configs that hold have hundreds of thousands of states, too many to draw, so for them expect a report of the rules that hold rather than a chart.

## Sync commit

`dd32e08c` (chore(release): v14.8.0). At that commit, every file in the coverage record matches what the model describes. Move this line forward only after you've read the diff of every covered file since `dd32e08c`. You must also confirm that the model still describes the code at the new commit. To see what changed, uncommitted edits included:

```sh
git diff --stat dd32e08c -- lib/sync lib/tasks/crud lib/constants/sync.ts
```

## Coverage record

Each comment in `SyncConvergence.tla` names the function its step models.

| Model part | File | Function |
|---|---|---|
| `YouEdit` | `lib/tasks/crud/update.ts`, `lib/tasks/crud/helpers.ts`, `lib/sync/queue.ts` | `updateTask`, `runTaskSyncTransaction`, `SyncQueue.enqueue` (no merging: one row per edit) |
| `SyncStarts`, `phase` | `lib/sync/sync-coordinator.ts`, `lib/sync/pb-sync-engine.ts` | `SyncCoordinator.requestSync`, `drainQueue`, `fullSync`, `runSyncPasses` (push, then pull) |
| `todo` | `lib/sync/pb-push.ts`, `lib/sync/queue.ts` | `pushLocalChanges` tries what `getPending` returned at its start |
| `PushSends`, `PushReads`, `PushWrites`, `Decides`, `RemoteNewer` | `lib/sync/pb-push.ts`, `lib/sync/pb-sync-helpers.ts` | `pushSingleItem`, `isRemoteNewer`, `upsertRemoteTask`, `fetchRemoteTaskEntry` |
| `PushFails` | `lib/sync/queue.ts`, `lib/sync/pb-push.ts` | `recordAttemptFailure`; the `catch` and 429 `break` in `pushLocalChanges`; the `index_unavailable` path in `pushSingleItem` |
| `SyncFails` | `lib/sync/pb-sync-engine.ts` | `fullSync`'s `catch` to `reportSyncError`, and `reportAuthFailure` |
| `Pulls`, `cursor` | `lib/sync/pb-pull.ts`, `lib/sync/pb-sync-engine.ts` | `pullRemoteChanges` (`>=` filter), `applyPreparedRecord`, `remoteVersionWins`, `acceptsRemoteVersion`, `findMaxAppliedClientUpdated`, `CURSOR_OVERLAP_MS`, `updateSyncCursor`, `resolvePullCursor` |
| `Clamp` | `lib/sync/task-mapper.ts` | `clampClientTimestamp` inside `pocketBaseToTaskRecord` |
| `HoldsOff`, `BeyondSkew`, `Pending` | `lib/sync/pb-sync-helpers.ts`, `lib/sync/queue.ts` | `holdsOffFarFutureRemote`, `isBeyondClockSkew`, `isPendingSyncQueueItem` |
| `Writes` sends an event to the other device only | `lib/sync/pb-realtime.ts` | `handleRealtimeEvent` echo filter on `device_id` |
| `EventArrives` | `lib/sync/pb-sync-engine.ts` | `applyRemoteChange`, `localCopyHolds` |
| `EventLost` | `lib/sync/pb-realtime.ts` | `subscribe`: PocketBase SSE has no replay |
| `MaxRetries`, `Overlap`, `Ceiling` | `lib/constants/sync.ts`, `lib/sync/pb-pull.ts` | `SYNC_CONFIG.MAX_RETRIES` (5), `CURSOR_OVERLAP_MS` (30 s), `SYNC_CONFIG.MAX_CLIENT_CLOCK_SKEW_MS` (5 min) |
| not modeled | `lib/sync/retry-manager.ts` | `RetryManager` backoff only delays syncs. The model lets a sync start at any time, which covers every delay. |

## Check a change

1. Run the `git diff` from the sync commit section. If no covered file changed, run the check, and you're done.
2. Read the diff. For each changed function, find its row in the coverage record and the step in `SyncConvergence.tla` that models it.
3. If the change alters what that step does, change the step (the `Variant = "code"` path) to match the new code. Keep one code step as one model step: a `fetch` and a later write with an `await` between them are two steps.
4. Run `bash docs/formal/sync-convergence/check.sh`.
5. Every line matches: the change keeps the property within these bounds. Move the sync commit forward.
6. A line doesn't match: read that config's output with `/statechart`, then decide whether it's a real bug or a modeling error (next section).

This procedure was proven once on a scratch break: `pullRemoteChanges` set the cursor from the clock, not from applied records. After the matching change to `Pulls`, `SyncConvergence` broke `QuietMeansSameCopy`, and the replay showed B missing A's edit with no other task involved.

## A real bug or a modeling error

Replay the counterexample against the real code, one step per model step. Write a Vitest file under `tests/data/`, since the `@/` alias needs the repo root. Run it with `bun run test tests/data/<file>`, then `mv` it to a scratch folder outside the repo. Never commit a replay. Assert the property, so the test fails when the bug is real. Add a control run without the step that triggers the bug; it should pass.

What worked for the first replays:

- Mock `@/lib/sync/pocketbase-client` with an in-memory `tasks` collection. `getList` filters on the `client_updated_at >= "..."` clause of the filter and returns a plain array, which `fetchBoundedRemoteTasks` accepts. `getFirstListItem` throws `{ status: 404 }` for a missing task. Give `users` an `authRefresh` that returns the owner.
- Mock `@/lib/sync/pb-auth` (`ensureValidAuth` resolves true) and `@/lib/sync/notifications`.
- Play both devices on one IndexedDB: save every Dexie table's rows for the current device, clear them, and load the other device's rows.
- Use `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime` to control stamps, and drive steps through `updateTask`, `fullSync`, and `applyRemoteChange`.
- To land a write between one device's read and its write, serve that device's `getFirstListItem` the record as it stood before the other device's write.

If the replay doesn't show the bug, treat the model as wrong until you show it isn't. Fix the step that doesn't match the code. Never weaken a rule, loosen `Quiet`, or narrow the environment to make a config hold.

## Update the model for an intended change

When the code changes on purpose, update the step that models it, and update the coverage record row if a function moved or was renamed. If the change fixes a finding, its config should start to hold. Change that config's line in `check.sh` to `holds` and keep the config as a regression guard. Then move the finding below into a "fixed" note that names the commit. If the change adds behavior the model lacks, such as a retry for failed rows, add it as a step or a constant. Add a broken variant that shows the new rule can fail. Then run the check, and move the sync commit forward.

## Findings at the sync commit

Each finding was replayed against the real code at `dd32e08c`, and each replay failed on the property while its control passed.

1. **An edit that reaches the server behind the other device's cursor is never pulled** (`FindingOtherTaskCursor`). A edits the task while offline, stamped minute 1. Another client saves a different task at minute 3, and B's `fullSync` applies it, so `updateSyncCursor` sets B's `lastClientUpdatedAt` to 2:30. A comes online, and `pushSingleItem` writes its minute-1 edit. B's tab is closed, so the realtime event is lost. Every later `pullRemoteChanges` on B asks for `client_updated_at >= 2:30`, so B shows the old copy until someone edits the task again. The cursor is one per account, so any other task moves it. Replay: B still showed "Original" after two more syncs. The control, with no other task, passed.
2. **Two pushes of one task can leave the server on the older edit** (`FindingPushRace`). A edits at minute 1, and B edits at minute 2. A's `fetchRemoteTaskEntry` returns the original, and so does B's. B writes its edit. A's upsert, decided on its stale read, overwrites it with A's older edit, because the server has no compare-and-set on `client_updated_at`. Realtime hands A B's edit, and B's pull rejects A's older stamp, so both devices show B's edit. The server keeps A's, and so does any device that signs in later. Replay: the server ended on "A edit" stamped 12:01 while B held "B edit". The control passed.
3. **A push whose retries run out never reaches the server** (`FindingRetriesRunOut`). A edits, and five syncs in a row fail to read the remote entry, so `recordAttemptFailure` marks the row `failed`. `getPending` skips failed rows, and nothing re-arms them. A keeps its edit, and B and the server keep the old copy. The health monitor reports failed items, but nothing sends the edit again. Replay: after the server recovered, the server and B still held "Original".
4. **A fast clock's save splits the device that took it** (`FindingFastClock`). A edits and hasn't pushed. A client whose clock runs a year fast saves the task. B has nothing queued, so its pull takes that copy, and `clampClientTimestamp` stamps it now plus 5 minutes. A pushes, and `isRemoteNewer` never loses to a far-future stamp, so the server gets A's edit. B's realtime event and its pulls compare A's stamp with B's clamped one and keep the fast clock's copy. TLC's shortest path splits A the same way, through the fast clock's realtime event arriving after A's push dequeued the row. Replay: B showed "Fast clock" while the server held "A edit".

## Bounds, assumptions, and what's left out

Bounds: one task, two devices, one server. One tick is 30 seconds, and time runs to tick 4 (tick 3 in `FastClockHoldOff` and `BrokenNoHoldOff`). Each device queues at most 2 rows. A row gets 2 tries before it's marked failed, where the code allows 5. The overlap is 1 tick, and the skew ceiling is 10 ticks. A pass covers these bounds, not every run of the app.

Assumptions:

- Every device clock reads the same tick, and each edit gets its own tick. Only the fast clock client is skewed.
- A pull is one step: fetch, apply, and cursor write. The apply re-reads the local row in its transaction and keeps the newer copy, so a stale fetch can only offer an older copy, which it rejects.
- In the code, a push of one row is two steps: `fetchRemoteTaskEntry`, then the upsert. Every config but `FindingPushRace` assumes no other write lands between them and models the push as one step. `FindingPushRace` drops that assumption, and that exposes finding 2.
- "Another task's record" in a pull is stamped at the current tick: the case where another client saved it just now.
- Realtime events arrive in any order and at any time, or not at all where `LostEvents` allows it. A device never gets its own events.

Left out:

- Deletes, archive, Trash, `reconcileDeletedTasks`, and `resurrectOnSight`.
- The backfill pull after a pull contract bump (`mergeSameVersion`).
- Field-level content, such as placement read from the current row or `notify_before`. A copy is one whole edit.
- Two devices stamping the same millisecond.
- Retry backoff and auto-sync blocking.
- Sign-in, sign-out, the session fence, and two tabs on one device.
- A write that reached the server while its client saw an error.
- The iOS and Android apps and the MCP server, except as the source of another task's record or of the fast clock.
- Liveness. The rules hold at quiet states, and the model doesn't prove that a quiet state comes.

## Keeping it in step

Sometimes covered code changes after the sync commit and nobody rechecks the model. Then use the `/maintain-formal-verification-skill` skill to bring the model, the coverage record, and this file back in line.
