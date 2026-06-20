# Server-Side At-Rest Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt task content (`title`, `description`, `tags`, `subtasks`, `time_entries`) at rest on the self-hosted PocketBase backend via a JS hook, with no web-client / MCP / sync-protocol changes.

**Architecture:** A pure CommonJS core (`encryption-core.js`) holds the marker + field logic and is unit-tested with dependency-injected cipher functions. A thin PocketBase adapter (`tasks_encryption.pb.js`) wires `$security` AES-256-GCM into `onRecordCreate`/`onRecordUpdate` (encrypt-on-write) and `onRecordEnrich` (decrypt-on-read, which also covers realtime SSE). A one-shot migration backfills existing plaintext rows. Encryption is transparent at the PocketBase API boundary, so all consumers keep receiving plaintext.

**Tech Stack:** PocketBase 0.26.6 JS hooks (goja VM), `$security.encrypt/decrypt`, CommonJS, Vitest (core unit tests), Docker.

## Global Constraints

- **Key never in git.** The AES key is supplied via env `GSD_TASKS_ENC_KEY` (exactly 32 chars). Read with `$os.getenv("GSD_TASKS_ENC_KEY")`.
- **Fail closed.** If the key is missing or not 32 chars, the encrypt path throws and refuses to persist — never silently write plaintext.
- **Keep the official prebuilt PocketBase binary** (v0.26.6, pinned SHA). No custom Go build.
- **No web-client data-path / MCP / sync-protocol changes.** The only client edit is the cosmetic about-page copy (Task 6).
- **Migration marker:** encrypted values are stored as `enc:v1:` + ciphertext. All encrypt/decrypt logic is idempotent and tolerates mixed plaintext/ciphertext rows.
- **PocketBase handler isolation:** each `onRecord*` callback runs as an isolated program — acquire the core module and key *inside* each callback, never from outer scope.
- **Encrypted JSON fields:** `tags`, `subtasks`, `time_entries` are `JSON.stringify`'d before encryption and `JSON.parse`'d after decryption.
- **Copy deploy-ordering:** the Task 6 copy must not assert at-rest encryption as live until the backend hook is deployed to production.

## File Structure

| File | Responsibility |
|---|---|
| `docker/pb_hooks/encryption-core.js` (create) | Pure CJS logic: marker, key validation, field encrypt/decrypt with injected cipher. No PocketBase globals. |
| `docker/pb_hooks/encryption-core.d.ts` (create) | Type declarations so the Vitest test imports cleanly under TS strict. |
| `tests/pb/encryption-core.test.ts` (create) | Vitest unit tests for the core with a reversible fake cipher. |
| `docker/pb_hooks/tasks_encryption.pb.js` (create) | PocketBase adapter: wires `$security` + env key into create/update/enrich hooks. |
| `docker/pb_migrations/1781000000_encrypt_existing_tasks.js` (create) | One-shot idempotent backfill of existing plaintext rows. |
| `docker/Dockerfile` (modify) | COPY `pb_hooks/` and `pb_migrations/` to image-baked `/pb_hooks` and `/pb_migrations` (outside the `/pb_data` volume). |
| `docker/docker-entrypoint.sh` (modify) | Add `--hooksDir=/pb_hooks --migrationsDir=/pb_migrations` to `pocketbase serve`. |
| `docker/docker-compose.yml` (modify) | Add `GSD_TASKS_ENC_KEY` env with a documented secret note. |
| `docker/docker-setup-and-run.md` (modify) | Document key generation, backup, and fail-closed behavior. |
| `scripts/verify-pb-encryption.sh` (create) | Integration harness: run PB with hook + key, assert ciphertext at rest + plaintext over API. |
| `components/about/features-section.tsx` (modify) | Replace false "zero-knowledge / E2E" claim. |
| `components/about/privacy-section.tsx` (modify) | Correct sync privacy copy. |
| `components/about/mcp-section.tsx` (modify) | Remove stale `ENCRYPTION_PASSPHRASE`. |

---

### Task 1: Pure encryption core + unit tests

**Files:**
- Create: `docker/pb_hooks/encryption-core.js`
- Create: `docker/pb_hooks/encryption-core.d.ts`
- Test: `tests/pb/encryption-core.test.ts`

**Interfaces:**
- Produces (CommonJS exports consumed by Tasks 2 and 3):
  - `PREFIX: string` = `"enc:v1:"`
  - `ENCRYPTED_TEXT_FIELDS: string[]`, `ENCRYPTED_JSON_FIELDS: string[]`
  - `isEncrypted(v: unknown): boolean`
  - `requireValidKey(key: unknown): void` — throws if not a 32-char string
  - `encryptRecord(record: {get(f): any; set(f, v): void}, cipherFn: (s: string) => string): void`
  - `decryptRecord(record: {get(f): any; set(f, v): void}, decipherFn: (s: string) => string): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pb/encryption-core.test.ts
import { describe, it, expect } from "vitest";
import core from "../../docker/pb_hooks/encryption-core.js";

// Reversible fake cipher (NOT real crypto — just for roundtrip assertions)
const enc = (s: string) => Buffer.from(s, "utf8").toString("base64");
const dec = (s: string) => Buffer.from(s, "base64").toString("utf8");

// Minimal stand-in for PocketBase's e.record (get/set over a backing map)
function fakeRecord(initial: Record<string, unknown>) {
  const data = { ...initial };
  return {
    get: (f: string) => data[f],
    set: (f: string, v: unknown) => { data[f] = v; },
    _data: data,
  };
}

describe("encryption-core", () => {
  it("should_detect_the_enc_v1_prefix", () => {
    expect(core.isEncrypted("enc:v1:abc")).toBe(true);
    expect(core.isEncrypted("plain")).toBe(false);
    expect(core.isEncrypted(null)).toBe(false);
  });

  it("should_fail_closed_when_encryption_key_missing_or_wrong_length", () => {
    expect(() => core.requireValidKey(undefined)).toThrow();
    expect(() => core.requireValidKey("short")).toThrow();
    expect(() => core.requireValidKey("x".repeat(32))).not.toThrow();
  });

  it("should_encrypt_text_fields_and_roundtrip", () => {
    const r = fakeRecord({ title: "Buy milk", description: "2%" });
    core.encryptRecord(r, enc);
    expect(r._data.title).toMatch(/^enc:v1:/);
    expect(r._data.description).toMatch(/^enc:v1:/);
    core.decryptRecord(r, dec);
    expect(r._data.title).toBe("Buy milk");
    expect(r._data.description).toBe("2%");
  });

  it("should_roundtrip_json_fields_tags_and_subtasks", () => {
    const r = fakeRecord({
      title: "t",
      tags: ["work", "urgent"],
      subtasks: [{ id: "s1", title: "step", completed: false }],
    });
    core.encryptRecord(r, enc);
    expect(typeof r._data.tags).toBe("string");
    expect(r._data.tags).toMatch(/^enc:v1:/);
    core.decryptRecord(r, dec);
    expect(r._data.tags).toEqual(["work", "urgent"]);
    expect(r._data.subtasks).toEqual([{ id: "s1", title: "step", completed: false }]);
  });

  it("should_be_idempotent_on_double_encrypt", () => {
    const r = fakeRecord({ title: "x", description: "", tags: [] });
    core.encryptRecord(r, enc);
    const once = { ...r._data };
    core.encryptRecord(r, enc); // second pass must not double-wrap
    expect(r._data.title).toBe(once.title);
    expect(r._data.tags).toBe(once.tags);
  });

  it("should_pass_through_legacy_plaintext_rows_on_read", () => {
    const r = fakeRecord({ title: "legacy plaintext", tags: ["a"] });
    core.decryptRecord(r, dec); // no enc:v1: prefix anywhere
    expect(r._data.title).toBe("legacy plaintext");
    expect(r._data.tags).toEqual(["a"]);
  });

  it("should_leave_empty_text_fields_unencrypted", () => {
    const r = fakeRecord({ title: "x", description: "" });
    core.encryptRecord(r, enc);
    expect(r._data.description).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- tests/pb/encryption-core.test.ts --run`
Expected: FAIL — cannot resolve `../../docker/pb_hooks/encryption-core.js` (module does not exist yet).

- [ ] **Step 3: Write the core module**

```js
// docker/pb_hooks/encryption-core.js
// Pure, dependency-injected encryption logic. NO PocketBase globals here so it
// can be unit-tested with Vitest. The PocketBase adapter injects the cipher.
"use strict";

const PREFIX = "enc:v1:";
const ENCRYPTED_TEXT_FIELDS = ["title", "description"];
const ENCRYPTED_JSON_FIELDS = ["tags", "subtasks", "time_entries"];

function isEncrypted(v) {
  return typeof v === "string" && v.indexOf(PREFIX) === 0;
}

function requireValidKey(key) {
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key (fail-closed)");
  }
}

function encryptRecord(record, cipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (v === null || v === undefined || v === "" || isEncrypted(v)) continue;
    record.set(f, PREFIX + cipherFn(String(v)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const raw = record.get(f);
    if (raw === null || raw === undefined) continue;
    const asString = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (isEncrypted(asString)) continue;
    record.set(f, PREFIX + cipherFn(asString));
  }
}

function decryptRecord(record, decipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (!isEncrypted(v)) continue;
    record.set(f, decipherFn(v.slice(PREFIX.length)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const v = record.get(f);
    if (!isEncrypted(v)) continue;
    record.set(f, JSON.parse(decipherFn(v.slice(PREFIX.length))));
  }
}

module.exports = {
  PREFIX,
  ENCRYPTED_TEXT_FIELDS,
  ENCRYPTED_JSON_FIELDS,
  isEncrypted,
  requireValidKey,
  encryptRecord,
  decryptRecord,
};
```

```ts
// docker/pb_hooks/encryption-core.d.ts
interface EncRecord { get(field: string): any; set(field: string, value: any): void; }
declare const core: {
  PREFIX: string;
  ENCRYPTED_TEXT_FIELDS: string[];
  ENCRYPTED_JSON_FIELDS: string[];
  isEncrypted(v: unknown): boolean;
  requireValidKey(key: unknown): void;
  encryptRecord(record: EncRecord, cipherFn: (s: string) => string): void;
  decryptRecord(record: EncRecord, decipherFn: (s: string) => string): void;
};
export default core;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- tests/pb/encryption-core.test.ts --run`
Expected: PASS (7 tests). If Vitest does not pick up `tests/pb/`, check the `test.include` glob in `vitest.config.ts` and add `tests/**/*.test.ts` if missing.

- [ ] **Step 5: Typecheck and commit**

Run: `bun typecheck`
Expected: no new errors.

```bash
git add docker/pb_hooks/encryption-core.js docker/pb_hooks/encryption-core.d.ts tests/pb/encryption-core.test.ts
git commit -m "feat(encryption): pure dependency-injected encryption core + unit tests"
```

---

### Task 2: PocketBase hook adapter

**Files:**
- Create: `docker/pb_hooks/tasks_encryption.pb.js`

**Interfaces:**
- Consumes: `encryption-core.js` exports `requireValidKey`, `encryptRecord`, `decryptRecord` (Task 1); PocketBase globals `onRecordCreate`, `onRecordUpdate`, `onRecordEnrich`, `$security.encrypt`, `$security.decrypt`, `$os.getenv`, `__hooks`.
- Produces: server-side encrypt-on-write / decrypt-on-read behavior for the `tasks` collection. No exports.

- [ ] **Step 1: Write the adapter**

Each handler re-acquires the core and key inside its callback (handler isolation — see Global Constraints).

```js
// docker/pb_hooks/tasks_encryption.pb.js
/// <reference path="../pb_data/types.d.ts" />
// Server-side at-rest encryption for the "tasks" collection.
// Handlers run in isolated VM contexts, so the core module and key are
// acquired INSIDE each callback (outer-scope variables are not visible).

onRecordCreate((e) => {
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.encryptRecord(e.record, (s) => $security.encrypt(s, key));
  e.next();
}, "tasks");

onRecordUpdate((e) => {
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.encryptRecord(e.record, (s) => $security.encrypt(s, key));
  e.next();
}, "tasks");

onRecordEnrich((e) => {
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.decryptRecord(e.record, (s) => $security.decrypt(s, key));
  e.next();
}, "tasks");
```

- [ ] **Step 2: Syntax-check (parses without running PocketBase globals)**

Run: `node --check docker/pb_hooks/tasks_encryption.pb.js`
Expected: no output, exit 0. (`node --check` only parses, so the undefined PB globals do not matter.)

- [ ] **Step 3: Commit**

```bash
git add docker/pb_hooks/tasks_encryption.pb.js
git commit -m "feat(encryption): PocketBase hook adapter (encrypt on write, decrypt on read)"
```

> **Behavioral verification is deferred to Task 5** (requires a running PocketBase). Two items to confirm there against the running 0.26.6 instance: (a) `$security.decrypt(cipher, key)` returns the plaintext string (docs were incomplete on its return type); (b) `onRecordEnrich` fires for realtime SSE messages as documented.

---

### Task 3: One-shot backfill migration

**Files:**
- Create: `docker/pb_migrations/1781000000_encrypt_existing_tasks.js`

**Interfaces:**
- Consumes: PocketBase migration globals `migrate`, `app.findAllRecords`, `app.save`, `$security.encrypt`, `$os.getenv`.
- Produces: existing plaintext rows become `enc:v1:` ciphertext. Idempotent.

> The migration **inlines** the encrypt logic rather than `require()`-ing `encryption-core.js`, because `__hooks` resolution is not guaranteed inside the migration VM. The inlined logic mirrors the unit-tested core; it is a one-shot, so the small duplication is acceptable.

- [ ] **Step 1: Create the migration file**

Filename uses a numeric prefix (`1781000000` ≈ 2026-06) that sorts **after** the existing collection-creating migrations, so the `tasks` collection exists when it runs. (Alternatively generate via `pocketbase migrate create encrypt_existing_tasks --migrationsDir=docker/pb_migrations` and paste the body.)

```js
// docker/pb_migrations/1781000000_encrypt_existing_tasks.js
/// <reference path="../pb_data/types.d.ts" />
// One-shot backfill: encrypt existing plaintext task rows in place.
// Idempotent — skips any value already prefixed "enc:v1:".
migrate((app) => {
  const PREFIX = "enc:v1:";
  const TEXT = ["title", "description"];
  const JSONF = ["tags", "subtasks", "time_entries"];
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key");
  }
  const isEnc = (v) => typeof v === "string" && v.indexOf(PREFIX) === 0;
  const records = app.findAllRecords("tasks");
  for (const r of records) {
    for (const f of TEXT) {
      const v = r.get(f);
      if (v === null || v === undefined || v === "" || isEnc(v)) continue;
      r.set(f, PREFIX + $security.encrypt(String(v), key));
    }
    for (const f of JSONF) {
      const raw = r.get(f);
      if (raw === null || raw === undefined) continue;
      const s = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (isEnc(s)) continue;
      r.set(f, PREFIX + $security.encrypt(s, key));
    }
    app.save(r);
  }
}, (app) => {
  // Down migration intentionally a no-op: reversing requires the key and is not
  // part of rollback. Restore from backup if reversal is ever needed.
});
```

- [ ] **Step 2: Syntax-check**

Run: `node --check docker/pb_migrations/1781000000_encrypt_existing_tasks.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add docker/pb_migrations/1781000000_encrypt_existing_tasks.js
git commit -m "feat(encryption): one-shot backfill migration for existing task rows"
```

> Verify in Task 5: exact API names `app.findAllRecords("tasks")` and `app.save(r)` against PocketBase 0.26.6 (a wrong name fails loudly at startup). `app.save` re-triggers `onRecordUpdate` (idempotent — safe) and bumps the `updated` autodate, causing a harmless one-time re-pull on all synced devices.

---

### Task 4: Docker deployment wiring

**Files:**
- Modify: `docker/Dockerfile` (runtime stage)
- Modify: `docker/docker-entrypoint.sh`
- Modify: `docker/docker-compose.yml`
- Modify: `docker/docker-setup-and-run.md`

**Interfaces:**
- Consumes: hook/migration files from Tasks 2–3.
- Produces: the running container loads the hook from `/pb_hooks`, runs the migration from `/pb_migrations`, and refuses to start without `GSD_TASKS_ENC_KEY`.

- [ ] **Step 1: Bake hooks + migrations into the image (outside the volume)**

In `docker/Dockerfile`, in the **runtime stage** (where the `pocketbase` binary is installed), add:

```dockerfile
# Encryption hook + backfill migration, baked into the image OUTSIDE the
# /pb_data volume so an existing named volume cannot shadow them.
COPY docker/pb_hooks/      /pb_hooks/
COPY docker/pb_migrations/ /pb_migrations/
```

- [ ] **Step 2: Point PocketBase at those dirs and fail closed at boot**

In `docker/docker-entrypoint.sh`, add a key guard right after `set -e`:

```sh
# Refuse to start without a valid encryption key (fail closed at boot, not just
# at first write).
if [ -z "$GSD_TASKS_ENC_KEY" ] || [ "${#GSD_TASKS_ENC_KEY}" -ne 32 ]; then
    echo "[gsd] FATAL: GSD_TASKS_ENC_KEY must be set to a 32-character key" >&2
    exit 1
fi
```

Then change the `pocketbase serve` invocation from:

```sh
/usr/local/bin/pocketbase serve \
    --http=0.0.0.0:8090 \
    --dir=/pb_data \
    --publicDir=/pb_data/pb_public &
```

to:

```sh
/usr/local/bin/pocketbase serve \
    --http=0.0.0.0:8090 \
    --dir=/pb_data \
    --hooksDir=/pb_hooks \
    --migrationsDir=/pb_migrations \
    --publicDir=/pb_data/pb_public &
```

- [ ] **Step 3: Add the key env to compose (required, not committed)**

In `docker/docker-compose.yml`, under `services.gsd.environment:`, add:

```yaml
      # 32-char AES-256 key for at-rest task encryption. Provide via a gitignored
      # .env file or your secret manager — NEVER commit it. `:?` fails the up if unset.
      - GSD_TASKS_ENC_KEY=${GSD_TASKS_ENC_KEY:?set a 32-char key in .env or the environment}
```

- [ ] **Step 4: Document key generation, backup, and recovery**

In `docker/docker-setup-and-run.md`, add a short "Task encryption key" section:

```markdown
## Task encryption key (required)

Task content is encrypted at rest on the server. Generate a 32-character key once:

    openssl rand -hex 16        # 32 hex chars

Put it in a gitignored `.env` beside the compose file (`GSD_TASKS_ENC_KEY=...`) or
your secret manager. **Back it up separately from the database** — a database
backup is useless without this key, and a lost key makes encrypted data
unrecoverable. The container refuses to start if the key is missing or not 32 chars.
```

- [ ] **Step 5: Confirm the image builds**

Run: `docker compose -f docker/docker-compose.yml build`
Expected: build succeeds; the `COPY docker/pb_hooks/ /pb_hooks/` step resolves (fails if the paths are wrong).

- [ ] **Step 6: Commit**

```bash
git add docker/Dockerfile docker/docker-entrypoint.sh docker/docker-compose.yml docker/docker-setup-and-run.md
git commit -m "feat(encryption): wire hooks dir, migrations dir, and fail-closed key into Docker"
```

---

### Task 5: Integration verification harness

**Files:**
- Create: `scripts/verify-pb-encryption.sh`

**Interfaces:**
- Consumes: a local `pocketbase` binary (path via `$PB_BIN`, default `./pocketbase`), the hook/migration dirs, and `scripts/setup-pocketbase-collections.sh` for the `tasks` schema.
- Produces: a pass/fail end-to-end proof that content is ciphertext at rest and plaintext over the API.

> This runs against a **local/staging PocketBase**, not CI (CI has no PB binary). It is the real proof of Acceptance Criteria 1–3 and 5.

- [ ] **Step 1: Write the harness**

```bash
#!/usr/bin/env bash
# Verify server-side at-rest encryption end-to-end against a local PocketBase.
# Requires: a pocketbase binary ($PB_BIN, default ./pocketbase), sqlite3, curl, jq.
set -euo pipefail

PB_BIN="${PB_BIN:-./pocketbase}"
KEY="$(openssl rand -hex 16)"            # 32 hex chars
WORK="$(mktemp -d)"
ADMIN_EMAIL="verify@example.com"; ADMIN_PASS="verify-pass-1234"
trap 'kill "${PB_PID:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "1) start PocketBase with the encryption hook"
GSD_TASKS_ENC_KEY="$KEY" "$PB_BIN" serve \
  --dir="$WORK" --hooksDir=docker/pb_hooks --migrationsDir=docker/pb_migrations \
  --http=127.0.0.1:8099 >"$WORK/pb.log" 2>&1 &
PB_PID=$!
for i in $(seq 1 30); do curl -sf http://127.0.0.1:8099/api/health >/dev/null && break; sleep 1; done

echo "2) create superuser + tasks collection"
"$PB_BIN" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASS" --dir="$WORK" >/dev/null
PB_URL=http://127.0.0.1:8099 bash scripts/setup-pocketbase-collections.sh \
  "$ADMIN_EMAIL" "$ADMIN_PASS" >/dev/null   # adjust args to match the script

echo "3) authenticate and create a task via the API"
TOKEN=$(curl -sf -X POST http://127.0.0.1:8099/api/collections/_superusers/auth-with-password \
  -H 'content-type: application/json' \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | jq -r .token)
REC=$(curl -sf -X POST http://127.0.0.1:8099/api/collections/tasks/records \
  -H "Authorization: $TOKEN" -H 'content-type: application/json' \
  -d '{"task_id":"t1","owner":"verify","title":"Buy milk","description":"2%","tags":["home"],"subtasks":[]}')
ID=$(echo "$REC" | jq -r .id)

echo "4) ASSERT ciphertext at rest in SQLite"
RAW=$(sqlite3 "$WORK/data.db" "select title from tasks where id='$ID';")
case "$RAW" in
  enc:v1:*) echo "   OK at-rest: $RAW" ;;
  *) echo "   FAIL: title stored as plaintext: $RAW" >&2; exit 1 ;;
esac

echo "5) ASSERT plaintext over the REST API"
VIEW=$(curl -sf -H "Authorization: $TOKEN" "http://127.0.0.1:8099/api/collections/tasks/records/$ID" | jq -r .title)
[ "$VIEW" = "Buy milk" ] && echo "   OK over-API: $VIEW" || { echo "   FAIL: API returned: $VIEW" >&2; exit 1; }

echo "ALL CHECKS PASSED"
```

- [ ] **Step 2: Make it executable and dry-review**

Run: `chmod +x scripts/verify-pb-encryption.sh && bash -n scripts/verify-pb-encryption.sh`
Expected: no syntax errors. (Adjust the `setup-pocketbase-collections.sh` invocation to that script's real argument convention.)

- [ ] **Step 3: Run against a local PocketBase**

Run: `PB_BIN=/path/to/pocketbase ./scripts/verify-pb-encryption.sh`
Expected: ends with `ALL CHECKS PASSED`. Confirms Acceptance Criteria 1, 2, 5. For Criterion 3 (realtime), additionally subscribe (`curl -N .../api/realtime`) and confirm the pushed record's `title` is plaintext.

- [ ] **Step 4: Smoke-test the real app + MCP (Criterion 4)**

Point a local app build and the MCP server at this PocketBase; confirm tasks read/write normally (plaintext UX unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-pb-encryption.sh
git commit -m "test(encryption): end-to-end at-rest verification harness"
```

---

### Task 6: Correct the about-page claim copy

**Files:**
- Modify: `components/about/features-section.tsx:83-84`
- Modify: `components/about/mcp-section.tsx:14-17`
- Modify: `components/about/privacy-section.tsx:29-31` (gated — see Step 4)
- Test: `tests/ui/about-copy.test.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks (independent cosmetic change).
- Produces: the about page no longer asserts zero-knowledge / E2E.

- [ ] **Step 1: Write the failing regression test**

```tsx
// tests/ui/about-copy.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FeaturesSection } from "@/components/about/features-section";
import { McpSection } from "@/components/about/mcp-section";

describe("about-page privacy copy", () => {
  it("should_not_claim_zero_knowledge_or_e2e", () => {
    const { container } = render(<FeaturesSection />);
    expect(container.textContent).not.toMatch(/zero-knowledge/i);
    expect(container.textContent).not.toMatch(/end-to-end/i);
  });

  it("should_not_reference_stale_encryption_passphrase", () => {
    const { container } = render(<McpSection />);
    expect(container.textContent).not.toMatch(/ENCRYPTION_PASSPHRASE/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/ui/about-copy.test.tsx --run`
Expected: FAIL — current copy still contains "Zero-knowledge" / "End-to-end" / "ENCRYPTION_PASSPHRASE".

- [ ] **Step 3: Fix the false claims**

In `components/about/features-section.tsx`, replace:

```tsx
    description:
      "End-to-end encrypted sync across devices. Zero-knowledge: the server never sees your data.",
```

with:

```tsx
    description:
      "Optional sync to a server you control — protected in transit by TLS and owner-scoped access.",
```

In `components/about/mcp-section.tsx`, replace:

```tsx
      "env": {
        "GSD_SYNC_URL": "https://gsd.vinny.dev/api",
        "ENCRYPTION_PASSPHRASE": "your-passphrase"
      }
```

with:

```tsx
      "env": {
        "GSD_SYNC_URL": "https://gsd.vinny.dev/api"
      }
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `bun run test -- tests/ui/about-copy.test.tsx --run`
Expected: PASS.

```bash
git add components/about/features-section.tsx components/about/mcp-section.tsx tests/ui/about-copy.test.tsx
git commit -m "fix(about): remove false zero-knowledge/E2E claim and stale passphrase"
```

- [ ] **Step 5 (gated — apply only AFTER the backend hook is live in production):** strengthen `components/about/privacy-section.tsx` to advertise at-rest encryption. Replace:

```tsx
                stores your tasks securely — encrypted in transit and protected
                by authentication and owner-scoped access controls.
```

with:

```tsx
                stores your tasks encrypted at rest and in transit, protected
                by authentication and owner-scoped access controls.
```

> Do not commit Step 5 until at-rest encryption is confirmed running on `api.vinny.io` — otherwise the web app (deployed independently as a static export) would assert at-rest encryption before it is true.

---

## Plan Self-Review

**Spec coverage:** every spec section maps to a task — §1 fields → Task 1 core + Task 3 backfill; §2 hooks → Task 2; §3 marker → Task 1 (`isEncrypted`/idempotency tests); §4 crypto → Task 2 (`$security`); §5 key mgmt → Tasks 2 (fail-closed in hook), 4 (boot guard + docs); §6 deployment → Task 4; §7 backfill → Task 3; §8 transparency → verified in Task 5 Step 4; §9 copy → Task 6. Acceptance Criteria 1–3,5 → Task 5; 4 → Task 5 Step 4; 6 → Task 1 idempotency + Task 3; 7 → Task 1 legacy-passthrough test; 8 → Task 6.

**Placeholder scan:** no TBD/TODO. The "confirm against running 0.26.6" notes (`$security.decrypt` return, `findAllRecords`/`save` names, realtime enrich) are genuine external-API checks with concrete best-guess code provided and a verification step that fails loudly — not placeholders.

**Type consistency:** core exports (`isEncrypted`, `requireValidKey`, `encryptRecord`, `decryptRecord`, `PREFIX`, field arrays) are used with identical names/signatures in Task 2; the migration deliberately inlines equivalent logic (documented) rather than importing, so no cross-name drift.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-20-server-side-encryption.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**

> Note: Tasks 1 and 6 run and verify fully in this repo (Vitest). Tasks 2–5 produce the PocketBase artifacts but their *behavioral* verification (Task 5) needs a local/staging PocketBase binary — flag whether that's available, or whether Tasks 2–5 should be implemented-and-committed here for you to verify against staging yourself.
