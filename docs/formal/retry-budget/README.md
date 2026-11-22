# Retry budget model

## Overview

This directory holds a TLA+ model of one task's sync retry budget on one web device. It follows the task from its first failed push to what a remote absence then does with it. The sync-convergence model leaves out deletions and Trash, which is where a spent budget does its harm.

## Interface

- `check.sh`: run `bash docs/formal/retry-budget/check.sh`. It runs each config through `scripts/tlc.sh` and compares the result.
- `check.sh` expectations:

  | Config | Expected result | Stands for |
  |---|---|---|
  | `RetryBudget.cfg` | `holds` | The code |
  | `Proposed-transientFree.cfg` | `holds` | A proposed fix for the open finding. It isn't the code |
  | `Finding-outageTrashes.cfg` | `OutageNeverTrashes` | An open bug in the code |
  | `Broken-exhaustedRowDeleted.cfg` | `NoSilentLoss` | The bug #240 fixed |
  | `Broken-refusedCharges.cfg` | `RefusedKeepsBudget` | The bug #717 fixed |
  | `Broken-failedRowDropped.cfg` | `NoSilentLoss` | The guard #440 left until #527 |
  | `Broken-failedRowShields.cfg` | `FailedRowNeverShields` | The audit finding #440 fixed, which came back during #527 |

- `RetryBudget.tla` (module `RetryBudget`):
  - Constants: `MaxRetries` (5, as in the code) and `Variant`.
  - `Next` joins `YouEdit`, `PushLands`, `PushFails`, `OtherDeviceDeletes`, `AbsenceApplies`, `YouRetry`, `YouDismiss`, and `Left`.

## Invariants

- `RetryBudget.tla:NoSilentLoss`: an edit the server never got is live with a row to send or retry, or it's in Trash.
- `RetryBudget.tla:RefusedKeepsBudget`: a refused session never spends the budget.
- `RetryBudget.tla:FailedRowNeverShields`: an exhausted row alone never holds off a remote deletion.
- `RetryBudget.tla:OutageNeverTrashes`: failures with no answer never move a task to Trash. The code breaks this today.

## Side Effects

- `check.sh` writes one log per config to a new temp folder and prints its path.
- `check.sh` runs `scripts/tlc.sh`, which can download the pinned TLC jar and starts Java.

## Verification

- `bun run test tests/data/check-models.test.ts` covers the runner that finds this model in CI.
- CI's `test` job runs it through `scripts/check-models.sh`.
