# docker/pb_hooks

## Overview

This directory holds the JavaScript hooks that the self-hosted PocketBase loads through `--hooksDir`. They encrypt task content at rest, guard the feedback collection, handle account deletion and session revocation, and route OAuth callbacks.

Files that end in `.pb.js` register hooks. `encryption-core.js` and `oauth-web-redirect.js` are plain modules that the hooks load with `require`.

## Interface

### Routes

- `account_lifecycle.pb.js`: `routerAdd("DELETE", "/api/gsd/account", ...)` with `$apis.requireAuth("users")`. It returns 204.
- `session_revoke.pb.js`: `routerAdd("DELETE", "/api/gsd/sessions", ...)` with `$apis.requireAuth("users")`. It returns 204.
- `feedback_controls.pb.js`: `routerAdd("GET", "/api/gsd/feedback-controls", ...)` with `$apis.requireSuperuserAuth()`. It returns a JSON status object with `hookVersion`, `ready`, `accepting`, `rateLimit`, `quotaLimit`, `recordCount`, `retentionDays`, and the log settings.
- `oauth_web_redirect.pb.js`: `routerAdd("GET", "/api/gsd/oauth-callback", ...)` and the same path for `POST`. Neither has auth middleware. Each returns a 303 redirect.
- `oauth_realtime_redirect_block.pb.js`: `routerUse(...)`. It throws `NotFoundError` for `/api/oauth2-redirect` and `/api/oauth2-redirect/`.

### Record and lifecycle hooks

- `tasks_encryption.pb.js`: `onRecordCreate`, `onRecordUpdate`, and `onRecordEnrich` on `tasks`.
- `account_lifecycle.pb.js`: `onRecordCreateExecute` on `tasks`.
- `feedback_controls.pb.js`: `onRecordCreateRequest` and `onRecordCreateExecute` on `feedback`, plus `cronAdd("gsd-feedback-retention", "17 3 * * *", ...)`.
- `migration_cleanup.pb.js`: `onBootstrap`.

### Modules

- `encryption-core.js` exports three constants: `PREFIX`, `ENCRYPTED_TEXT_FIELDS`, and `ENCRYPTED_JSON_FIELDS`.
- `encryption-core.js` exports six functions: `isEncrypted(v)`, `isValidCiphertext(value, decipherFn, json)`, `requireValidKey(key)`, `jsonFieldString(record, field)`, `encryptRecord(record, cipherFn, decipherFn)`, and `decryptRecord(record, decipherFn)`.
- `encryption-core.d.ts` declares the `EncRecord` interface, the three constants, and four of the six functions. It omits `isValidCiphertext` and `jsonFieldString`.
- `oauth-web-redirect.js` exports `callbackLocation(readParam, target)`. It returns the target plus a URL fragment.

### Environment variables

- `GSD_TASKS_ENC_KEY`: `tasks_encryption.pb.js` reads it in every callback.
- `GSD_WEB_OAUTH_CALLBACK_URL`: `oauth_web_redirect.pb.js` reads it. The default is `/auth/callback/`.

## Invariants

- `encryption-core.js:requireValidKey` throws unless the key is a string of exactly 32 characters. The three hooks in `tasks_encryption.pb.js` call it first, so task reads and writes both fail without a valid key. The `tasks` hook in `account_lifecycle.pb.js` does not call it.
- `encryption-core.js:PREFIX` (`enc:v1:`) marks ciphertext. `ENCRYPTED_TEXT_FIELDS` is `title` and `description`. `ENCRYPTED_JSON_FIELDS` is `tags`, `subtasks`, and `time_entries`.
- `encryption-core.js:encryptRecord` skips a value that is valid ciphertext, `null`, or `undefined`. It also skips an empty string in a text field. A plaintext value that starts with the prefix still gets encrypted.
- `account_lifecycle.pb.js:onRecordCreateExecute` requires a task's `owner` to resolve to a `users` record in the same transaction.
- `account_lifecycle.pb.js` deletes the account in one transaction. It deletes tasks in batches of 100 and the user record last.
- `feedback_controls.pb.js:onRecordCreateRequest` lets only a superuser set `status`.
- `feedback_controls.pb.js` refuses a create unless the rate limit and log settings match its constants: 30 requests per 60 seconds, log retention of at most one day, no IP logging, no auth id logging.
- `feedback_controls.pb.js:onRecordCreateExecute` refuses a create when the collection holds 10,000 records.
- `oauth_web_redirect.pb.js` takes the redirect target from the environment only, never from the request.
- `oauth-web-redirect.js:callbackLocation` forwards only `code`, `state`, and `error`. It drops empty values and values longer than `MAX_PARAM_LENGTH` (2048).
- `migration_cleanup.pb.js:onBootstrap` runs the vacuum before it deletes the marker row, so a failed vacuum retries on the next boot.
- Each callback keeps its dependencies and constants inside its own body. The comments say callbacks run in isolated VMs.

## Side Effects

- `account_lifecycle.pb.js` (`DELETE /api/gsd/account`): deletes every `tasks` record the caller owns, then the caller's `users` record.
- `session_revoke.pb.js` (`DELETE /api/gsd/sessions`): calls `e.auth.refreshTokenKey()` and `e.app.saveNoValidate(e.auth)`. That ends every earlier token for the user.
- `tasks_encryption.pb.js:onRecordCreate` and `onRecordUpdate`: rewrite `title`, `description`, `tags`, `subtasks`, and `time_entries` to ciphertext with `$security.encrypt` before the save.
- `tasks_encryption.pb.js:onRecordEnrich`: replaces those fields with plaintext in the response. It does not change the database.
- `feedback_controls.pb.js:cronAdd`: deletes `feedback` records older than 180 days, daily at 03:17.
- `migration_cleanup.pb.js:onBootstrap`: runs `e.app.vacuum()`, then deletes the `vacuum_after_task_encryption` row from `_gsd_security_state`.
- `oauth_web_redirect.pb.js`: sends a 303 redirect with the callback values in the URL fragment.
- `oauth_realtime_redirect_block.pb.js`: answers the blocked paths with 404.
- `encryption-core.js` and `oauth-web-redirect.js`: None.

## Verification

- Run: `bun run test` (Vitest; suites under `tests/pb/` cover the hooks and both modules)
