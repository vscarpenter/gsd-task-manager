# OAuth Provider Setup Guide

This guide walks you through setting up Google and Apple Sign-In for the GSD Task Manager sync feature.

## Overview

The GSD Task Manager uses OAuth 2.0 / OIDC authentication with:
- **Google Sign-In** for Google account authentication
- **Apple Sign-In** for Apple ID authentication
- **Separate encryption passphrase** for end-to-end encrypted task sync

## Prerequisites

- Cloudflare Worker deployed (`gsd-sync-worker`)
- Domain configured for OAuth callbacks
- Access to Google Cloud Console
- Apple Developer account (for Apple Sign-In)

---

## Google Sign-In Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: `GSD Task Manager`
4. Click "Create"

### 2. Enable Google+ API

1. In the left sidebar, navigate to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click "Google+ API"
4. Click "Enable"

### 3. Configure OAuth Consent Screen

1. Navigate to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type
3. Click "Create"
4. Fill in the required fields:
   - **App name**: `GSD Task Manager`
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click "Save and Continue"
6. Scopes: Click "Add or Remove Scopes"
   - Add: `openid`, `email`, `profile`
7. Click "Save and Continue"
8. Test users: Add your email for testing
9. Click "Save and Continue"

### 4. Create OAuth 2.0 Client ID

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: "Web application"
4. Name: `GSD Sync Client`
5. Authorized JavaScript origins:
   ```
   https://gsd.vinny.dev
   http://localhost:3000
   ```
6. Authorized redirect URIs:
   ```
   https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/oauth/callback
   https://gsd.vinny.dev/oauth/callback
   http://localhost:3000/oauth/callback
   ```
7. Click "Create"
8. **Copy** the Client ID and Client Secret

### 5. Configure Cloudflare Secrets

```bash
cd worker

# Set Google OAuth credentials
npx wrangler secret put GOOGLE_CLIENT_ID
# Paste your Google Client ID when prompted

npx wrangler secret put GOOGLE_CLIENT_SECRET
# Paste your Google Client Secret when prompted
```

### 6. Update CORS Settings

Edit `worker/src/middleware/cors.ts` to allow your domain:

```typescript
'Access-Control-Allow-Origin': 'https://gsd.vinny.dev',
```

For development, you can temporarily use:
```typescript
'Access-Control-Allow-Origin': '*',
```

---

## Apple Sign-In Setup

### 1. Register App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Select "Identifiers" from the sidebar
4. Click the "+" button to create a new identifier
5. Select "App IDs" → "Continue"
6. Select "App" → "Continue"
7. Fill in:
   - **Description**: `GSD Task Manager`
   - **Bundle ID**: `com.gsd.taskmanager` (explicit)
8. Scroll down to "Capabilities"
9. Check "Sign in with Apple"
10. Click "Continue" → "Register"

### 2. Create Services ID

1. Go back to "Identifiers"
2. Click "+" → "Services IDs" → "Continue"
3. Fill in:
   - **Description**: `GSD Task Manager Web`
   - **Identifier**: `com.gsd.taskmanager.signin`
4. Check "Sign in with Apple"
5. Click "Configure" next to "Sign in with Apple"
6. Primary App ID: Select `com.gsd.taskmanager`
7. Website URLs:
   - **Domains and Subdomains**: `gsd-sync-worker.vscarpenter.workers.dev`
   - **Return URLs**:
     ```
     https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/oauth/callback
     https://gsd.vinny.dev/oauth/callback
     ```
8. Click "Next" → "Done" → "Continue" → "Register"

### 3. Create Key for Sign in with Apple

1. Go to "Keys" in the sidebar
2. Click "+" to create a new key
3. Fill in:
   - **Key Name**: `GSD Sign in with Apple Key`
4. Check "Sign in with Apple"
5. Click "Configure" next to "Sign in with Apple"
6. Select your Primary App ID: `com.gsd.taskmanager`
7. Click "Save" → "Continue" → "Register"
8. Click "Download" to download the `.p8` private key file
9. **IMPORTANT**: Save this file securely - you can only download it once
10. Note the **Key ID** (e.g., `ABC123DEFG`)

### 4. Get Team ID

1. In the top right of the Apple Developer portal, click your name
2. View "Membership" or account details
3. Note your **Team ID** (e.g., `XYZ987WXYZ`)

### 5. Prepare Private Key

The private key must be formatted correctly for Cloudflare Workers:

```bash
# View your downloaded key
cat AuthKey_ABC123DEFG.p8
```

It should look like:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkw...
...
-----END PRIVATE KEY-----
```

### 6. Configure Cloudflare Secrets

```bash
cd worker

# Set Apple Client ID (Services ID)
npx wrangler secret put APPLE_CLIENT_ID
# Enter: com.gsd.taskmanager.signin

# Set Apple Team ID
npx wrangler secret put APPLE_TEAM_ID
# Enter: XYZ987WXYZ (your actual Team ID)

# Set Apple Key ID
npx wrangler secret put APPLE_KEY_ID
# Enter: ABC123DEFG (your actual Key ID)

# Set Apple Private Key
npx wrangler secret put APPLE_PRIVATE_KEY
# Paste the ENTIRE contents of the .p8 file INCLUDING the header and footer
```

---

## OAuth Redirect URI Configuration

### Update Worker Environment Variable

```bash
cd worker

# Set the OAuth redirect URI
npx wrangler secret put OAUTH_REDIRECT_URI
# Enter: https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/oauth/callback
```

### Update Frontend OAuth Buttons

Edit `components/sync/oauth-buttons.tsx` if your worker URL is different:

```typescript
const WORKER_URL = "https://gsd-sync-worker.vscarpenter.workers.dev";
```

Edit `app/oauth/callback/page.tsx`:

```typescript
const WORKER_URL = "https://gsd-sync-worker.vscarpenter.workers.dev";
```

---

## Database Migration

Run the OAuth migration to update the database schema:

```bash
cd worker

npx wrangler d1 execute gsd-sync --file=migrations/002_oauth_migration.sql
```

This will:
- Remove password fields from the users table
- Add OAuth provider fields
- Create indexes for efficient OAuth lookups

---

## Testing

### Test Google Sign-In

1. Open the app: `https://gsd.vinny.dev` or `http://localhost:3000`
2. Open Settings → Sync Settings
3. Click "Continue with Google"
4. Sign in with your Google account
5. Grant permissions
6. You should be redirected back to the app
7. Create an encryption passphrase when prompted
8. Verify sync is enabled in settings

### Test Apple Sign-In

1. Open the app
2. Open Settings → Sync Settings
3. Click "Continue with Apple"
4. Sign in with your Apple ID
5. Choose email sharing preference
6. Grant permissions
7. You should be redirected back to the app
8. Create an encryption passphrase when prompted
9. Verify sync is enabled in settings

### Troubleshooting

**Google OAuth Error: redirect_uri_mismatch**
- Verify the redirect URI in Google Cloud Console matches exactly
- Check for trailing slashes
- Ensure protocol is `https://` (not `http://`)

**Apple OAuth Error: invalid_client**
- Verify Services ID matches `APPLE_CLIENT_ID`
- Check that the private key is correctly formatted
- Ensure Team ID and Key ID are correct

**Popup Blocked**
- Enable popups for your domain
- Check browser console for errors

**OAuth callback fails**
- Check Cloudflare Worker logs: `npx wrangler tail`
- Verify all secrets are set correctly
- Check CORS settings in worker

---

## Security Notes

1. **Never commit secrets** to version control
2. **Rotate secrets regularly** (every 90 days recommended)
3. **Use environment-specific credentials** for dev/staging/production
4. **Monitor OAuth logs** for suspicious activity
5. **Enable 2FA** on Google Cloud and Apple Developer accounts
6. **Store Apple private key** in a secure location (1Password, etc.)

---

## Production Checklist

- [ ] Google OAuth credentials configured
- [ ] Apple OAuth credentials configured
- [ ] OAuth redirect URIs set for production domain
- [ ] CORS configured for production domain only
- [ ] Database migration applied
- [ ] Secrets set in Cloudflare Workers
- [ ] OAuth consent screens configured
- [ ] Test with real user accounts
- [ ] Monitor error logs
- [ ] Document rollback procedure

---

## Support

For issues with:
- **Google OAuth**: Check [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- **Apple Sign-In**: Check [Apple Sign-In Documentation](https://developer.apple.com/documentation/sign_in_with_apple)
- **Cloudflare Workers**: Check [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

---

## Next Steps

After completing OAuth setup:

1. **Remove old password authentication code** (already done)
2. **Test multi-device sync** with OAuth authentication
3. **Implement token refresh** logic for long-lived sessions
4. **Add "Remember this device"** feature (optional)
5. **Monitor usage and errors** in production
