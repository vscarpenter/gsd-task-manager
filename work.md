# OAuth iPad PWA Fix - Work Session Summary

## Date
October 19, 2025

## Problem Statement
OAuth authentication was failing on iPad PWA (Progressive Web App) with "Load failed" errors when trying to sign in with Google or Apple. The sync feature worked in regular browsers but not in iOS standalone/PWA mode.

---

## What We Accomplished

### 1. ✅ Identified Root Cause: iOS PWA Cross-Origin Restrictions
- iOS PWA blocks cross-origin requests to `workers.dev` domains
- The PWA was trying to call `https://gsd-sync-worker-production.vscarpenter.workers.dev` directly
- iOS security model prevents this in standalone mode

### 2. ✅ Implemented CloudFront Proxy Solution
- **Goal:** Make all API calls same-origin (`gsd.vinny.dev/api/*`)
- **Created:** `scripts/setup-cloudfront-api-proxy.sh` - automated CloudFront configuration script
- **Changes:**
  - Added worker origin to CloudFront distribution (E1T6GDX0TQEP94)
  - Created `/api/*` cache behavior that proxies to worker
  - CloudFront now forwards requests: `https://gsd.vinny.dev/api/*` → worker

### 3. ✅ Updated All Client Code to Use Same-Origin URLs
Updated the following files to use `window.location.origin` instead of worker URLs:
- `components/sync/oauth-buttons.tsx` - OAuth initiation (line 12-24)
- `lib/sync/config.ts` - Sync configuration (line 25-29)
- `lib/db.ts` - Database initialization (line 106-110)
- `components/sync/sync-auth-dialog.tsx` - Auth dialog (line 88-92)
- `components/sync/encryption-passphrase-dialog.tsx` - Encryption setup (line 77-79)

### 4. ✅ Deployed Client v3.6.0
- Built and deployed to S3/CloudFront
- Invalidated CloudFront cache
- All client API calls now use same-origin

### 5. ✅ Updated Google Cloud Console OAuth Configuration
Added CloudFront URL to authorized redirect URIs:
- `https://gsd.vinny.dev/api/auth/oauth/callback` (NEW)
- `https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/oauth/callback` (existing)
- `http://localhost:8787/api/auth/oauth/callback` (local dev)

---

## Current Issue: "Token Exchange Failed"

### What's Happening
1. ✅ OAuth initiation works (no more "Load failed")
2. ✅ Google authentication completes successfully
3. ✅ State token is found (no more "Invalid or expired state")
4. ❌ Token exchange fails with Google error: `{"error": "invalid_client", "error_description": "Unauthorized"}`

### Debugging Findings

From worker logs (`worker/src/handlers/oidc.ts:71-87`):

```json
{
  "provider": "google",
  "state": "426ff9033b70df7b70fb3691ee9f4de9c6f387cff8c84323efe7b29aa291be1a",
  "workerCallbackUri": "https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/oauth/callback",
  "appOrigin": "https://gsd.vinny.dev",
  "origin": null,
  "requestUrl": "https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/oauth/google/start",
  "headers": {
    "origin": null,
    "referer": null,
    "host": "gsd-sync-worker-production.vscarpenter.workers.dev",
    "xForwardedHost": null,
    "xForwardedProto": "https",
    "cloudFrontForwardedProto": null,
    "cloudFrontViewerCountry": null
  }
}
```

**Key Observations:**
1. `workerCallbackUri` is using worker URL (incorrect)
2. `appOrigin` is correctly set to `https://gsd.vinny.dev`
3. `origin` header is `null` (expected for same-origin requests)
4. CloudFront is NOT forwarding `X-Forwarded-Host` header
5. Last fix attempted: Use `appOrigin` for callback URI instead of `origin`

### Why Token Exchange Fails

Google OAuth requires the `redirect_uri` used in token exchange to **exactly match** the one used in the initial authorization request. Currently:

1. **Initial Authorization:** Worker tells Google to use `https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/oauth/callback`
2. **Token Exchange:** Worker sends the same URL to Google's token endpoint
3. **Google's Response:** "invalid_client" - the redirect_uri doesn't match what's configured or the client secret is wrong

The issue is that Google is redirecting back to the **worker URL directly** instead of the CloudFront URL, bypassing the proxy entirely.

---

## Root Cause Analysis

### The Problem
Even though we've updated all client code to use `window.location.origin`, CloudFront is **not properly forwarding** the request context to the worker. When the worker receives the request:

- `request.url` shows the worker URL (not CloudFront URL)
- `Origin` header is `null` (same-origin requests don't send this)
- `X-Forwarded-Host` is `null` (CloudFront not configured to forward it)
- No way to detect that the request came through CloudFront

### Why This Happens
CloudFront proxies the request but doesn't preserve information about the original host. The worker has no way to know:
- Was this request made to `gsd.vinny.dev`?
- Or was it made directly to the worker URL?

---

## Potential Solutions

### Option 1: Configure CloudFront to Forward Host Header ✨ RECOMMENDED
**Update CloudFront cache behavior to forward the `Host` header:**

```bash
# Fetch current config
aws cloudfront get-distribution-config --id E1T6GDX0TQEP94 > /tmp/cf-config.json

# Extract ETag
ETAG=$(jq -r '.ETag' /tmp/cf-config.json)

# Update /api/* behavior to forward Host header
jq '.DistributionConfig.CacheBehaviors.Items[] |=
  if .PathPattern == "/api/*" then
    .ForwardedValues.Headers.Items += ["Host"] |
    .ForwardedValues.Headers.Quantity = (.ForwardedValues.Headers.Items | length)
  else . end' /tmp/cf-config.json > /tmp/cf-config-updated.json

# Apply changes
aws cloudfront update-distribution \
  --id E1T6GDX0TQEP94 \
  --distribution-config file:///tmp/cf-config-updated.json \
  --if-match "$ETAG"
```

**Then update worker code** (`worker/src/handlers/oidc.ts:30-36`):
```typescript
// Use Host header to determine callback URI
// When proxied through CloudFront, Host will be "gsd.vinny.dev"
// When accessed directly, Host will be "gsd-sync-worker-production.vscarpenter.workers.dev"
const host = request.headers.get('Host') || new URL(request.url).host;
const protocol = request.headers.get('X-Forwarded-Proto') || 'https';
const workerCallbackUri = `${protocol}://${host}/api/auth/oauth/callback`;
const appOrigin = origin || `${protocol}://${host.replace('/api/auth/oauth/google/start', '')}`;
```

### Option 2: Use Custom Header in Client Requests
**Add a custom header in client code** to indicate the origin:

In `components/sync/oauth-buttons.tsx:150-157`:
```typescript
response = await fetch(workerEndpoint, {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'X-App-Origin': window.location.origin, // Add this
  },
  mode: 'cors',
  credentials: 'omit',
});
```

**Update CloudFront to forward the custom header:**
```bash
# Add "X-App-Origin" to ForwardedValues.Headers.Items
```

**Update worker to use it** (`worker/src/handlers/oidc.ts:30-36`):
```typescript
const customOrigin = request.headers.get('X-App-Origin');
const appOrigin = customOrigin || origin || env.OAUTH_REDIRECT_URI.replace('/oauth-callback', '');
const workerCallbackUri = `${appOrigin}/api/auth/oauth/callback`;
```

### Option 3: Hardcode CloudFront URL in Production Worker
**Simplest but least flexible:**

In `worker/wrangler.toml:64`:
```toml
[env.production.vars]
OAUTH_REDIRECT_URI = "https://gsd.vinny.dev/oauth-callback"
OAUTH_CALLBACK_BASE = "https://gsd.vinny.dev"  # Add this
```

In `worker/src/handlers/oidc.ts:30-36`:
```typescript
// Use environment-specific callback URL
const callbackBase = env.OAUTH_CALLBACK_BASE || appOrigin;
const workerCallbackUri = `${callbackBase}/api/auth/oauth/callback`;
```

---

## Files Modified in This Session

### Client Side
1. `components/sync/oauth-buttons.tsx` - Same-origin API URLs
2. `lib/sync/config.ts` - Dynamic serverUrl based on environment
3. `lib/db.ts` - Database initialization with same-origin
4. `components/sync/sync-auth-dialog.tsx` - OAuth success handler
5. `components/sync/encryption-passphrase-dialog.tsx` - Encryption salt upload
6. `package.json` - Version bump to 3.6.0

### Worker Side
1. `worker/src/handlers/oidc.ts` - OAuth callback URI logic (multiple attempts)
2. `worker/wrangler.toml` - Production OAuth redirect URI

### Infrastructure
1. `scripts/setup-cloudfront-api-proxy.sh` - CloudFront configuration script (created)

---

## ✅ SOLUTION IMPLEMENTED: Option 3 (Hardcode CloudFront URL)

### Implementation (October 19, 2025)

**Decision:** Implemented Option 3 as the simplest and most explicit solution for production PWA support.

**Changes Made:**

1. **`worker/wrangler.toml:65`** - Added production environment variable:
   ```toml
   OAUTH_CALLBACK_BASE = "https://gsd.vinny.dev"
   ```

2. **`worker/src/handlers/oidc.ts:30-35`** - Updated OAuth handler to use environment variable:
   ```typescript
   const callbackBase = env.OAUTH_CALLBACK_BASE || origin || env.OAUTH_REDIRECT_URI.replace('/oauth-callback', '');
   const workerCallbackUri = `${callbackBase}/api/auth/oauth/callback`;
   const appOrigin = callbackBase;
   ```

3. **`worker/src/types.ts:17`** - Added TypeScript type:
   ```typescript
   OAUTH_CALLBACK_BASE?: string; // Optional: set in production for CloudFront proxy
   ```

4. **Deployed to production** - Worker version `916536b7-0f3c-46d0-ad12-1e17aa97f9be`

**Why Option 3:**
- ✅ Simplest implementation - no CloudFront changes required
- ✅ Explicit and clear - production always uses `gsd.vinny.dev`
- ✅ No risk to caching behavior
- ✅ Only need PWA support on main domain
- ✅ Maintains backward compatibility for other environments

### Testing Checklist
- [ ] OAuth works on iPad PWA
- [ ] OAuth still works in browser (popup flow)
- [ ] OAuth works on iPhone PWA
- [ ] Local development still works (`http://localhost:8787`)

---

## Next Steps (If Testing Fails)

### If Option 3 Doesn't Resolve the Issue
Try Option 1 (Forward Host Header) or Option 2 (Custom Header) as alternatives

---

## Technical Details

### CloudFront Distribution
- **Distribution ID:** E1T6GDX0TQEP94
- **Domain:** gsd.vinny.dev
- **Origin Added:** gsd-sync-worker-production.vscarpenter.workers.dev
- **Cache Behavior:** `/api/*` forwards to worker origin

### Current CloudFront Headers Forwarded
```json
{
  "Quantity": 4,
  "Items": ["Authorization", "Origin", "Accept", "Content-Type"]
}
```

**Need to add:** `"Host"` or create custom header like `"X-App-Origin"`

### Google OAuth Configuration
- **Client ID:** 76193013447-jmjtno9hmhrofa50q6ptooh73h5qhvqg.apps.googleusercontent.com
- **Authorized Redirect URIs:**
  - ✅ `https://gsd.vinny.dev/api/auth/oauth/callback`
  - ✅ `https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/oauth/callback`
  - ✅ `http://localhost:8787/api/auth/oauth/callback`

---

## Logs and Debugging

### Enable Worker Logs
```bash
cd worker
npx wrangler tail --env production --format pretty
```

### Key Log Messages
- `[INFO] [OIDC] OAuth flow initiated` - Shows callback URI and headers
- `[ERROR] [OIDC] Token exchange failed` - Shows Google error response

### Current Error
```json
{
  "error": "invalid_client",
  "error_description": "Unauthorized"
}
```

This error from Google typically means:
1. The `redirect_uri` doesn't match what's configured
2. The `client_secret` is incorrect
3. The OAuth client is not authorized

Since we've verified the redirect URIs are configured correctly, the issue is likely that the worker is sending the wrong `redirect_uri` in the token exchange request (it's sending the worker URL instead of the CloudFront URL).

---

## Conclusion

We've successfully set up the CloudFront proxy infrastructure and updated all client code to use same-origin API calls. The remaining issue is that CloudFront doesn't forward enough information for the worker to determine the correct callback URL.

**The most promising solution is Option 1** - configuring CloudFront to forward the `Host` header, which will allow the worker to detect whether it's being called through CloudFront (`gsd.vinny.dev`) or directly (`gsd-sync-worker-production.vscarpenter.workers.dev`).

---

---

## ✅ SESSION 2: OAuth Backend Fixed, New Frontend Issue (October 19, 2025 - Evening)

### Problems Resolved from Session 1:
1. ✅ **"Token exchange failed"** - Fixed by updating Google OAuth redirect URI
2. ✅ **D1 database errors** - Fixed by running migrations
3. ✅ **JWT/encryption errors** - Fixed by setting secrets
4. ✅ **OAuth callback page missing** - Fixed by deploying v3.6.2
5. ✅ **OAuth flow completes successfully** - User can authenticate with Google

### New Issue Discovered: Sync Button Doesn't Update

**What's Happening:**
- ✅ OAuth flow completes successfully (token exchange works)
- ✅ Worker creates user, device, and session
- ✅ OAuth callback page receives success parameters
- ✅ OAuth callback page stores data in sessionStorage
- ✅ OAuth callback page redirects to `/?oauth_complete=true`
- ❌ **Main app doesn't read sessionStorage or update sync button state**
- ❌ When user clicks sync button, OAuth flow starts again (as if not authenticated)

**Root Cause:**
The OAuth callback page (`app/(auth)/oauth-callback/page.tsx`) was correctly storing auth data in sessionStorage and redirecting, but there was NO component in the main app to:
1. Detect the `?oauth_complete=true` query parameter
2. Read `oauth_success` from sessionStorage
3. Store auth data in IndexedDB
4. Trigger the sync button to update

### Solution Attempted: OAuth Callback Handler Component

**Files Created:**
1. **`components/oauth-callback-handler.tsx`** (v3.6.3)
   - Detects `?oauth_complete=true` query param on every page load
   - Reads `oauth_success` from sessionStorage
   - Stores auth config in IndexedDB (`syncMetadata` table with key `sync_config`)
   - Shows encryption passphrase dialog for new/existing users
   - Cleans up sessionStorage and query params after processing

2. **`components/client-layout.tsx`** (v3.6.3)
   - Client-side wrapper component
   - Wraps children with Suspense boundary
   - Includes OAuthCallbackHandler globally

**Files Modified:**
1. **`app/layout.tsx`** (v3.6.3)
   - Added ClientLayout wrapper around children
   - Ensures OAuthCallbackHandler runs on every page

2. **`package.json`**
   - v3.6.3: Initial fix with OAuthCallbackHandler
   - v3.6.4: Added extensive debug logging

### Debug Logging Added (v3.6.4)

Added console logs with `[OAuthCallbackHandler]` prefix at every step:
- Component mount and query param detection
- sessionStorage read status (FOUND / NOT FOUND)
- Auth data processing
- IndexedDB storage
- Encryption dialog display
- Session cleanup

Added toast notifications:
- "Processing OAuth for {email}..." when data found
- "OAuth data not found in sessionStorage" error
- "Sync enabled successfully!" on completion

### Current Status (v3.6.4 Deployed)

**Deployed Versions:**
- **Client:** v3.6.4 (with OAuthCallbackHandler + debug logging)
- **Worker:** Production with OAUTH_CALLBACK_BASE set

**Testing Results:**
- User deployed v3.6.4, cleared cache, reinstalled PWA
- OAuth still completes successfully
- **Sync button still doesn't update** ❌
- No console logs observed (need to verify this)

### Expected Flow (How It Should Work)

1. User clicks sync button → Opens OAuth dialog
2. User clicks "Sign in with Google"
3. OAuth flow → redirected to Google
4. Google authenticates → redirects to `https://gsd.vinny.dev/api/auth/oauth/callback`
5. Worker handles callback → creates user/device/session → redirects to `/oauth-callback?success=true&userId=...&token=...`
6. OAuth callback page (`/oauth-callback`) → stores data in sessionStorage → redirects to `/?oauth_complete=true`
7. **[NEW]** OAuthCallbackHandler detects `oauth_complete=true` → reads sessionStorage → stores in IndexedDB
8. **[NEW]** Shows encryption passphrase dialog
9. **[NEW]** After encryption setup → sync is enabled
10. useSync hook (polling every 2 seconds) detects config in IndexedDB → updates sync button

### Next Debugging Steps

**CRITICAL: Check Browser Console**
When testing on iPad PWA, open Safari Developer Tools and check:

1. **Console Logs:**
   - Look for `[OAuthCallbackHandler]` prefix logs
   - Should see: "Mounted, oauth_complete = true"
   - Should see: "sessionStorage oauth_success = FOUND" or "NOT FOUND"
   - If NO logs appear, component isn't mounting

2. **SessionStorage Check:**
   - In Console, run: `sessionStorage.getItem('oauth_success')`
   - Should return JSON string with userId, token, email, etc.
   - If null, OAuth callback page didn't store it

3. **IndexedDB Check:**
   - In Application/Storage tab → IndexedDB → GsdDatabase → syncMetadata
   - Should see entry with key = 'sync_config'
   - Should have enabled=true, userId, deviceId, email, token

4. **Network Tab:**
   - Watch for the redirect from `/oauth-callback` to `/?oauth_complete=true`
   - Check if query param is actually present in URL

### Possible Issues to Investigate

**If NO console logs from OAuthCallbackHandler:**
- ClientLayout not rendering (check if it's in the DOM)
- Suspense boundary preventing render
- Component not exporting correctly
- Build didn't include the new files

**If sessionStorage is EMPTY:**
- Data not persisting across redirect (iOS Safari restriction?)
- OAuth callback page running but not saving
- sessionStorage being cleared by PWA service worker

**If sessionStorage has data BUT IndexedDB doesn't:**
- Error in handleOAuthCallback function (check console.error)
- Permission issue with IndexedDB
- DB schema mismatch

**If IndexedDB has data BUT sync button doesn't update:**
- useSync hook not detecting the change
- Polling interval issue (should check every 2 seconds)
- isEnabled calculation broken in sync engine

### Files Modified in This Session

**Client Side (v3.6.3 → v3.6.4):**
1. **NEW:** `components/oauth-callback-handler.tsx` - Processes OAuth callback
2. **NEW:** `components/client-layout.tsx` - Global client wrapper
3. **MODIFIED:** `app/layout.tsx` - Added ClientLayout
4. **MODIFIED:** `package.json` - Version 3.6.4

**Worker Side:**
- No changes in this session

### Code References

**OAuthCallbackHandler logic:**
- `components/oauth-callback-handler.tsx:33-134` - Main useEffect hook
- Reads: `searchParams.get('oauth_complete')`
- Reads: `sessionStorage.getItem('oauth_success')`
- Writes: `db.syncMetadata.put({ key: 'sync_config', enabled: true, ... })`

**Sync Button State:**
- `components/sync/sync-button.tsx:18` - Uses `useSync()` hook
- `lib/hooks/use-sync.ts:24-36` - Polls `isEnabled()` every 2 seconds
- `lib/sync/engine.ts:323-326` - Checks IndexedDB for sync_config

**OAuth Callback Page:**
- `app/(auth)/oauth-callback/page.tsx:62` - Stores in sessionStorage
- `app/(auth)/oauth-callback/page.tsx:66` - Redirects to `/?oauth_complete=true`

---

## Resources

- [CloudFront Header Forwarding Docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html#request-custom-headers-behavior)
- [Google OAuth 2.0 Redirect URI Validation](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
- [iOS PWA Limitations](https://developer.apple.com/documentation/webkit/safari_web_extensions/assessing_your_safari_web_extension_s_browser_compatibility)
- [sessionStorage in iOS Safari](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage#description) - Check for PWA/standalone mode restrictions
