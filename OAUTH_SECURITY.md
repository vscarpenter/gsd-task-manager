# OAuth Security Architecture

## Overview

GSD Task Manager now uses a **state-token handshake** to complete OAuth flows.  
The Cloudflare Worker is the only component that exchanges codes and secrets with Google or Apple.  
When the provider redirects back, the worker stores the signed-in session under the state token and redirects the browser to `/oauth-callback?state=…`.  
The client broadcasts that state to the rest of the app, fetches the result from the worker, and finishes the login.

This design removes fragile popup message handling, keeps secrets off the client, and delivers a single flow that works for desktop popups, iOS/Android PWAs, and traditional browsers.

## Flow Summary

1. **Client** requests `GET /api/auth/oauth/{provider}/start`. Worker issues a state token, PKCE verifier, and callback URL.
2. **User** signs in with the provider. The provider redirects to `https://gsd.vinny.dev/api/auth/oauth/callback?state=...`.
3. **Worker** exchanges the code, creates the user/device session, stores the result in KV as `oauth_result:<state>` (10 minute TTL, single use), then redirects to `/oauth-callback?state=...&success=1`.
4. **Callback page** calls `announceOAuthState(state, success?, error?)`, broadcasting the state via BroadcastChannel, `postMessage`, and `localStorage`, then closes the popup or returns the user to the app.
5. **App listeners** call `/api/auth/oauth/result?state=` and receive either `{ authData }` or `{ error }`. The worker deletes the record immediately after a successful fetch.
6. **Global handler** persists the session to IndexedDB and opens the encryption dialog; the Sync dialog simply observes status changes.

## Security Controls

### Strong, Single-Use State Tokens
- 32+ random bytes per request, stored with PKCE verifier and provider.
- States expire after 10 minutes (`TTL.OAUTH_STATE`) and are deleted once used.
- Replay attacks are prevented because `oauth_result:<state>` is deleted after the first fetch.

### Worker-Enforced Session Storage
- OAuth results (`userId`, `token`, `provider`, optional `encryptionSalt`) never appear in the redirect URL.
- Clients must possess the exact `state` token to retrieve the result.
- Errors are also stored under the same key, so every flow ends deterministically.

### Trusted Origin List

Allowed message origins live in `lib/oauth-config.ts`:

```typescript
export const ALLOWED_OAUTH_ORIGINS = [
  'https://gsd.vinny.dev',                                     // Production PWA
  'https://gsd-sync-worker-production.vscarpenter.workers.dev',// Production worker
  'https://gsd-dev.vinny.dev',                                 // Dev/Staging PWA
  'https://gsd-sync-worker.vscarpenter.workers.dev',           // Legacy worker host
  'https://gsd-sync-worker-dev.vscarpenter.workers.dev',       // Dev worker
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];
```

The React layer still verifies origins for popup postMessages, and the list is unit-tested in `tests/security/oauth-security.test.ts`.

### Broadcast + Storage Channels
- `announceOAuthState()` broadcasts through multiple mechanisms so both popup and redirect flows are covered:
  - `BroadcastChannel('oauth-handshake')`
  - `window.opener.postMessage(...)`
  - `localStorage` mirror for Safari / legacy environments
- `subscribeToOAuthHandshake()` deduplicates states, fetches results, and fans them out to listeners.

### Graceful Failure Handling
- If the worker result is missing or expired, the API returns HTTP `410` with a friendly message so the UI can prompt for a retry.
- Any listener can call `retryOAuthHandshake(state)` to re-fetch while the result is still in KV.
- Default listeners surface unexpected errors through the Sonner toast system.

## Testing & Tooling

Run the dedicated security tests:

```bash
pnpm test tests/security/oauth-security.test.ts
```

Manual verification checklist:
- Desktop popup flow: ensure the popup closes and the Sync dialog reflects the new user.
- iOS/Android PWA redirect flow: verify `/oauth-callback` broadcasts the state and the app finishes login.
- Error scenarios: revoke the OAuth redirect URI, confirm the worker returns `status: error` and the UI surfaces the message.

## Operational Notes

- CloudFront must proxy `/api/*` to the worker and forward `Host`/`X-Forwarded-Proto` so the worker can build correct callback URLs.
- Update Google/Apple OAuth clients with the same-origin callback `https://gsd.vinny.dev/api/auth/oauth/callback`.
- When adding new environments, update `ALLOWED_OAUTH_ORIGINS`, worker environment variables (`OAUTH_CALLBACK_BASE`), and the security tests together.
