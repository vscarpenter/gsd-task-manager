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
- **Cursor contract**: `client_updated_at` is both the LWW authority and pull query field. Advance `lastClientUpdatedAt` only from records actually committed locally, clamp future values to now, subtract a 30-second overlap, and query the next pull with `>=`. The LWW ceiling in `task-mapper.ts` stays at now + 5 minutes. The cursor clamp is tighter, so a fast clock can't lift the next pull's lower bound past real time. `pullCursorVersion: 2` proves the cursor's domain; an unversioned `lastServerUpdatedAt` forces a full pull and is cleared.
- **Realtime**: PocketBase SSE auto-reconnects; periodic sync runs as safety net.
- **Echo filtering**: skip own-device changes via `device_id` comparison.
- **Auth**: PocketBase SDK auto-stores tokens in localStorage and auto-refreshes.

## Key Locations

- `lib/sync/pocketbase-client.ts` — SDK singleton wrapper
- `lib/sync/pb-sync-engine.ts` — push/pull engine with LWW resolution
- `lib/sync/pb-realtime.ts` — SSE subscription manager
- `lib/sync/pb-auth.ts` — OAuth login/logout
- `lib/sync/task-mapper.ts` — camelCase ↔ snake_case mapping

## OAuth (manual code flow)

- Sign-in uses the manual code flow: `listAuthMethods`, then the provider, then the `/api/gsd/oauth-callback` bounce, then the `/auth/callback/` BroadcastChannel relay, then `authWithOAuth2Code` with this tab's `state` and PKCE verifier (`lib/sync/pb-auth.ts`, `lib/sync/oauth-callback.ts`). Never call the realtime `authWithOAuth2({ provider })` form: it delivers the code to whichever realtime client the state names, so a crafted link can hand a victim's code to an attacker. Tokens live in the SDK's `authStore` (localStorage).
- **Google**: configured in PB admin.
- **GitHub**: requires server-side provider setup in PocketBase admin (`https://api.vinny.io/_/` → Settings → Auth providers).
- **Local dev**: OAuth sign-in against production PB completes only on gsd.vinny.dev, because the hosted bounce returns there. To test sign-in locally, run PocketBase at `127.0.0.1:8090` with `--hooksDir=docker/pb_hooks`, its own OAuth provider setup, and `GSD_WEB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback/`.

## OAuth Callback Domain Mismatch (recurring bug)

If users hit `redirect_uri_mismatch` after a deploy:
1. Check the `redirect_uri` registered in the provider (Google Cloud Console / GitHub OAuth App).
2. Confirm it matches the exact PocketBase origin used for auth — including trailing slash and `www` vs apex.
3. Providers redirect to `<pocketbase-origin>/api/gsd/oauth-callback` (`docker/pb_hooks/oauth_web_redirect.pb.js`), which bounces to the app's `/auth/callback/` page with code and state in the URL fragment. PocketBase's `/api/oauth2-redirect` is disabled: its realtime flow hands a code to whichever client the state names.
4. Production CloudFront rewrites must pass `/api/*` and `/_/*` through unchanged so OAuth callback/admin paths are never turned into static `index.html` lookups.
