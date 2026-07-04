# Cloud Sync & Offline

Cloud sync is **optional**. The app works fully offline/local-only; sync activates only when
a PocketBase backend is reachable. The engine lives in `/lib/sync/` and is offline-first with
**last-write-wins (LWW)** conflict resolution. This page also covers the PWA service worker
cache strategy.

Related rules/ADRs: `/.claude/rules/pocketbase-sync.md`, `/.claude/rules/sw-cache.md`,
`docs/adr/0002`, `0003`, `0004`, `0012`.

---

## Orchestration flow

```
sync-provider.tsx  →  background-sync.ts  →  sync-coordinator.ts
        →  pb-sync-engine.ts (fullSync)  →  pb-push.ts  +  pb-pull.ts
```

`fullSync(triggeredBy)` in `/lib/sync/pb-sync-engine.ts` runs sequentially:
**auth → push → pull**. It refreshes JWT silently (`ensureValidAuth`), drains the offline
queue, then pulls remote changes from the server cursor.

---

## Push (`/lib/sync/pb-push.ts`)

- `pushLocalChanges()` drains the offline queue (`syncQueue`), requires an authenticated
  owner, and pre-fetches a remote task index once for LWW lookups.
- `pushSingleItem()` handles create/update/delete. Create/update call `upsertRemoteTask()`
  (`.update()` if a `pbRecordId` exists, else `.create()`).
- **LWW guard:** if the remote record's `client_updated_at` is strictly newer than the queued
  op's `updatedAt`, the op is stale → dequeued and skipped (the next pull restores
  correctness).
- **Safety:** if the remote index fetch failed and there is no known remote entry, it refuses
  to push (avoids clobbering newer remote data).
- **Throttling / 429:** sequential loop with a small delay between items; on HTTP 429 it aborts
  early and respects `Retry-After`. Errors are sanitized (`sanitizeSyncError`) because
  PocketBase 4xx bodies can echo task titles.

---

## Pull (`/lib/sync/pb-pull.ts`)

- `pullRemoteChanges(lastServerUpdatedAt)` fetches tasks filtered by `owner` and, when a
  cursor exists, `updated >= <cursor>`.
- **Cursor design:** the pull cursor is the **server-stamped `updated`** timestamp (not the
  client timestamp). Filter values are escaped/validated to prevent injection.
- `applyRemoteRecords()` validates each record and applies LWW: add if new locally; overwrite
  only if `remoteTask.updatedAt > localTask.updatedAt`.
- The cursor advances to the max server `updated`, minus a small overlap window
  (`CURSOR_OVERLAP_MS`) to re-catch boundary records next time.
- `reconcileDeletedTasks()` deletes local tasks that are absent remotely — but preserves any
  task with a pending queued op, and skips entirely if the remote index fetch failed.

---

## Conflict resolution (LWW)

- **Authority is `client_updated_at`** (client-stamped). Remote wins **iff strictly newer**.
- The comparison fails safe (never skips a write on malformed/NaN timestamps).
- The server-stamped `updated` field is used **only** as the pull cursor, never for conflict
  resolution. See `docs/adr/0003-last-write-wins-conflict-resolution.md`.

---

## Realtime (`/lib/sync/pb-realtime.ts`)

- Subscribes to `tasks` changes over SSE; the PocketBase SDK auto-reconnects.
- Inbound events are Zod-validated and **echo-filtered** (skips events from the current
  device) and filtered to the current owner.
- Changes apply via `applyRemoteChange()` using LWW; deletes are skipped when a local queued
  op is pending ("edit beats delete").

---

## Health, retry & queue

- **Health monitor** (`/lib/sync/health-monitor.ts`): periodic checks (~5 min) reporting
  `stale_queue`, `failed_items`, `token_expired`, and `server_unreachable`.
- **Retry manager** (`/lib/sync/retry-manager.ts`): exponential backoff schedule
  (`[5s, 10s, 30s, 60s, 300s]`, max 5 retries). A server `Retry-After` overrides the schedule
  but is clamped so a hostile header can't freeze sync.
- **Offline queue** (`/lib/sync/queue.ts`): persists ops to the `syncQueue` table. On
  exhausting retries an item transitions to `status:'failed'` (kept for diagnosis, not
  auto-retried).
- **Coordinator** (`/lib/sync/sync-coordinator.ts`): single-flight guard so two `fullSync`
  runs never overlap; user-triggered syncs bypass backoff, auto-syncs honor it.
- **Background triggers** (`/lib/sync/background-sync.ts`): initial delay, periodic interval,
  debounced-after-change, `visibilitychange`, and `online`. Skips when offline/hidden and
  enforces a minimum interval.
- **Sync history** (`/lib/sync-history.ts`): records success/error/partial/conflict outcomes
  to `syncHistory` (capped at 100 records).

---

## PWA service worker cache (`/lib/sw-cache-logic.ts`)

The canonical cache logic is TypeScript, mirrored into `public/sw-cache-logic.js` and loaded
by `public/sw.js`. Three purpose-specific caches:

| Cache | Contents | Strategy | Lifecycle |
| --- | --- | --- | --- |
| `gsd-immutable-v{n}` | content-hashed `/_next/static/*` | cache-first | FIFO-pruned, survives deploys |
| `gsd-pages-v{n}` | HTML + RSC flight data | network-first | rotated on deploy |
| `gsd-runtime-v{n}` | manifest, favicon, icons | cache-first | rotated on deploy |

- `classifyRequest()` routes requests: non-GET/cross-origin → passthrough; anything with an
  `Authorization` header, `no-store`, `/api/*`, or `/_/*` → **passthrough** (never cached —
  protects PocketBase auth/admin); `/_next/static/*` → immutable; HTML → pages; other runtime
  assets → runtime.
- When cache logic changes, **bump the version constant** in `public/sw.js`
  (`/scripts/update-sw-version.cjs` also touches SW version at build). See
  `docs/adr/0012-sw-multi-cache-strategy.md`.

---

## Where to start when changing sync

- **New syncable field:** ensure the PocketBase field mapping (in `/lib/sync/`
  helpers/mappers) round-trips it, and that it participates correctly in LWW.
- **Conflict/ordering changes:** be careful — LWW authority is `client_updated_at`, and the
  cursor uses server `updated`. Don't conflate them.
- **Server-side setup:** PocketBase collection schema and API rules are defined during
  self-hosting setup — see [Build, deploy & ops](../operations/build-deploy-and-ops.md).

**Relevant tests:** `/tests/sync/` (engine/coordinator/health/retry), `/tests/data/sync/`,
and PocketBase encryption tests in `/tests/pb/`. Sync tests mock the SDK via
`vi.mock('pocketbase')`.
