---
name: pb-collection
description: Add or modify a field on the PocketBase tasks collection end-to-end — schema script, task-mapper, Zod schema, Dexie version bump, migration test. Use when the user wants to add/remove/rename a synced task field. Codifies the PocketBase v0.23+ gotchas and recurring step-order mistakes.
disable-model-invocation: true
---

# pb-collection — End-to-end PocketBase tasks-collection field change

This skill walks through every place a field touches when added to the synced `tasks` collection. Skipping any step has bitten us before — the order matters.

## When to invoke

User says any of:
- "Add a `<field>` to tasks"
- "Sync `<field>` across devices"
- "PocketBase needs `<field>`"
- "Update the tasks schema"

Do NOT invoke for local-only Dexie fields (those don't need the PB layers).

## Prerequisites — verify before touching code

1. Read `CLAUDE.md` → "PocketBase v0.23+ Gotchas" section. The gotchas below are condensed but the source of truth is there.
2. Confirm the user has the PocketBase admin password handy (needed to run `scripts/setup-pocketbase-collections.sh`).
3. Confirm the field is not a system field name (`id`, `created`, `updated`, `collectionId`, `collectionName`).
4. Confirm field type is supported by both Dexie and PocketBase: `text`, `number`, `bool`, `json`, `date`. Never use `relation` to `_pb_users_auth_` (placeholder doesn't resolve at runtime).

## Step order (do not reorder)

### 1. Update Zod schema — `lib/schema.ts`
- Add the field to the `taskSchema` (and `taskInputSchema` if user-settable).
- Use `.safeParse()` callers; if this is a user-input path, the schema must already be wired to a safeParse boundary.
- For optional fields, default to a sensible value (`.optional().default(...)`) so legacy tasks parse without error.
- Update both `exportSchema` (`.strict()`) and `importSchema` (`.strip()`).

### 2. Update task-mapper — `lib/sync/task-mapper.ts`
- Add the camelCase ↔ snake_case mapping. PocketBase uses snake_case; the app uses camelCase.
- Both directions: `mapToRemote()` and `mapFromRemote()`.
- Test the mapper round-trip in `tests/data/task-mapper.test.ts`.

### 3. Update PocketBase collection — `scripts/setup-pocketbase-collections.sh`
- Add the field to the `tasks` collection definition in the script.
- If the field needs to be sortable/filterable, add a custom index — but the index must reference the new field, NEVER `created` or `updated`.
- Run the script against `https://api.vinny.io` (requires `_superusers` admin auth — endpoint is `/api/collections/_superusers/auth-with-password`, not `/api/admins/`).
- Verify the field appears in PB admin UI before continuing.

### 4. Bump Dexie version — `lib/db.ts`
- Increment the version (current is v13).
- Add the field to the relevant table schema.
- If the field is indexed locally, add it to the index list.
- Write a migration block if existing rows need backfill (use `upgrade()` callback).

### 5. Update CRUD — `lib/tasks.ts` and `lib/tasks/crud/`
- If the field is settable on create/update, expose it on the input type.
- Default it where appropriate.

### 6. Update sync engine — `lib/sync/pb-sync-engine.ts`
- Verify push-side serializes the new field via `task-mapper`.
- Verify pull-side deserializes it.
- If the field affects LWW conflict resolution, document why in a code comment.

### 7. Update MCP server — `packages/mcp-server/src/tools/`
- Add the field to schemas in `tools/schemas/` if exposed through MCP tools.
- Update handlers in `tools/handlers/` to read/write it.
- Run `npm run build` in `packages/mcp-server/`.

### 8. Tests — REQUIRED before claiming done
Write or update:
- `tests/data/schema.test.ts` — Zod parse/safeParse with and without the new field.
- `tests/data/task-mapper.test.ts` — round-trip mapping.
- `tests/data/db-migration.test.ts` — Dexie version upgrade preserves existing data.
- `tests/data/sync-engine.test.ts` — push/pull serializes the field correctly.
- `tests/data/import-export.test.ts` — import (lenient `.strip()`) accepts old exports without the field; export (strict `.strict()`) emits it.

Run `bun run test -- --coverage` and confirm changed-file coverage ≥80%.

### 9. Verification gate — before declaring done
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
- [ ] `bun run test` passes
- [ ] Created a task with the new field locally, synced to PocketBase, verified field present in PB admin
- [ ] Logged out + back in on a second device (or cleared local data and re-pulled), verified field round-trips
- [ ] Exported tasks → imported them back → field preserved
- [ ] If the field is user-input, verified `safeParse` rejects bad input with a useful error toast (sonner, not `alert()`)

### 10. Commit
Conventional commit format: `feat(sync): add <field> to tasks collection` or `feat(schema): ...`. Bump `package.json` patch or minor depending on user impact.

## Gotchas (condensed — full list in CLAUDE.md)

- **Sort/filter restriction** — Do not reference `created` or `updated` in PB sort/filter strings. Use `client_updated_at`.
- **Admin endpoint** — `/api/collections/_superusers/auth-with-password`, not `/api/admins/...`.
- **Relation placeholder** — `_pb_users_auth_` doesn't resolve. Use `text` for owner FK.
- **Custom indexes** — Cannot reference system columns. Index on the new custom field only.
- **Rate limiting** — Push throttled to 100ms between requests; if your change increases write volume, verify no 429s in PB logs.
- **Test runner** — Use `bun run test`, NOT `bun test` (the latter invokes bun's built-in runner, not vitest).
- **localStorage in tests** — `localStorage.clear()` doesn't work in jsdom under bun; use `localStorage.removeItem(key)`.

## Anti-goals

This skill does NOT:
- Set up a brand-new PB collection (that's a one-time `scripts/setup-pocketbase-collections.sh` run).
- Migrate from a different sync backend.
- Handle local-only Dexie fields (skip steps 2, 3, 6, 7 — but the schema and Dexie steps still apply).
