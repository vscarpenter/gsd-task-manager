# Sync convergence model

## Overview

This directory holds a TLA+ model of one task on two web devices and the PocketBase server. `SyncConvergence.tla` is the model. `check.sh` runs the configs and compares each result with an expected one. `view.mjs` labels model states for a chart.

The module header lists the files it models. They sit under `lib/sync/` and `lib/tasks/crud/`.

## Interface

- `check.sh`: run `bash docs/formal/sync-convergence/check.sh [CONFIG ...]`. With no arguments it runs all 11 configs. An argument is a config name without `.cfg`. It reads `TMPDIR`.
  - It runs `scripts/tlc.sh SyncConvergence.tla <name>.cfg` once per selected config.
  - It maps TLC exit 0 to `holds` and exit 12 to the name of the violated invariant. Any other status is `error(exit N)`.
  - Exit codes: 0 when every config that ran matches, 1 on any mismatch, 2 when no config name matches the arguments.
- `check.sh` expectations:

  | Config | Expected result |
  |---|---|
  | `SyncConvergence.cfg` | `holds` |
  | `FastClockHoldOff.cfg` | `holds` |
  | `FindingOtherTaskCursor.cfg` | `QuietMeansSameCopy` |
  | `FindingPushRace.cfg` | `QuietMeansSameCopy` |
  | `FindingRetriesRunOut.cfg` | `QuietMeansSameCopy` |
  | `FindingFastClock.cfg` | `QuietMeansSameCopy` |
  | `BrokenPushOverwritesNewer.cfg` | `QuietMeansNewestEdit` |
  | `BrokenFailedPushDropsRow.cfg` | `QuietMeansNewestEdit` |
  | `BrokenCursorFollowsClock.cfg` | `QuietMeansSameCopy` |
  | `BrokenApplyIgnoresStamps.cfg` | `UnsentEditStays` |
  | `BrokenNoHoldOff.cfg` | `UnsentEditStays` |

- `SyncConvergence.tla` (module `SyncConvergence`):
  - Constants: `MaxTime`, `MaxQueue`, `MaxRetries`, `Overlap`, `Ceiling`, the booleans `OtherTasks`, `LostEvents`, `RunOut`, `PushOverlap`, `FastClock`, and `Variant`.
  - `Variant` values the definitions test: `code`, `no-hold-off`, `apply-ignores-stamps`, `push-overwrites-newer`, `failed-push-drops-row`, `cursor-follows-clock`.
  - `Next` joins 13 actions: `YouEdit`, `TimePasses`, `SyncStarts`, `SyncFails`, `PushSends`, `PushReads`, `PushWrites`, `PushFails`, `PushDone`, `Pulls`, `EventArrives`, `EventLost`, `FastClockSaves`.
  - `Spec == Init /\ [][Next]_vars`. It has no fairness condition.
- Config groups:
  - `SyncConvergence.cfg`: the baseline with `Variant = "code"`. It checks all four invariants.
  - `FastClockHoldOff.cfg`: the baseline with `FastClock = TRUE` and `MaxTime = 3` (the baseline uses 4). It checks `TypeOK` and `UnsentEditStays`.
  - `Finding*.cfg`: the baseline with one of `OtherTasks`, `PushOverlap`, `RunOut`, or `FastClock` set to `TRUE`.
  - `Broken*.cfg`: one non-`code` `Variant` each. `BrokenNoHoldOff.cfg` also sets `FastClock = TRUE` and `MaxTime = 3`.
- `view.mjs` exports `title`, `state(v)`, `group(v)`, `colors`, and `step(action, from, to)`. They are pure functions with no imports.

## Invariants

- `SyncConvergence.tla:TypeOK`: the variables keep their declared types and bounds.
- `SyncConvergence.tla:QuietMeansSameCopy`: once both devices are quiet, both hold the server's copy of the task.
- `SyncConvergence.tla:QuietMeansNewestEdit`: once both devices are quiet, the server holds the newest edit either device made.
- `SyncConvergence.tla:UnsentEditStays`: an unsent edit stays on screen until an edit newer by `client_updated_at` replaces it. A fast clock's copy never replaces it.
- `SyncConvergence.tla:Quiet` defines "quiet": no pending row, an idle phase, no event in flight, and a pull after the server's last write.
- The module defines no temporal property, and no config has a `PROPERTY` line.
- `check.sh` uses `set -euo pipefail`. A config passes only when the result string equals the expected string.

## Side Effects

- `check.sh` creates a temp folder with `mktemp -d "${TMPDIR:-/tmp}/sync-convergence.XXXXXX"`. It writes one `<name>.out` log there per config. It does not remove the folder, and it prints the path.
- `check.sh` spawns `bash scripts/tlc.sh` once per config. That script can download the TLC jar and it starts Java. See [scripts](../../../scripts/README.md).
- `SyncConvergence.tla`, the `.cfg` files, and `view.mjs`: None.

## Verification

- Run: `bash docs/formal/sync-convergence/check.sh`
