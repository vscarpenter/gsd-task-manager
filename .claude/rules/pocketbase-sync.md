---
name: pocketbase-sync
description: PocketBase v0.23+ gotchas and sync architecture rules. Loads when working in lib/sync/, the setup script, or schema files.
paths:
  - lib/sync/**
  - lib/schema.ts
  - scripts/setup-pocketbase-collections.sh
---

## PocketBase v0.23+ Gotchas

- **Never use `created` / `updated` in PocketBase sort, filter, or index expressions.** Keep sync queries on the custom `client_updated_at` field so current and freshly provisioned PB 0.23+ collections share one contract.
- **Cursor literals are ISO strings** (`client_updated_at >= "2026-06-10T18:55:13.123Z"`) because `client_updated_at` is the app-owned text timestamp.
- **Relation fields**: the `_pb_users_auth_` placeholder doesn't work as a `collectionId`. Use `text` type for owner FK, or look up the real collection ID.
- **Admin auth endpoint**: `/api/collections/_superusers/auth-with-password` (not the legacy `/api/admins/auth-with-password`).
- **Rate limiting**: throttle push ops to ~100ms between requests; batch-fetch remote IDs to avoid 429s.
- **Collection setup**: `scripts/setup-pocketbase-collections.sh` creates the `tasks` collection with correct schema, indexes, and API rules.

## Sync Architecture

- **Protocol**: last-write-wins (LWW) using `client_updated_at`; remote wins if newer.
- **Cursor contract**: `client_updated_at` is both the LWW authority and pull query field. Advance `lastClientUpdatedAt` only from records actually committed locally, clamp future values to now + 5 minutes, subtract a 30-second overlap, and query the next pull with `>=`. `pullCursorVersion: 2` proves the cursor's domain; an unversioned `lastServerUpdatedAt` forces a full pull and is cleared.
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
