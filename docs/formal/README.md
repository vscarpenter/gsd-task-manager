# docs/formal

## Overview

This directory groups three TLA+ models of the web app's sync and task storage. Each child holds one `.tla` module, its `.cfg` files, a `check.sh` runner, and a `view.mjs` chart view. Every `check.sh` calls `scripts/tlc.sh`. This directory has no source files of its own.

## Subdirectories & Boundaries

- sync-convergence: [./sync-convergence/README.md](./sync-convergence/README.md) - One task on two devices and the server. `check.sh [CONFIG ...]` runs 11 configs against `QuietMeansSameCopy`, `QuietMeansNewestEdit`, and `UnsentEditStays`.
- sync-session: [./sync-session/README.md](./sync-session/README.md) - Which account each sync write lands in. `check.sh` runs 9 configs against `NoRecordInAnotherAccount` and `DeviceHoldsOnlyTheSignedInAccount`.
- task-tombstones: [./task-tombstones/README.md](./task-tombstones/README.md) - Where one task lives across the matrix, archive, Trash, and server. `check.sh` runs 14 configs against `OneTable`, `NoComeback`, `NewerEditWins`, `ServerStaysDeleted`, and `NoLoss`.
