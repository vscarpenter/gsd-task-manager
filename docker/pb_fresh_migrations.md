# docker/pb_fresh_migrations

## Overview

This directory holds the migration overlay for fresh installs. The entrypoint copies these files over the shipped set in [pb_migrations](./pb_migrations.md) when the data volume has no `tasks` table. A file here replaces the shipped file with the same name.

## Interface

- `1781000000_encrypt_existing_tasks.js`: `migrate((_app) => {}, (_app) => {})`. Both directions do nothing. It replaces the shipped encryption backfill on a fresh install.
- `1793030400_saved_tasks.js`: a copy of the shipped file with the same name. Up adds `TextField({ name: "saved_at", max: 50 })` to the `tasks` collection. Down removes `saved_at`.

## Invariants

- `1781000000_encrypt_existing_tasks.js` exists so the shipped migration source never changes. Its comment says a fresh database has no `tasks` collection and no legacy plaintext.
- `1793030400_saved_tasks.js:migrate` returns early when no `tasks` table exists or when `saved_at` already exists.

## Side Effects

- `1781000000_encrypt_existing_tasks.js`: None. PocketBase records the file name as applied.
- `1793030400_saved_tasks.js:migrate` changes the `tasks` collection schema (`saved_at`).

## Verification

- Run: `bun run test` (Vitest; `tests/docker-migrations.test.ts` covers the fresh set)
