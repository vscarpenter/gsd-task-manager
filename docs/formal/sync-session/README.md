# Sync session model

## Overview

This directory holds a TLA+ model of which account each sync write lands in. It covers sign-in, sign-out, Reset Everything, and a second open tab. `SyncSession.tla` is the model. `check.sh` runs every config and compares each result with an expected one. `view.mjs` labels model states for a chart.

The module header lists the files it models. They sit under `lib/sync/`, plus `lib/reset-everything.ts`, `lib/reset-local-data.ts`, `lib/tasks/crud/helpers.ts`, and `components/sync/use-sync-auth-dialog.ts`. The header also names the tasks API rules in `scripts/setup-pocketbase-collections.sh`. The header names `.claude/skills/verify-sync-session/SKILL.md` as the skill that runs the model.

## Interface

- `check.sh`: run `bash docs/formal/sync-session/check.sh`. It parses no arguments and always runs all eight configs. It reads `TMPDIR`.
  - It runs `scripts/tlc.sh SyncSession.tla <config>` once per config.
  - `outcome_of` reads the result from the log text: the violated invariant's name, `deadlock`, `pass`, or `tlc-error`.
  - Exit codes: 0 when every config matches, 1 on any mismatch.
- `check.sh` expectations:

  | Config | Expected result |
  |---|---|
  | `SyncSession.cfg` | `pass` |
  | `BrokenPullFence.cfg` | `DeviceHoldsOnlyTheSignedInAccount` |
  | `BrokenSignInGuard.cfg` | `DeviceHoldsOnlyTheSignedInAccount` |
  | `BrokenPushPrincipal.cfg` | `NoRecordInAnotherAccount` |
  | `BrokenPushQueueFence.cfg` | `NoRecordInAnotherAccount` |
  | `BrokenSignOutRead.cfg` | `NoRecordInAnotherAccount` |
  | `BrokenSettingsWrite.cfg` | `NoRecordInAnotherAccount` |
  | `BrokenPopulate.cfg` | `NoRecordInAnotherAccount` |

- `SyncSession.tla` (module `SyncSession`):
  - Constant: `Broken`.
  - `BrokenGuards`: `none`, `pull-skips-fence`, `sign-in-skips-owner-check`, `push-skips-principal-check`, `push-skips-queue-fence`, `sign-out-reads-config-early`, `settings-writes-stale-config`, `populate-after-sign-in`.
  - `Next` joins 26 actions in five groups.
    - Sync tab: `SyncStarts` to `PullApplies`.
    - Realtime: `EventArrives` and `EventApplies`.
    - Sign-in: `YouSignIn` to `PopulateWrites`.
    - Sign-out and reset: `YouSignOut` to `ResetReloads`.
    - Settings and edits: `YouChangeAutoSync`, `AutoSyncSaves`, `YouEditTask`, `EditSaves`.
  - `Spec == Init /\ [][Next]_vars`. It has no fairness condition.
- Config groups:
  - `SyncSession.cfg`: `Broken = "none"`, the code as it is. It checks `TypeOK` and both rules.
  - `Broken*.cfg`: seven configs with one broken guard each.
  - `BrokenSignOutRead.cfg`, `BrokenSettingsWrite.cfg`, and `BrokenPopulate.cfg` check only `TypeOK` and `NoRecordInAnotherAccount`. The other four check both rules too.
- `view.mjs` exports `title`, `state(v)`, `group(v)`, `colors`, and `step(action, from, to)`. `state` returns a pair of strings. The functions are pure and have no imports.

## Invariants

- `SyncSession.tla:TypeOK`: every variable keeps its declared type and domain.
- `SyncSession.tla:NoRecordInAnotherAccount`: no account's server copy ever holds a task or queued edit from another account.
- `SyncSession.tla:DeviceHoldsOnlyTheSignedInAccount`: while sync is on for an account, the device holds only that account's tasks and queued edits.
- `SyncSession.tla:ASSUME`: `Broken` is in `BrokenGuards`.
- The module defines no temporal property, and no config has a `PROPERTY` line.
- `check.sh` uses `set -uo pipefail` without `-e`, so the loop continues after a failed TLC run.

## Side Effects

- `check.sh` creates a temp folder with `mktemp -d "${TMPDIR:-/tmp}/sync-session-check.XXXXXX"`. It writes one `.out` log there per config.
- `check.sh:cleanup` removes the folder on exit. A mismatch sets `keep_output=1`, which keeps the folder.
- `check.sh` spawns `bash scripts/tlc.sh` once per config. That script can download the TLC jar and it starts Java. See [scripts](../../../scripts/README.md).
- `SyncSession.tla`, the `.cfg` files, and `view.mjs`: None.

## Verification

- Run: `bash docs/formal/sync-session/check.sh`
