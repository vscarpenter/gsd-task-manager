# Task tombstones model

## Overview

This directory holds a TLA+ model of where one task lives: the matrix, the archive, Trash, and the server. `TaskTombstones.tla` is the model. `check.sh` runs every config and compares each result with an expected one. `view.mjs` labels model states for a chart.

The module header lists the files it models. They sit under `lib/tasks/crud/`, `lib/sync/`, `lib/trash.ts`, `lib/archive.ts`, `lib/tasks/import-export.ts`, and `components/sync/use-sync-auth-dialog.ts`.

## Interface

- `check.sh`: run `bash docs/formal/task-tombstones/check.sh`. It takes no arguments and no flags. It reads `TMPDIR` for its output folder.
  - It runs `scripts/tlc.sh TaskTombstones.tla <config>.cfg` once per config, in a fixed order.
  - It maps TLC exit 0 to `holds` and exit 12 to the name of the violated invariant. Any other status is `error <status>`.
  - It prints one line per config with `ok` or `FAIL`, the expected result, the result, the state count, and the seconds.
  - It exits 0 when every config matches and 1 when any config does not.
- `check.sh` expectations, in run order:

  | Config | Expected result |
  |---|---|
  | `TaskTombstones.cfg` | `OneTable` |
  | `Fixed.cfg` | `holds` |
  | `Finding-1-import.cfg` | `OneTable` |
  | `Finding-2-undo.cfg` | `OneTable` |
  | `Finding-3-reinstate.cfg` | `OneTable` |
  | `Finding-4-stale-write.cfg` | `ServerStaysDeleted` |
  | `Finding-5-stale-delete.cfg` | `NoLoss` |
  | `Finding-6-config-read.cfg` | `NoComeback` |
  | `Finding-6-config-read-loss.cfg` | `NoLoss` |
  | `Broken-restoreKeepsTrashRow.cfg` | `OneTable` |
  | `Broken-pullSkipsTrashGuard.cfg` | `NoComeback` |
  | `Broken-absoluteTombstone.cfg` | `NewerEditWins` |
  | `Broken-resurrectSkipsDelete.cfg` | `NoComeback` |
  | `Broken-reconcileSkipsQueue.cfg` | `NoLoss` |

- `TaskTombstones.tla` (module `TaskTombstones`):
  - Constants: `MaxClock`, `MaxQueue`, `Variant`, `Fixes`.
  - `AllFixes` names six fixes: `importKeepsOneTable`, `undoClearsArchive`, `reinstateChecksAllTables`, `pushDropsTombstonedWrite`, `pushDropsDeleteOfLiveTask`, `readConfigInTransaction`. The module comment says none of them is in the code.
  - `Broken` names five variants: `restoreKeepsTrashRow`, `pullSkipsTrashGuard`, `absoluteTombstone`, `resurrectSkipsDelete`, `reconcileSkipsQueue`.
  - `Spec == Init /\ [][Next]_vars`. It has no fairness condition.
  - `Next` joins 30 named actions. User actions include `YouDelete`, `YouUndo`, `YouRestoreFromTrash`, `YouRestoreFromArchive`, `YouEdit`, `YouArchive`, `YouEmptyTrash`, `YouImport`, `YouSignIn`, and `YouSignOut`. Sync actions include `PushSends`, `PullApplies`, `ReconcileApplies`, and `ResurrectApplies`.
  - `Bounds` limits `clock` and the queue length. Every config uses it as a `CONSTRAINT`.
- Config groups:
  - `TaskTombstones.cfg`: `Variant = "code"` and `Fixes = {}`.
  - `Fixed.cfg`: `Variant = "code"` with all six fixes.
  - `Finding-*.cfg`: all fixes except the one the file name refers to.
  - `Broken-*.cfg`: one `Broken` variant on top of all six fixes.
  - Every config sets `MaxClock = 4` and `MaxQueue = 3`. `Finding-6-config-read-loss.cfg` checks only `TypeOK` and `NoLoss`. The others check all six invariants.
- `view.mjs` exports `title`, `state(v)`, `group(v)`, `colors`, and `step(action, from, to)`. They are pure functions with no imports.

## Invariants

- `TaskTombstones.tla:TypeOK`: every variable keeps its declared type.
- `TaskTombstones.tla:OneTable`: the task lives in at most one of `tasks`, `archivedTasks`, and `deletedTasks`.
- `TaskTombstones.tla:NoComeback`: a server copy no newer than the tombstone never takes the task out of Trash or the archive. The one exception is resurrect on sight, for a delete that never reached the server.
- `TaskTombstones.tla:NewerEditWins`: a server copy edited after the delete or archive wins.
- `TaskTombstones.tla:ServerStaysDeleted`: after a delete or archive removes the server copy, no later push from this device restores it. The rule applies only while the task is still in Trash or the archive here and no delete is pending.
- `TaskTombstones.tla:NoLoss`: a task the user did not delete or archive exists somewhere, locally or on the server.
- `TaskTombstones.tla:Quiet`: `pend.act = "none"`. Every action requires it except six. `YouSignIn` and `YouSignOut` ignore `pend`. `YouDelete`, `YouUndo`, `YouRestoreFromTrash`, and `YouRestoreFromArchive` require a pending action of their own kind.
- The module defines no temporal property, and no config has a `PROPERTY` line.
- `check.sh` uses `set -euo pipefail`. A config passes only when the result string equals the expected string.

## Side Effects

- `check.sh` creates a temp folder with `mktemp -d "${TMPDIR:-/tmp}/task-tombstones.XXXXXX"`. It writes one `<config>.out` log there per config. It does not remove the folder, and it prints the path at the end.
- `check.sh` spawns `bash scripts/tlc.sh` once per config. That script can download the TLC jar and it starts Java. See [scripts](../../../scripts/README.md).
- `TaskTombstones.tla`, the `.cfg` files, and `view.mjs`: None.

## Verification

- Run: `bash docs/formal/task-tombstones/check.sh`
