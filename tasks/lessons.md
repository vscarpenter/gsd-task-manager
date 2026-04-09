# Lessons Learned

Project-specific learnings, gotchas, and patterns. Review at the start of every session.

---

## PocketBase v0.23+ Gotchas

- System fields (`created`, `updated`) **cannot** be used in `sort` or `filter` — use custom fields like `client_updated_at` instead.
- Custom indexes cannot reference system columns (`updated`, `created`).
- The `_pb_users_auth_` placeholder doesn't work as a `collectionId` for relation fields — use `text` type for owner FK or look up the real collection ID.
- Admin auth endpoint is `/api/collections/_superusers/auth-with-password` (not `/api/admins/auth-with-password`).

## Import/Export Schema

- Import schema uses `.strip()` (not `.strict()`) to accept legacy exports with extra fields (e.g., `vectorClock` from the old Cloudflare sync system).
- Export schema still uses `.strict()` to ensure clean outgoing data.

## Sync Engine

- Push operations are throttled (100ms between requests) to avoid PocketBase 429 errors.
- `fetchRemoteTaskIndex()` pre-fetches all remote task IDs in one request instead of N individual lookups.
- SSE subscriptions auto-reconnect; periodic sync runs as safety net.
- Echo filtering skips own-device changes via `device_id` comparison.

## Testing

- Use `bun run test` (not `bun test`) — the latter invokes bun's built-in runner, not Vitest.
- Mock IndexedDB with `fake-indexeddb` for data layer tests.
- The sync module (`lib/sync/`) has no tests yet — critical gap for multi-device features.

## Build & Deploy

- Static export mode means no API routes or SSR.
- CloudFront Function needed for SPA routing (S3 doesn't auto-serve `index.html` for directory paths).
- Run `deploy-cloudfront-function.sh` after adding new App Router routes.

## Coding Standards Compliance (April 2026 audit)

- Removed unused `dompurify` / `@types/dompurify` — React handles XSS natively.
- Pinned `canvas-confetti` from `^1.9.4` to exact `1.9.4`.
- Migrated `.parse()` to `.safeParse()` in user-input paths (import, create).
- Refactored `clearIndexedDB()` and `checkAndNotify()` for function length compliance.
