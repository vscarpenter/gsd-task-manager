---
name: verify-retry-budget
description: Model-checks, with TLA+ and TLC, what a failed push costs one task, so a change can't drop an unsynced edit, spend retries on a refused session, or let an exhausted row block a deletion forever. Use when a change touches lib/sync/queue.ts (recordAttemptFailure, getPending, classifyRemoteDeletion), lib/sync/pb-push.ts (recordItemFailure, chargeAttemptForSession, isSessionCheckFailure), lib/sync/failed-recovery.ts, reconcileDeletedTasks in lib/sync/pb-pull.ts, applyRemoteDeletion in lib/sync/pb-sync-engine.ts, SYNC_CONFIG.MAX_RETRIES, or any new code that charges, clears, or reads a queue row's retry state.
---

# Verify the retry budget

The model lives in `docs/formal/retry-budget/`. It follows one task, its queue row, and its server record through failed pushes, the spent budget, a remote absence, and Retry or Dismiss.

## The rules and the harm

| Rule | Harm when it breaks |
|---|---|
| `NoSilentLoss` | An edit the server never got vanishes, with no row and no Trash copy |
| `RefusedKeepsBudget` | A revoked token retires every queued row, and their tasks head for Trash |
| `FailedRowNeverShields` | A task deleted elsewhere stays on this device forever |
| `OutageNeverTrashes` | An outage moves a task you just made to Trash |

## The open finding

`OutageNeverTrashes` breaks in the code. Create a task while the server answers 503. After five syncs the row is failed. The next good pull doesn't list the task, so it moves to Trash, though the server never judged it.

`Proposed-transientFree` is one fix: only a rejection spends the budget. It holds all four rules. It isn't the code. It changes what the budget means, and that's the owner's call.

## Run the check

```bash
bash docs/formal/retry-budget/check.sh
```

Every line must start with `ok`. CI runs the same check in the `test` job.

## When a change touches this code

1. Diff the covered code from the sync commit below.
2. Change the model's step to match the code. Never weaken a rule to make it pass.
3. Run the check. Read any counterexample, then replay it on the real code before you call it a bug.
4. A fixed finding becomes a `Broken-*` config, and its rule joins `RetryBudget.cfg`.
5. Commit the model update on its own, then move the sync commit.

## Coverage record

| Model | Code | What it is |
|---|---|---|
| `YouEdit` | `lib/tasks/crud/helpers.ts`, `lib/sync/queue.ts` | `runTaskSyncTransaction`, `enqueue` |
| `PushLands` | `lib/sync/pb-push.ts` | `pushSingleItem`, `dequeueForSession` |
| `Charged`, `PushFails` | `lib/sync/pb-push.ts`, `lib/sync/queue.ts` | `isSessionCheckFailure`, `recordItemFailure`, `recordAttemptFailure` |
| `Verdict` | `lib/sync/queue.ts` | `classifyRemoteDeletion` |
| `AbsenceApplies` | `lib/sync/pb-pull.ts`, `lib/sync/pb-sync-engine.ts` | `reconcileDeletedTasks`, `applyRemoteDeletion` |
| `YouRetry`, `YouDismiss` | `lib/sync/failed-recovery.ts` | `recoverFailedSyncItem` |

Each variant was replayed as a code edit on 2026-11-22, and broke the same rule on the real engine.

## Sync commit

**`9c0d443`**, on `main`, confirmed 2026-11-22.

## Bounds and what's left out

- One task and one device. At most one pending row, so an edit made while a row is pending isn't modeled. One exhausted row can sit beside it.
- The budget is the real 5. There's no fairness, so the model proves safety and never that a push lands.
- A queued local delete, archive, resurrect on sight, sign-in, and sign-out are out. See verify-task-tombstones and verify-sync-session.
- A 412 is out, since it charges nothing and changes nothing here.
- A 401 that lands on the write itself, after the session check, counts as a rejection.
- Backoff between syncs is out.
