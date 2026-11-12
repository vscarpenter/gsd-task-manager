# docker/pb_migrations

## Overview

This directory holds the shipped PocketBase migrations for the self-hosted image. The entrypoint runs them with `pocketbase migrate up` before the server starts. A volume with an existing `tasks` table runs this set as is. A fresh volume runs this set with the overlay from [pb_fresh_migrations](./pb_fresh_migrations.md).

## Interface

Each file calls `migrate(up, down)`.

| File | Up | Down |
|---|---|---|
| `1781000000_encrypt_existing_tasks.js` | Encrypts `title`, `description`, `tags`, `subtasks`, and `time_entries` on every `tasks` record and saves each with `app.save` | No-op |
| `1781100000_harden_task_encryption_cleanup.js` | Encrypts remaining plaintext, repairs JSON values stored as byte arrays, and sets the vacuum marker when `tasks` has at least one record. Returns early with no `tasks` table | No-op |
| `1781200000_reencrypt_invalid_prefixed_task_fields.js` | Encrypts again any field that has the prefix but is not valid ciphertext | No-op |
| `1781300000_vacuum_after_prefix_repair.js` | Sets the vacuum marker again. Returns early with no `tasks` table | No-op |
| `1793030400_saved_tasks.js` | Adds `TextField({ name: "saved_at", max: 50 })` to `tasks` | Removes `saved_at` |
| `1793562900_users_auth_token_30_days.js` | Raises `users.authToken.duration` to `THIRTY_DAYS` when it is lower | Sets `SEVEN_DAYS` only when the value equals `THIRTY_DAYS` |
| `1794061500_top_three.js` | Adds `focus_date` (text, max 10, date pattern) and `focus_rank` (integer, 0 to 3) to `tasks` | Removes both fields |

- `GSD_TASKS_ENC_KEY`: the first three migrations read it with `$os.getenv`. The others read no environment variable.

## Invariants

- The first three migrations throw unless `GSD_TASKS_ENC_KEY` is a string of exactly 32 characters.
- `1781000000_encrypt_existing_tasks.js` skips a value that already starts with `enc:v1:`. It checks the prefix only.
- Applied migration files are immutable. The comments in `1781200000_reencrypt_invalid_prefixed_task_fields.js` and `1781300000_vacuum_after_prefix_repair.js` say deployed databases record the file names, so fixes ship as new files. The comment in `1781100000_harden_task_encryption_cleanup.js` says only to keep the shipped migration immutable.
- `1781100000_harden_task_encryption_cleanup.js` and `1781200000_reencrypt_invalid_prefixed_task_fields.js` write with raw SQL. The comment says this bypasses record hooks and keeps owner and timestamps unchanged.
- `1781100000_harden_task_encryption_cleanup.js:decodeUtf8` validates UTF-8 strictly and throws on a malformed sequence.
- `1793030400_saved_tasks.js` and `1794061500_top_three.js` return early when no `tasks` table exists. They add a field only when it is absent.
- `1793562900_users_auth_token_30_days.js` only raises the duration. It does not change the token secret.
- `1794061500_top_three.js` is for the self-hosted image only. Its comment says never to point the hosted binary at this directory.

## Side Effects

- `1781000000_encrypt_existing_tasks.js`: writes five encrypted fields on every `tasks` record through `app.save`.
- `1781100000_harden_task_encryption_cleanup.js`: runs `PRAGMA secure_delete = ON` and raw `UPDATE tasks SET ...`. When `tasks` has at least one record, it creates the table `_gsd_security_state` and inserts the row `vacuum_after_task_encryption`. With no `tasks` table it does nothing.
- `1781200000_reencrypt_invalid_prefixed_task_fields.js`: runs raw `UPDATE tasks SET ...` on the five encrypted fields.
- `1781300000_vacuum_after_prefix_repair.js`: creates `_gsd_security_state` when missing and inserts the marker row. With no `tasks` table it does nothing. The vacuum itself runs in [pb_hooks](./pb_hooks.md) (`migration_cleanup.pb.js`).
- `1793030400_saved_tasks.js` and `1794061500_top_three.js`: change the `tasks` collection schema.
- `1793562900_users_auth_token_30_days.js`: changes the `users` collection setting `authToken.duration`.

## Verification

- Run: `bun run test` (Vitest; `tests/pb/encryption-migration.test.ts`, `tests/pb/encryption-invalid-prefix-migration.test.ts`, and `tests/pb/top-three-migration.test.ts` cover this directory)
