# Spec: Server-Side At-Rest Encryption of Task Content

- **Date:** 2026-06-20
- **Status:** Accepted (design approved; pending spec review)
- **Deciders:** Vinny Carpenter
- **Related:** `docs/privacy-data-flow.html` (privacy review that motivated this)

## Goal

Encrypt user-entered task content at rest on the self-hosted PocketBase backend so that a stolen disk, database file, or backup is useless without a separately-held key — without changing the web client, the MCP server, or the sync protocol.

## Threat model & non-goals

**Protects against:** offline compromise of the data at rest — a copied `data.db`, a leaked backup, a stolen disk/volume snapshot.

**Explicitly does NOT protect against (non-goals):**
- A compromised *running* server or a malicious operator. The decryption key lives in the PocketBase process environment; anyone who can read process memory or call the authenticated API sees plaintext. This is the accepted limit of a "server holds keys" model.
- This is **not** zero-knowledge / end-to-end encryption. The server can read task content (by design — the MCP server and sync depend on it). Any UI copy claiming "zero-knowledge" or "the server never sees your data" is false and must be corrected (see §9).

## Background — current state

Per the privacy review, task content (`title`, `description`, `tags`, `subtasks`, time-entry notes) is stored as **plaintext** PocketBase columns and mapped 1:1 from the client (`lib/sync/task-mapper.ts`). There is no application-level encryption anywhere; the old AES/PBKDF2 layer was removed in the PocketBase migration. The backend runs the **official prebuilt PocketBase binary** (v0.26.6, pinned SHA) via `docker/Dockerfile` + `docker/docker-entrypoint.sh` (`pocketbase serve --dir=/pb_data`).

## Decision

**Field-level encryption implemented entirely in a PocketBase JS hook** (`pb_hooks/*.pb.js`), encrypting sensitive fields on write and decrypting them on read at the PocketBase API boundary.

Why this over whole-DB SQLCipher or volume encryption:
- **No custom build.** JS hooks load into the official prebuilt binary; SQLCipher would force a self-maintained Go build, abandoning the pinned official release.
- **Breaks nothing.** Verified that no server-side `filter`/`sort`/`fields` query references an encrypted field — they use only `owner`, `updated`, `client_updated_at`, `last_seen_at`. Even MCP `search_tasks` fetches full records and filters client-side. So losing server-side query on encrypted fields costs nothing here.
- **Transparent to all consumers.** Decryption happens server-side before serialization, so the web client, MCP server, and sync receive plaintext exactly as today — zero client changes.

## Design

### 1. Fields encrypted

Encrypt (free-text PII): `title`, `description`, `tags`, `subtasks`, and any time-entry note text (`time_entries`).

Leave plaintext (needed for indexing/sort/filter; low sensitivity): `id`, `task_id`, `owner`, `device_id`, `urgent`, `important`, `quadrant`, `completed`, `completed_at`, `due_date`, `recurrence`, all `*_at` timestamps, notification flags, `estimated_minutes`, `time_spent`, `dependencies`.

JSON-typed fields (`tags`, `subtasks`, `time_entries`) are `JSON.stringify`'d → encrypted → stored as a string; on read, decrypted → `JSON.parse`'d back to their original shape. (PocketBase `json` fields accept a string value; if type coercion is a problem, the field type is changed to `text` — confirmed at implementation.)

### 2. Hooks (verified against PocketBase 0.26 docs)

**Encrypt on write** — `onRecordCreate` and `onRecordUpdate`, bound to `"tasks"`, run before validation/persistence:

```js
onRecordCreate((e) => {
  encryptFields(e.record)   // e.record.get(field) -> e.record.set(field, "enc:v1:" + cipher)
  e.next()
}, "tasks")
onRecordUpdate((e) => { encryptFields(e.record); e.next() }, "tasks")
```

**Decrypt on read** — `onRecordEnrich`, bound to `"tasks"`. Per the docs it fires "as part of the builtin Record responses, during realtime message serialization, or when `apis.enrichRecord` is invoked" — i.e. it covers **list, view, AND realtime SSE** from a single hook, eliminating read-path-coverage risk:

```js
onRecordEnrich((e) => {
  decryptFields(e.record)   // only values prefixed "enc:v1:" are decrypted
  e.next()
}, "tasks")
```

### 3. Migration-safe marker

Encrypted values are stored as `"enc:v1:" + cipher`. `decryptFields` only transforms values carrying that prefix; anything else passes through unchanged. Consequences:
- **Idempotent:** re-encrypting an already-encrypted value is prevented (encrypt checks the prefix and skips).
- **Mixed-state tolerant:** legacy plaintext rows and new encrypted rows coexist correctly the instant the hook deploys — old rows read through untouched until backfilled.
- **Rotation-ready:** a future `enc:v2:` enables key rotation without redesign (not built now).

### 4. Cryptography

`$security.encrypt(data, key)` / `$security.decrypt(cipher, key)` — **AES-256-GCM**, key must be a valid **32-char** AES key. GCM provides authenticated encryption (tamper-evident). One key for all encrypted fields.

### 5. Key management

- Key supplied via env `GSD_TASKS_ENC_KEY` (32 chars), injected as a Docker/host secret. **Never committed to git.** Read in the hook via `$os.getenv("GSD_TASKS_ENC_KEY")`.
- **Fail closed:** if the key is absent or not 32 chars, the encrypt hook throws (refuses to persist) rather than silently writing plaintext. Missing key must never degrade to no-encryption.
- **Key backup is operationally mandatory and separate from the DB.** The key is deliberately *not* in the database, so a DB backup is useless without it — which also means a lost key renders encrypted data unrecoverable. Document this loudly.

### 6. Deployment (repo Docker path)

PocketBase serves with `--dir=/pb_data`, and `/pb_data` is a **named Docker volume**. Hooks/migrations placed under `/pb_data/pb_hooks` would be **shadowed by the existing production volume** and never load. Therefore:
- Hook source lives in-repo at `docker/pb_hooks/tasks_encryption.pb.js` (version-controlled).
- `docker/Dockerfile` `COPY`s it to an **image-baked path outside the volume**, e.g. `/pb_hooks/`.
- `docker/docker-entrypoint.sh` adds `--hooksDir=/pb_hooks` (and `--migrationsDir=/pb_migrations`) to the `pocketbase serve` invocation.
- `docker/docker-compose.yml` gains `GSD_TASKS_ENC_KEY` under `environment:` (documented as a secret for real deployments).
- Production `api.vinny.io` deployment must inject the same env var and hooks dir equivalently.

### 7. Existing-row backfill

A one-time, idempotent migration (`docker/pb_migrations/<ts>_encrypt_existing_tasks.js`) iterates every `tasks` row, encrypts the sensitive fields in place, and skips any value already prefixed `enc:v1:`. PocketBase runs pending migrations automatically on `serve` and records them in `_migrations`. Because of the marker, the system stays fully functional before, during, and after backfill. (To verify at implementation: `$security` availability inside the migration VM; whether the backfill should write via raw SQL to avoid bumping the `updated` autodate — a bump triggers a one-time re-pull on all devices, which is harmless but noisy.)

### 8. Impact on the rest of the system

- **Web client:** no data-path changes. Responses are decrypted server-side, so `task-mapper.ts` and all data/sync code are unchanged. (The §9 copy fix is the only client edit, and it is cosmetic.)
- **MCP server:** none. It reads via the PocketBase API, which decrypts via `onRecordEnrich`.
- **Sync (push/pull/realtime):** none. Encryption is transparent at the API boundary; LWW on `client_updated_at` unaffected.

### 9. Companion: correct the false claim copy

Update the stale "zero-knowledge / end-to-end encrypted" copy to an honest statement (e.g. "Task content is encrypted at rest on the server"):
- `components/about/features-section.tsx:84`
- `components/about/privacy-section.tsx:30`
- `components/about/mcp-section.tsx:16` (stale `ENCRYPTION_PASSPHRASE` reference)

## Constraints

- No changes to the web-client **data/sync path**, the MCP server, or the sync protocol — encryption is transparent at the PocketBase API boundary. (The only client-side edit is the cosmetic about-page copy fix in §9, which is unrelated to the data path.)
- Keep the official prebuilt PocketBase binary (no custom Go build).
- Key never in git; encryption fails closed without it.
- Backfill and hooks must be idempotent and tolerate mixed plaintext/ciphertext state.

## Edge cases & failure modes

- **Missing/short key** → encrypt hook throws; no plaintext is written.
- **Legacy plaintext value on read** → no `enc:v1:` prefix → passed through unchanged.
- **Decrypt failure on a genuinely-encrypted value** (wrong key / corruption) → hook throws, surfacing an error rather than leaking ciphertext or empty content to the client.
- **Empty/absent fields** (`description: ""`, `tags: []`) → encrypt only non-empty content; empties stored as-is (no `enc:v1:` prefix), decrypt passes through.
- **Double-encryption** prevented by the prefix check in `encryptFields`.
- **Partial update** (PATCH that omits a field) → `onRecordUpdate` only re-encrypts fields present/changed; untouched encrypted fields remain encrypted.

## Out of scope (YAGNI)

- Key rotation tooling (marker leaves the door open).
- Per-user / per-record keys.
- Encrypting structured metadata (flags, timestamps, ids).
- Any client-side or end-to-end encryption.
- Whole-DB SQLCipher and volume encryption (evaluated, rejected).

## Acceptance criteria

1. Creating a task via the API stores `title`/`description`/`tags`/`subtasks` as `enc:v1:…` ciphertext in `data.db` (verifiable via `sqlite3`).
2. Fetching that task via REST returns plaintext identical to what was sent.
3. A realtime SSE subscription delivers plaintext (not ciphertext) for create/update events.
4. The web app and MCP server operate unchanged against the encrypted backend (manual smoke test).
5. With `GSD_TASKS_ENC_KEY` unset, the backend refuses to persist task content (fail-closed) rather than writing plaintext.
6. The backfill migration encrypts all pre-existing rows and is a no-op on re-run.
7. A row written before deploy (plaintext) still reads correctly after deploy and before backfill.
8. The about-page no longer claims zero-knowledge / E2E.

## Test stubs

- `should_store_ciphertext_in_sqlite_after_create`
- `should_return_plaintext_over_rest_after_encryption`
- `should_deliver_plaintext_over_realtime_subscription`
- `should_fail_closed_when_encryption_key_missing`
- `should_pass_through_legacy_plaintext_rows_on_read`
- `should_be_idempotent_on_double_write_and_on_backfill_rerun`
- `should_roundtrip_json_fields_tags_and_subtasks`
- `should_throw_on_decrypt_failure_rather_than_leak`

## Open items to confirm at implementation

- Exact `$security.decrypt` return type and error behavior (docs incomplete) — pin against the running 0.26.6 instance.
- `$security` availability inside the migration JSVM.
- Whether `tags`/`subtasks`/`time_entries` PocketBase field types must change `json` → `text` to hold ciphertext.
- Whether to suppress the `updated` autodate bump during backfill (avoid a noisy one-time re-pull).
