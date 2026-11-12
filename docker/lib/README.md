# docker/lib

## Overview

This directory holds one POSIX shell library, `migrations.sh`. The container entrypoint sources it to choose which migration set PocketBase runs. `scripts/verify-pb-encryption.sh` sources it too.

## Interface

- `migrations.sh:gsd_install_state <pb_data_dir>`: prints `fresh` or `existing`. It prints `existing` only when `<pb_data_dir>/data.db` has a table named `tasks`. It returns 1 when `sqlite3` cannot read the database.
- `migrations.sh:gsd_build_fresh_migrations <shipped_dir> <fresh_overlay_dir> <dest_dir>`: copies every `.js` file from the shipped folder, then from the overlay folder, into the destination. It returns the status of the second `cp` (the overlay copy). It does not check the first, so only a caller under `set -e` sees that failure.
- The file reads no environment variables. It runs no command when sourced.

## Invariants

- `migrations.sh:gsd_install_state` fails closed. When `sqlite3` cannot read an existing `data.db`, it prints a `FATAL` line and returns 1. It does not report `fresh`.
- `migrations.sh:gsd_build_fresh_migrations` copies the overlay last, so an overlay file replaces a shipped file with the same name.
- `migrations.sh:gsd_build_fresh_migrations` names no file. A migration added to the shipped folder reaches fresh installs without a change here.

## Side Effects

- `migrations.sh:gsd_install_state` starts a `sqlite3` process that reads `<pb_data_dir>/data.db`.
- `migrations.sh:gsd_build_fresh_migrations` creates the destination folder with `mkdir -p` and copies files into it.

## Verification

- Run: `bun run test` (Vitest; `tests/docker-migrations.test.ts` covers this directory)
