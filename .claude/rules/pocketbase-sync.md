---
name: pocketbase-sync
description: PocketBase v0.23+ gotchas and sync architecture rules. Loads when working in lib/sync/, the setup script, or schema files.
paths:
  - lib/sync/**
  - lib/schema.ts
  - scripts/setup-pocketbase-collections.sh
---

## PocketBase v0.23+ Gotchas

- **`created` / `updated` are optional autodate fields**, not system fields, in PB ≥0.23. The live `tasks` collection HAS them (added + backfilled 2026-06-10 via the iOS repo's `scripts/pb-add-autodate-fields.sh`), so `sort`/`filter` on `updated` works. A fresh instance created by an old setup script lacks them — pulls filtering on `updated` then 400.
- **Date literals in filters use PB's space form** (`updated >= "2026-06-10 18:55:13.123Z"`), and PB returns autodate values in that form too — normalize to ISO (`T`) before `new Date()` (Safari/Firefox don't reliably parse the space form).
- **Relation fields**: the `_pb_users_auth_` placeholder doesn't work as a `collectionId`. Use `text` type for owner FK, or look up the real collection ID.
- **Admin auth endpoint**: `/api/collections/_superusers/auth-with-password` (not the legacy `/api/admins/auth-with-password`).
- **Rate limiting**: throttle push ops to ~100ms between requests; batch-fetch remote IDs to avoid 429s.
- **Collection setup**: `scripts/setup-pocketbase-collections.sh` creates the `tasks` collection with correct schema, indexes, and API rules.

## Sync Architecture

- **Protocol**: last-write-wins (LWW) using `client_updated_at`; remote wins if newer.
- **Two-timestamp pattern**: `client_updated_at` (client-stamped text field) is the LWW conflict-resolution authority; the server-stamped autodate `updated` is the pull-cursor authority (`PBSyncConfig.lastServerUpdatedAt`, 30s overlap). Never swap them: a server-side re-save bumps `updated` without the content being newer, and a skewed client clock can stamp `client_updated_at` behind every device's cursor. The legacy client-stamped `lastSyncAt` cursor is migrated once with a 24h rewind and otherwise left untouched.
- **Realtime**: PocketBase SSE auto-reconnects; periodic sync runs as safety net.
- **Echo filtering**: skip own-device changes via `device_id` comparison.
- **Auth**: PocketBase SDK auto-stores tokens in localStorage and auto-refreshes.

## Key Locations

- `lib/sync/pocketbase-client.ts` — SDK singleton wrapper
- `lib/sync/pb-sync-engine.ts` — push/pull engine with LWW resolution
- `lib/sync/pb-realtime.ts` — SSE subscription manager
- `lib/sync/pb-auth.ts` — OAuth login/logout
- `lib/sync/task-mapper.ts` — camelCase ↔ snake_case mapping

## OAuth (PocketBase-delegated)

- OAuth popup flow is delegated to the PocketBase SDK via `authWithOAuth2`; tokens live in the SDK's `authStore` (localStorage).
- **Google**: configured in PB admin.
- **GitHub**: requires server-side provider setup in PocketBase admin (`https://api.vinny.io/_/` → Settings → Auth providers).
- **Local dev**: set `NEXT_PUBLIC_POCKETBASE_URL=https://api.vinny.io` in `.env.local` to test OAuth against production PB. A local PB at `127.0.0.1:8090` would need its own OAuth provider setup.

## OAuth Callback Domain Mismatch (recurring bug)

If users hit `redirect_uri_mismatch` after a deploy:
1. Check the `redirect_uri` registered in the provider (Google Cloud Console / GitHub OAuth App).
2. Confirm it matches the exact PocketBase origin used for auth — including trailing slash and `www` vs apex.
3. The PocketBase JS SDK popup flow redirects to `<pocketbase-origin>/api/oauth2-redirect`. The static app does not own an `/api/auth/oauth-callback` route.
4. Production CloudFront rewrites must pass `/api/*` and `/_/*` through unchanged so OAuth callback/admin paths are never turned into static `index.html` lookups.
