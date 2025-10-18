# Cloudflare Worker Setup Guide

Follow these steps to deploy your GSD Sync Worker to Cloudflare.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- Node.js 18+ and pnpm installed

## Step 1: Authenticate with Cloudflare

Open your terminal in the `worker` directory and run:

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/worker
npx wrangler login
```

This will:
1. Open your browser to Cloudflare
2. Ask you to authorize Wrangler
3. Save your credentials locally

**Alternative: API Token Method**

If you prefer using an API token:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Copy the token and save it:

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
# Add to your ~/.zshrc or ~/.bashrc to make it permanent
echo 'export CLOUDFLARE_API_TOKEN="your-token-here"' >> ~/.zshrc
```

## Step 2: Create D1 Database

```bash
npx wrangler d1 create gsd-sync
```

**Expected output:**
```
✅ Successfully created DB 'gsd-sync'!

[[d1_databases]]
binding = "DB"
database_name = "gsd-sync"
database_id = "abc123-def456-ghi789"
```

**Action required:** Copy the `database_id` and update `wrangler.toml` line 14:
```toml
database_id = "abc123-def456-ghi789"  # Replace with your actual ID
```

## Step 3: Create KV Namespace

```bash
npx wrangler kv namespace create "KV"
```

**Expected output:**
```
🌀 Creating namespace with title "gsd-sync-worker-KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "KV", id = "xyz123abc456" }
```

**Action required:** Copy the `id` and update `wrangler.toml` line 29:
```toml
id = "xyz123abc456"  # Replace with your actual ID
```

## Step 4: Create R2 Bucket (for backups)

```bash
npx wrangler r2 bucket create gsd-backups
```

**Expected output:**
```
✅ Created bucket 'gsd-backups'
```

No configuration change needed - the bucket name in `wrangler.toml` is already correct.

## Step 5: Set Secrets

Generate and set secure secrets for JWT signing and encryption:

```bash
# Generate a random secret (or use your own 32+ character string)
# On macOS/Linux:
JWT_SECRET=$(openssl rand -base64 32)
echo $JWT_SECRET

# Set the secret
npx wrangler secret put JWT_SECRET
# Paste the secret when prompted

# Optional: Encryption salt (for additional server-side security)
ENCRYPTION_SALT=$(openssl rand -base64 32)
echo $ENCRYPTION_SALT

npx wrangler secret put ENCRYPTION_SALT
# Paste the salt when prompted
```

**Important:** Save these secrets somewhere secure (password manager). If you lose them, users will need to re-authenticate.

## Step 6: Apply Database Schema

```bash
# Apply schema to local development database
npx wrangler d1 execute gsd-sync --local --file=./schema.sql

# Apply schema to remote production database
npx wrangler d1 execute gsd-sync --remote --file=./schema.sql
```

**Expected output:**
```
🌀 Executing on remote database gsd-sync (abc123-def456-ghi789):
🚣 Executed 7 commands in 0.234ms
```

## Step 7: Test Locally

```bash
pnpm dev
```

**Expected output:**
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

Test the health endpoint:
```bash
curl http://localhost:8787/health
```

Should return:
```json
{"status":"ok","timestamp":1234567890}
```

## Step 8: Deploy to Production

```bash
# First deployment (creates the worker)
npx wrangler deploy

# Or deploy to staging first
npx wrangler deploy --env staging
```

**Expected output:**
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded gsd-sync-worker (x.xx sec)
Published gsd-sync-worker (x.xx sec)
  https://gsd-sync-worker.your-subdomain.workers.dev
```

**Save this URL!** You'll need it for the client-side configuration.

## Step 9: Configure CORS (Important!)

Update `src/middleware/cors.ts` line 3 to restrict to your domain:

```typescript
'Access-Control-Allow-Origin': 'https://gsd.vinny.dev',  // Your actual domain
```

Then redeploy:
```bash
npx wrangler deploy
```

## Step 10: Test Production Deployment

```bash
# Test health endpoint
curl https://gsd-sync-worker.your-subdomain.workers.dev/health

# Test registration (replace with your worker URL)
curl -X POST https://gsd-sync-worker.your-subdomain.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "MySecurePassword123!",
    "deviceName": "Test Device"
  }'
```

**Expected response:**
```json
{
  "userId": "...",
  "deviceId": "...",
  "salt": "...",
  "token": "...",
  "expiresAt": 1234567890
}
```

## Troubleshooting

### "Database not found" error
- Make sure you updated the `database_id` in `wrangler.toml`
- Verify the database exists: `npx wrangler d1 list`

### "KV namespace not found" error
- Make sure you updated the KV namespace `id` in `wrangler.toml`
- Verify it exists: `npx wrangler kv namespace list`

### "JWT_SECRET not set" error
- Make sure you ran `npx wrangler secret put JWT_SECRET`
- Verify secrets: `npx wrangler secret list`

### CORS errors from browser
- Update `src/middleware/cors.ts` with your actual domain
- Redeploy the worker

### Rate limit errors during testing
- Temporarily increase limits in `src/middleware/rate-limit.ts`
- Or wait for the rate limit window to reset (60 seconds)

## Monitoring and Logs

### View real-time logs
```bash
npx wrangler tail
```

### View Cloudflare dashboard
https://dash.cloudflare.com/

Navigate to: Workers & Pages → gsd-sync-worker

## Next Steps

Once deployed successfully:

1. ✅ Note your worker URL
2. ✅ Test all endpoints (see README.md for API docs)
3. ✅ Configure client-side sync to use this URL
4. ✅ Set up monitoring/alerts in Cloudflare dashboard

## Cost Tracking

### View current usage
https://dash.cloudflare.com/ → Workers & Pages → Usage

### Free tier limits
- 100k requests/day
- 5GB D1 storage
- 100k KV reads/day
- 10GB R2 storage

You'll get email alerts if you approach these limits.

## Security Checklist

- [ ] JWT_SECRET is set and secure (32+ characters)
- [ ] ENCRYPTION_SALT is set (optional but recommended)
- [ ] CORS is restricted to your domain (not '*')
- [ ] Secrets are saved in password manager
- [ ] Worker URL is noted for client configuration
- [ ] Test registration/login flow works
- [ ] Monitor logs for errors

---

**Need help?** Check the main README.md or create an issue.
