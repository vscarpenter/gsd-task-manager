# GSD Sync Worker

Cloudflare Worker backend for GSD Task Manager secure sync feature.

## Features

- **End-to-end encryption**: Server never sees plaintext task data
- **Vector clocks**: Robust conflict detection for distributed sync
- **JWT authentication**: Secure token-based auth with revocation
- **Rate limiting**: Per-user, per-endpoint protection
- **Device management**: Multi-device support with remote revocation
- **Automatic cleanup**: Scheduled cron jobs for old data
- **Multi-environment support**: Separate development, staging, and production deployments

## Quick Start (Multi-Environment Setup)

### Automated Setup for All Environments

The easiest way to set up all environments (development, staging, production):

```bash
cd worker
npm install

# Authenticate with Cloudflare
npx wrangler login

# Run automated setup (creates all resources and sets secrets)
npm run setup:all
```

This will:
- Create D1 databases, KV namespaces, and R2 buckets for all environments
- Generate and set JWT secrets for each environment
- Apply database schemas
- Update `wrangler.toml` with resource IDs

### Deploy to All Environments

```bash
# Deploy to all environments sequentially
npm run deploy:all
```

Or deploy to individual environments:

```bash
npm run deploy              # Development
npm run deploy:staging      # Staging
npm run deploy:production   # Production
```

### Monitor Logs

```bash
npm run tail                # Development
npm run tail:staging        # Staging
npm run tail:production     # Production
```

## Manual Setup (Advanced)

If you prefer manual setup or need to configure a single environment:

### Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally: `npm install -g wrangler`

### Installation

```bash
cd worker
npm install
```

### Configure Cloudflare Resources

1. **Create D1 Database**:
```bash
npx wrangler d1 create gsd-sync-dev
```

Copy the `database_id` from the output and update `wrangler.toml`.

2. **Create KV Namespace**:
```bash
npx wrangler kv namespace create "KV" --env development
```

Copy the `id` from the output and update `wrangler.toml`.

3. **Create R2 Bucket**:
```bash
npx wrangler r2 bucket create gsd-backups-dev
```

4. **Set Secrets**:
```bash
# Generate a secure random secret (at least 32 characters)
wrangler secret put JWT_SECRET

# Optional: additional salt for server-side operations
wrangler secret put ENCRYPTION_SALT
```

### Apply Database Schema

```bash
# Local development database
pnpm db:migrations:apply

# Remote production database
pnpm db:migrations:apply:remote
```

## Development

### Run locally
```bash
pnpm dev
```

The worker will be available at `http://localhost:8787`.

### Type checking
```bash
pnpm typecheck
```

## Deployment

### Deploy to staging
```bash
pnpm deploy:staging
```

### Deploy to production
```bash
pnpm deploy:production
```

### View logs
```bash
pnpm tail
```

## API Endpoints

### Authentication

**POST /api/auth/register**
- Register new user account
- Body: `{ email, password, deviceName }`
- Returns: `{ userId, deviceId, salt, token, expiresAt }`

**POST /api/auth/login**
- Login to existing account
- Body: `{ email, passwordHash, deviceId?, deviceName? }`
- Returns: `{ userId, deviceId, salt, token, expiresAt, syncRequired }`

**POST /api/auth/refresh**
- Refresh JWT token
- Headers: `Authorization: Bearer <token>`
- Returns: `{ token, expiresAt }`

**POST /api/auth/logout**
- Logout and revoke token
- Headers: `Authorization: Bearer <token>`
- Returns: `{ success: true }`

### Sync Operations

**POST /api/sync/push**
- Push local changes to server
- Headers: `Authorization: Bearer <token>`
- Body: `{ deviceId, operations[], clientVectorClock }`
- Returns: `{ accepted[], rejected[], conflicts[], serverVectorClock }`

**POST /api/sync/pull**
- Pull remote changes from server
- Headers: `Authorization: Bearer <token>`
- Body: `{ deviceId, lastVectorClock, sinceTimestamp?, limit?, cursor? }`
- Returns: `{ tasks[], deletedTaskIds[], serverVectorClock, conflicts[], hasMore, nextCursor? }`

**POST /api/sync/resolve**
- Resolve a conflict
- Headers: `Authorization: Bearer <token>`
- Body: `{ taskId, resolution, mergedTask? }`
- Returns: `{ success: true }`

**GET /api/sync/status**
- Get sync status
- Headers: `Authorization: Bearer <token>`
- Returns: `{ lastSyncAt, pendingPushCount, pendingPullCount, conflictCount, deviceCount, storageUsed, storageQuota }`

### Device Management

**GET /api/devices**
- List user's devices
- Headers: `Authorization: Bearer <token>`
- Returns: `{ devices: DeviceInfo[] }`

**DELETE /api/devices/:id**
- Revoke a device
- Headers: `Authorization: Bearer <token>`
- Returns: `{ success: true }`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                      │
├─────────────────────────────────────────────────────────┤
│  Router (itty-router)                                   │
│    ├─ Auth Endpoints                                    │
│    ├─ Sync Endpoints (with auth + rate limiting)       │
│    └─ Device Management                                 │
├─────────────────────────────────────────────────────────┤
│  Middleware                                             │
│    ├─ CORS & Security Headers                          │
│    ├─ JWT Authentication                                │
│    └─ Rate Limiting (KV-based)                          │
├─────────────────────────────────────────────────────────┤
│  Handlers                                               │
│    ├─ auth.ts (register, login, logout, refresh)       │
│    └─ sync.ts (push, pull, resolve, status, devices)   │
├─────────────────────────────────────────────────────────┤
│  Utilities                                              │
│    ├─ crypto.ts (password hashing, salt generation)    │
│    ├─ jwt.ts (token creation, verification)            │
│    └─ vector-clock.ts (conflict detection)             │
└─────────────────────────────────────────────────────────┘
         │               │              │
         ▼               ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │   D1    │   │    KV    │   │    R2    │
    │ (Tasks) │   │(Sessions)│   │(Backups) │
    └─────────┘   └──────────┘   └──────────┘
```

## Security

### Encryption
- **Client-side**: AES-256-GCM with PBKDF2 key derivation (600k iterations)
- **Server-side**: Argon2id password hashing
- **Transport**: TLS 1.3 enforced

### Authentication
- JWT tokens with 7-day expiry
- Token revocation via KV store
- Device-specific sessions
- Refresh token rotation

### Rate Limiting
- Per-user, per-endpoint limits
- Configurable windows and thresholds
- 429 responses with Retry-After headers

### Data Protection
- Zero-knowledge architecture (server never sees plaintext)
- Encrypted blobs only
- SHA-256 checksums for integrity
- Soft deletes with 30-day retention

## Monitoring

### Metrics (via Cloudflare Analytics)
- Request count per endpoint
- Error rates
- Response times
- CPU usage

### Logs
- All auth failures logged
- Conflict resolutions tracked
- Cleanup tasks logged

### Alerts
- High error rate (>5%)
- Rate limit exceeded frequently
- Database errors

## Troubleshooting

### "Database not found" error
- Ensure D1 database is created and ID is in `wrangler.toml`
- Run migrations: `pnpm db:migrations:apply:remote`

### "KV namespace not found" error
- Create KV namespace: `wrangler kv:namespace create "KV"`
- Update `wrangler.toml` with the namespace ID

### "JWT_SECRET not set" error
- Set secret: `wrangler secret put JWT_SECRET`

### Rate limit issues
- Adjust limits in `src/middleware/rate-limit.ts`
- Check KV storage for rate limit keys

## Cost Estimation

### Free Tier (sufficient for MVP)
- Workers: 100k requests/day
- D1: 5GB storage, 5M reads/day
- KV: 100k reads/day, 1k writes/day
- R2: 10GB storage

### Paid Tier (1000+ users)
- Workers: $5/month (10M requests)
- D1: $5/month (10GB + 25M reads)
- KV: $5/month (1M writes)
- R2: ~$1.50/month (100GB)

**Total: ~$15-20/month for 1000 active users**

## License

MIT
