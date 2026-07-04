# MCP Server (`gsd-mcp-server`)

`/packages/mcp-server/` is a **standalone npm package** that exposes GSD task management to
Claude Desktop and other Model Context Protocol (MCP) clients. It is optional and independent
of the web app — it talks directly to a self-hosted **PocketBase** backend over HTTPS.

Related: `/.claude/rules/mcp-server.md`, `docs/adr/0005-mcp-server-integration.md`,
`/packages/mcp-server/README.md`.

---

## What it is

- Package name `gsd-mcp-server`. Node 18+, TypeScript, **stdio transport** (JSON-RPC 2.0).
- Entry: `src/index.ts` → `src/server/setup.ts` (`createServer` / `registerHandlers`).
- CLI (`src/cli.ts`) modes: `--setup`, `--validate`, `--help`, or default MCP mode.
- It is a **separate workspace** and a **separate test suite** — Vitest at the repo root
  excludes it (its tests live in `packages/mcp-server/src/__tests__/`).

---

## Tool catalog (20 tools)

Schemas in `src/tools/schemas/`, dispatched in `src/tools/handlers/`
(args are Zod-validated via `validateToolArgs`):

- **Read (7)** — `list_tasks`, `get_task`, `search_tasks`, `get_sync_status`,
  `list_devices`, `get_task_stats`, `get_token_status`.
- **Analytics (5)** — `get_productivity_metrics`, `get_quadrant_analysis`,
  `get_tag_analytics`, `get_upcoming_deadlines`, `get_task_insights`.
- **Write (5)** — `create_task`, `update_task`, `complete_task`, `delete_task`,
  `bulk_update_tasks` (all support `dryRun`).
- **System (3)** — `validate_config`, `get_help`, `get_cache_stats`.

It also exposes built-in **prompts** (`src/tools/prompts.ts`) such as daily standup / weekly
review / focus mode.

---

## Write operations & dry-run (`src/write-ops/`)

- `task-operations.ts` (`createTask`/`updateTask`/`completeTask`/`deleteTask`) and
  `bulk-operations.ts` (up to 50 tasks). All return `{ dryRun, validation, ... }`.
- **Dry-run:** when `input.dryRun` is true, the fully computed result is returned **without**
  writing to PocketBase; handlers render a `🔍 DRY RUN` preview. This lets an agent preview a
  change before applying it.
- **LWW conflict detection on update:** `updateTask()` reads the record fresh from PocketBase
  (bypassing cache), captures `client_updated_at`, and re-checks it immediately before the
  write — throwing `ConflictError` on mismatch to avoid clobbering a concurrent writer.
- **Dependency safety:** BFS circular-dependency detection mirrors the app
  (`src/dependencies.ts`).
- Actual PocketBase writes (`write-ops/helpers.ts`) look up records by `task_id` with escaped
  filters and **invalidate the cache after every successful write**.

---

## Caching (`src/cache.ts`)

- A generic `TTLCache` + `TaskCacheManager` (task-list and single-task caches). Default TTL
  **30s**, max ~1000 entries, FIFO eviction. Hit/miss stats surface via `get_cache_stats`.
- Reads populate the cache; writes invalidate it.

---

## Auth & networking

- **Config** (`src/server/config.ts`): env vars `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN`,
  Zod-validated. URLs must be **HTTPS-only** (loopback `localhost`/`127.0.0.1`/`[::1]`
  excepted), with exact-hostname parsing to reject look-alike bypasses.
- **Requests** (`src/api/client.ts`): `Authorization: Bearer <token>`; on network failure the
  PocketBase host is **redacted** from logs to avoid leaking private endpoints.
- **Retry** (`src/api/retry.ts`): `fetchWithRetry()` — exponential backoff with jitter,
  retryable on 500/502/503/504/429 and network errors.
- **Token health** (`src/auth/token-status.ts`): decodes the JWT `exp` (no signature check —
  the server enforces validity) → `healthy` / `warning` / `critical` / `expired` / `invalid`
  with re-auth instructions. Powers `get_token_status`.
- Optional Sentry is **off by default** (opt-in via `GSD_SENTRY_DSN`).

---

## Where to start when changing the MCP server

- **New tool:** add a schema in `src/tools/schemas/`, a handler in `src/tools/handlers/`, and
  (for writes) an operation in `src/write-ops/` with `dryRun` support. Add tests under
  `packages/mcp-server/src/__tests__/`.
- **Behavior must match the app's domain rules** (quadrant derivation, dependency cycles,
  LWW) — keep parity with `/lib`.
- **Publishing** is handled by `/.github/workflows/publish-mcp-server.yml`.

> Note: the package's `README.md` version markers lag the shipped `package.json` version.
> Trust `packages/mcp-server/package.json` and the code for current capabilities.
