# OAuth Callback Page

## Overview
`page.tsx` is the client page an OAuth sign-in returns to. On mount it hands the URL fragment to `relayOAuthCallback`, clears the fragment, and shows a status message for the outcome.

## Interface
- `OAuthCallbackPage` (`page.tsx`, default export): the only export. It takes no props.
- It calls `relayOAuthCallback` from `@/lib/sync/oauth-callback` with `window.location.hash.slice(1)`.
- `OUTCOME_TEXT` (`page.tsx`, private): maps each `OAuthRelayOutcome` (`delivered`, `unclaimed`, `invalid`) to its message.

## Invariants
- The relay runs once per mount. The `relayStarted` ref guards the effect, because a second run would find a cleared fragment and report `invalid`.
- The effect reads the fragment and passes it to `relayOAuthCallback` before `history.replaceState` clears it.
- `window.close()` runs only when the outcome is `delivered`. The page stays open for other outcomes.
- The status text and the failure text are two separate elements, `role="status"` and `role="alert"`. A comment in `OAuthCallbackPage` says a changed role often goes unannounced.
- The file's doc comment says `code` and `state` arrive in the URL fragment, and the page removes them from the address bar and history entry.

## Side Effects
- Reads `window.location.hash` and calls `relayOAuthCallback` (`OAuthCallbackPage` effect).
- Calls `window.history.replaceState(null, "", window.location.pathname)` to drop the fragment.
- Calls `window.close()` on a `delivered` outcome.

## Verification
- Run: `bun run test`
