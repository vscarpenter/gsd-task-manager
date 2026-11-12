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
- **Rate limiting**: throttle push ops to ~100ms between requests to avoid 429s. The push looks up each queued row on its own (`fetchRemoteTaskEntry`). The deletion reconcile batch-fetches remote IDs (`fetchRemoteTaskIndex`).
- **Collection setup**: `scripts/setup-pocketbase-collections.sh` creates the `tasks` collection with correct schema, indexes, and API rules.

## Sync Architecture

- **Protocol**: last-write-wins (LWW) using `client_updated_at`; remote wins if newer.
- **Cursor contract**: `client_updated_at` is both the LWW authority and pull query field. Advance `lastClientUpdatedAt` only from records actually committed locally, clamp future values to now, subtract a 30-second overlap, and query the next pull with `>=`. The LWW ceiling in `task-mapper.ts` stays at now + 5 minutes. The cursor clamp is tighter, so a fast clock can't lift the next pull's lower bound past real time. `SYNC_CONFIG.PULL_CURSOR_VERSION` (4) is the pull contract. A config stamped with an older version, or none, pulls everything once with `mergeSameVersion`, so a newly synced field reaches rows an older build already pulled and stored without it; ordinary pulls keep the strictly-newer rule. That backfill sync pulls before it pushes, and a local copy that wins takes only the fields its build never read. Push reads `saved_at` and the focus pair from the current row. Only a completed pull stamps the version, so sign-in and sign-out keep it (ADR 0020). Bump the constant, and the iOS `SyncCursor.contractVersion`, whenever a build is the first to read a new synced field (ADR 0019), and add that field's first-read version beside `SAVED_AT_CONTRACT_VERSION`.
- **Far-future hold-off**: a remote stamp past the skew ceiling never overwrites a row that has a pending queued write, on pull or realtime (`holdsOffFarFutureRemote` in `pb-sync-helpers.ts`). The clamp makes such a stamp look newer, but push still sends the local edit, so applying it would split this device from every other one (S-AND-02, WEB-HOLDOFF). A failed, retry-exhausted row doesn't count on web, because nothing re-arms it, so it never pushes and holding off for it would split the device for good. Android counts its failed rows because it re-arms them on every launch and manual sync. If web ever adds a retry for failed rows, count them here too.
- **Resurrect on sight**: a Trash delete made while signed out, or still queued at sign-out, never reaches the server. Its id is remembered in a device-local `syncMetadata` row, and after the next completed pull `resurrectOnSight` lists the account once and brings each remembered task back (`tasks/spec-resurrect-on-sight.md`). Every way out of Trash (restore, undo, delete forever, empty, purge) forgets the id in the same transaction, through `lib/sync/resurrect-ids.ts`.
- **A refused token reads as a guest**: for a revoked, expired, or unknown token, PocketBase lists `tasks` as 200 with no items and 404s every lookup, the answers an empty account gives. Never act on an empty listing or a 404 on a write path until `confirmSessionIdentity` (a raw auth-refresh POST that saves nothing, so it can't land late over a newer sign-in) confirms the owner. Its 401 forgets the refused token (`forgetRefusedToken`) and ends the sync with the sign-in prompt. A refused session stops the push without charging queue rows, which retire at `MAX_RETRIES` and never re-arm. Only a 401 counts: a 403 more likely comes from something in front of the server.
- **Session fence**: a sync belongs to the account that was signed in when it started. Every local sync write re-reads `sync_config` inside its own Dexie transaction (`assertSyncSessionCurrent` in `sync-session.ts`) and throws `StaleSyncSessionError` once sync is off or the row names another account. `fullSync` reports that as `cancelled`. The push, in `pb-push.ts`, checks before it reads the queue (`readPendingForSession`) and before each row (`assertPushSessionCurrent`). It checks again inside each queue write (`dequeueForSession`, `chargeAttemptForSession`) and before its `tasks` write (`settleRowOffset`). Sign-in queues the local tasks inside the transaction that writes `sync_config` (`persistSyncConfig` in `components/sync/use-sync-auth-dialog.ts`). Sign-out reads `sync_config` inside the transaction that rewrites it and clears the queue (`lib/sync/config/disable.ts`).
- **Realtime**: PocketBase SSE auto-reconnects; periodic sync runs as safety net.
- **Echo filtering**: skip own-device changes via `device_id` comparison.
- **Auth**: PocketBase SDK auto-stores tokens in localStorage. The app refreshes the token itself: `ensureValidAuth` in `pb-auth.ts` runs at the start of each `fullSync` and refreshes a token that is near expiry.

## Key Locations

- `lib/sync/pocketbase-client.ts` — SDK singleton wrapper
- `lib/sync/pb-sync-engine.ts` — `fullSync` orchestration and the realtime apply path
- `lib/sync/pb-push.ts` — push with LWW resolution
- `lib/sync/pb-pull.ts` — pull and deletion reconcile
- `lib/sync/sync-session.ts` — session fence
- `lib/sync/pb-realtime.ts` — SSE subscription manager
- `lib/sync/pb-auth.ts` — OAuth sign-in and token refresh (sign-out is `lib/sync/config/disable.ts`)
- `lib/sync/task-mapper.ts` — camelCase ↔ snake_case mapping

## OAuth (manual code flow)

- Sign-in uses the manual code flow: `listAuthMethods`, then the provider, then the `/api/gsd/oauth-callback` bounce, then the `/auth/callback/` BroadcastChannel relay, then `authWithOAuth2Code` with this tab's `state` and PKCE verifier (`lib/sync/pb-auth.ts`, `lib/sync/oauth-callback.ts`). The tab that takes a relayed message acknowledges it on the channel, so the callback page closes only when a tab has the answer and otherwise says the sign-in went unclaimed. Never call the realtime `authWithOAuth2({ provider })` form: it delivers the code to whichever realtime client the state names, so a crafted link can hand a victim's code to an attacker. Tokens live in the SDK's `authStore` (localStorage).
- **Google**: configured in PB admin.
- **GitHub**: requires server-side provider setup in PocketBase admin (`https://api.vinny.io/_/` → Settings → Auth providers).
- **Local dev**: OAuth sign-in against production PB completes only on gsd.vinny.dev, because the hosted bounce returns there. To test sign-in locally, run PocketBase at `127.0.0.1:8090` with `--hooksDir=docker/pb_hooks`, its own OAuth provider setup, and `GSD_WEB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback/`.

## OAuth Callback Domain Mismatch (recurring bug)

If users hit `redirect_uri_mismatch` after a deploy:
1. Check the `redirect_uri` registered in the provider (Google Cloud Console / GitHub OAuth App).
2. Confirm it matches the exact PocketBase origin used for auth — including trailing slash and `www` vs apex.
3. Providers redirect to `<pocketbase-origin>/api/gsd/oauth-callback` (`docker/pb_hooks/oauth_web_redirect.pb.js`), which bounces to the app's `/auth/callback/` page with code and state in the URL fragment. PocketBase's `/api/oauth2-redirect` is disabled: its realtime flow hands a code to whichever client the state names.
4. Production CloudFront rewrites must pass `/api/*` and `/_/*` through unchanged so OAuth callback/admin paths are never turned into static `index.html` lookups.

## `notify_before` is always a number (D-10)

PocketBase never stores a null number, and `0` means "at the due time". The push mapper takes the default as a parameter and sends `payload ?? current row ?? this device's default`, never null. Off is `notification_enabled: false` with the number kept. Reads keep `notifyBefore ?? default` for legacy null rows. Spec: `tasks/spec-notify-before.md`.
