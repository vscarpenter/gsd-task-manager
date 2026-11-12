# Self-Hosted GSD Task Manager (Docker)

Run the full GSD Task Manager stack locally — static PWA, PocketBase sync backend, and HTTPS — in a single container.

## Quick Start

```bash
cd docker
# Once: create the required 32-character encryption key.
echo "GSD_TASKS_ENC_KEY=$(openssl rand -hex 16)" > .env
docker compose up --build
```

`GSD_TASKS_ENC_KEY` encrypts task content at rest. Compose refuses to start
without it, and the container exits unless it is exactly 32 characters. Skip the
`echo` line if `docker/.env` already exists: a new key can't read tasks encrypted
with the old one. Back the key up apart from the database; a lost key makes
encrypted tasks unrecoverable.

Open **https://localhost** (accept the self-signed certificate warning on first visit).

Step-by-step guide: [docker-setup-and-run.md](docker-setup-and-run.md).

### Prebuilt images

Instead of building, you can pull a published image:

- `ghcr.io/vscarpenter/gsd-task-manager`
- `vscarpenter/gsd-task-manager` (Docker Hub)

Tags: `latest` and `X.Y.Z` / `X.Y` for releases, `edge` for the latest `main`
commit, and `sha-<short>` for a specific commit. Images are built for
`linux/amd64` and `linux/arm64`.

```bash
docker run -d --name gsd \
  -p 443:443 -p 80:80 \
  -v pb_data:/pb_data \
  -e GSD_TASKS_ENC_KEY=<your-32-character-key> \
  -e SITE_ADDRESS=localhost \
  vscarpenter/gsd-task-manager:latest
```

The first-time setup below uses `docker compose exec gsd`; with `docker run`, use
`docker exec gsd` instead, and add `-p 127.0.0.1:8090:8090` while you set up.

### First-Time PocketBase Setup

PocketBase starts with no `tasks` collection and no admin account. Migrations run
before it serves. Complete these steps once:

1. Create or update a PocketBase superuser inside the container:
   ```bash
   docker compose exec gsd pocketbase superuser upsert admin@example.com 'change-this-password' --dir=/pb_data
   ```
2. Temporarily publish PocketBase on localhost only, then restart
   (`docker compose up -d`). The setup script signs in as the superuser, and
   Caddy blocks superuser routes on the public origin, so the script can't run
   through `https://localhost`.
   ```yaml
   ports:
     - "443:443"
     - "80:80"
     - "127.0.0.1:8090:8090"
   ```
3. Create the **tasks** collection from the `docker/` directory:
   ```bash
   PB_URL=http://127.0.0.1:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD='change-this-password' \
   ../scripts/setup-pocketbase-collections.sh
   ```
4. Configure OAuth (Google, Apple, GitHub) if desired in the admin dashboard at
   **http://127.0.0.1:8090/_/**: open the **users** collection's settings, then
   **Options › OAuth2**. Apple returns with a POST, which `/api/gsd/oauth-callback`
   accepts.
5. Remove the `127.0.0.1:8090:8090` mapping and restart.

## Architecture

```
Browser (https://localhost)
    │
    ▼
┌──────────────────────────────┐
│  Caddy  (HTTPS reverse proxy)│
│  :443                        │
│                              │
│  /api/*  ──► PocketBase:8090 │
│  /*      ──► Static files    │
└──────────────────────────────┘
```

Everything runs behind a single HTTPS origin, so there are no CORS or mixed-content issues.
The PocketBase admin dashboard is not exposed through the public app origin by default.
For custom domains, the app now defaults sync to the same origin unless
`NEXT_PUBLIC_POCKETBASE_URL` is explicitly set.

## Configuration

### Environment Variables

Set these in `docker-compose.yml` or pass via `docker compose`:

| Variable | Default | Description |
|---|---|---|
| `SITE_ADDRESS` | `localhost` | Hostname Caddy listens on |
| `TLS_MODE` | `internal` | Explicit certificate mode: `internal`, `public`, or `custom` |
| `TLS_CERT` | *(empty)* | Certificate path when `TLS_MODE=custom` |
| `TLS_KEY` | *(empty)* | Private-key path when `TLS_MODE=custom` |
| `GSD_TASKS_ENC_KEY` | *(required)* | 32-character AES-256 key for at-rest task encryption. A lost key makes encrypted tasks unrecoverable. |
| `GSD_WEB_OAUTH_CALLBACK_URL` | `/auth/callback/` | Web page that `/api/gsd/oauth-callback` sends the browser to after sign-in. The default is this image's same-origin page; set it only if the web app is served elsewhere. |

`TLS_CERT` and `TLS_KEY` with no `TLS_MODE` are read as `custom`, so older
configurations keep working. Set `TLS_MODE` explicitly in new ones.

If you proxy PocketBase on a different origin instead of the same host, set
`NEXT_PUBLIC_POCKETBASE_URL` at build time so the static app can target the
correct backend.

### Custom SSL Certificates

1. Place your certificate and key in `docker/certs/` (the `gsd` user in the container must be able to read them):
   ```
   docker/certs/cert.pem
   docker/certs/key.pem
   ```
2. Uncomment the volumes and environment lines in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./certs:/certs:ro
   environment:
     - TLS_MODE=custom
     - TLS_CERT=/certs/cert.pem
     - TLS_KEY=/certs/key.pem
   ```
3. Restart: `docker compose up -d`

### Automatic Let's Encrypt (Public Domain)

If you have a public domain pointing to your server:

```yaml
environment:
  - TLS_MODE=public
  - SITE_ADDRESS=gsd.example.com
  # No TLS_CERT/TLS_KEY needed — Caddy handles ACME automatically
```

Caddy will obtain and renew certificates from Let's Encrypt automatically.

### Custom PocketBase Version

Override the default PocketBase version at build time:

```bash
docker compose build --build-arg POCKETBASE_VERSION=0.40.4
```

## Data Persistence

PocketBase data (database, uploaded files) is stored in a Docker volume named `pb_data`. Your data survives container rebuilds.

The entrypoint runs migrations with automigration disabled before serving.
Applied migration files are immutable: fresh volumes use the compatibility
migration set, while volumes with an existing `tasks` table run the full
forward-only set and complete any pending encryption cleanup before the API is
available.

To back up, stop the stack first for a consistent SQLite copy, then copy the
volume out of the container:
```bash
docker compose stop
docker cp $(docker compose ps -aq gsd):/pb_data ./pb_backup
docker compose start
```
Back up `GSD_TASKS_ENC_KEY` separately; the database is unreadable without it.

## Sessions and Tokens

User tokens last 30 days (set by migration `1793562900_users_auth_token_30_days.js`,
on fresh and existing installs). On this image, **Settings → Cloud Sync → Sign out
of all devices** in the web app ends every session for the account, including
tokens copied into an MCP client (`pb_hooks/session_revoke.pb.js`).

To reset (destroys all data):
```bash
docker compose down -v
```

## Tasks Collection Schema

`scripts/setup-pocketbase-collections.sh` and the migrations in
`docker/pb_migrations/` are the source of truth. Use the script rather than
building the collection by hand; this table is a reference and may lag them.

| Field | Type | Required | Notes |
|---|---|---|---|
| `task_id` | Text | ✓ | Client task ID, the sync identity (unique per owner) |
| `owner` | Text | ✓ | User ID |
| `title` | Text | ✓ | |
| `description` | Text | | |
| `urgent` | Bool | | Default: false |
| `important` | Bool | | Default: false |
| `quadrant` | Text | | |
| `due_date` | Text | | ISO timestamp |
| `completed` | Bool | | Default: false |
| `completed_at` | Text | | ISO timestamp |
| `recurrence` | Text | | none, daily, weekly, monthly |
| `tags` | JSON | | Array of strings |
| `subtasks` | JSON | | Array of subtask objects |
| `dependencies` | JSON | | Array of task IDs |
| `notification_enabled` | Bool | | Default: true |
| `notification_sent` | Bool | | Default: false |
| `notify_before` | Number | | Minutes |
| `last_notification_at` | Text | | ISO timestamp |
| `estimated_minutes` | Number | | |
| `time_spent` | Number | | Minutes |
| `time_entries` | JSON | | Array of time entry objects |
| `saved_at` | Text | | ISO timestamp; empty when the task isn't Saved |
| `snoozed_until` | Text | | ISO timestamp |
| `client_updated_at` | Text | | ISO timestamp (for LWW sync) |
| `client_created_at` | Text | | ISO timestamp |
| `device_id` | Text | | Originating device |

**Indexes**: `owner`; unique `(task_id, owner)`; `client_updated_at`.

**API Rules** (five, as the script sets them):
- `listRule`, `viewRule`, `createRule`, `deleteRule`: `@request.auth.id != "" && owner = @request.auth.id`
- `updateRule`: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = owner)`

## Troubleshooting

### Browser shows certificate warning
Expected with self-signed certificates. Click **Advanced → Proceed** (or equivalent). For a trusted local cert, use [mkcert](https://github.com/FiloSottile/mkcert) to generate certs and mount them as described above.

### Port 443 already in use
Change the host port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8443:443"
```
Then access `https://localhost:8443`. Register `https://localhost:8443/api/gsd/oauth-callback`
with each OAuth provider, since the redirect URL includes the port.

### PocketBase admin not loading
The admin dashboard is not exposed through `https://localhost/_/` by default. Temporarily add `127.0.0.1:8090:8090` to `ports`, restart, and open `http://127.0.0.1:8090/_/`. Remove that port mapping when setup is complete. If the local port still does not respond, wait a few seconds after container start and check logs with `docker compose logs -f`.

### OAuth not working
OAuth providers must be configured in PocketBase admin (the **users** collection's settings, **Options › OAuth2**). Register `https://localhost/api/gsd/oauth-callback` (or the same path on your custom `SITE_ADDRESS`) as the redirect URL with each provider. This image disables PocketBase's built-in `/api/oauth2-redirect`, because it can deliver a sign-in code to a browser other than the one that started sign-in.

## Directory contract

This section records the contract of the source files in `docker/`: `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, and `Caddyfile`.

### Interface

- `Dockerfile` build arguments: `POCKETBASE_VERSION`, `POCKETBASE_SHA256_AMD64`, `POCKETBASE_SHA256_ARM64`, and `TARGETARCH`. It uses the optional BuildKit secret `npmrc`.
- `Dockerfile` runtime stage: `EXPOSE 80 443`, `VOLUME ["/pb_data"]`, `USER gsd`, `ENTRYPOINT ["/entrypoint.sh"]`.
- `docker-entrypoint.sh` reads `GSD_TASKS_ENC_KEY`, `TLS_MODE`, `TLS_CERT`, `TLS_KEY`, `TMPDIR`, and `SITE_ADDRESS`.
- `docker-entrypoint.sh` exits 1 on an invalid key, an invalid `TLS_MODE`, or a missing or unreadable certificate or key in `custom` mode. Its `cleanup` function exits 0.
- `docker-entrypoint.sh` runs in this order: validate the key, resolve `TLS_MODE`, source `migrations.sh`, call `gsd_install_state /pb_data`, run `pocketbase migrate up`, start `pocketbase serve`, wait for `/api/health`, start `caddy run`.
- `docker-compose.yml` defines one service, `gsd`, with ports `443:443` and `80:80`, the volume `pb_data:/pb_data`, and `restart: unless-stopped`.
- `Caddyfile` reads the placeholders `SITE_ADDRESS`, `TLS_MODE`, `TLS_CERT`, and `TLS_KEY`. It imports `tls_internal`, `tls_public`, or `tls_custom`.
- `Caddyfile` proxies `/api/*` to `localhost:8090` and serves `/srv` for everything else, with `/index.html` as the fallback.
- `Caddyfile` returns 404 for `/api/collections/_superusers/*`, the same collection by id, `/api/admins/*`, `/api/gsd/feedback-controls*`, `/api/oauth2-redirect*`, and `/_/*`.
- Subdirectories:
  - [lib](./lib/README.md): the shell library that picks the migration set.
  - [pb_hooks](./pb_hooks.md): the PocketBase hooks.
  - [pb_migrations](./pb_migrations.md): the shipped migrations.
  - [pb_fresh_migrations](./pb_fresh_migrations.md): the overlay for fresh installs.

### Invariants

- `docker-entrypoint.sh` refuses to start unless `GSD_TASKS_ENC_KEY` has exactly 32 characters.
- `docker-entrypoint.sh` accepts `internal`, `public`, and `custom` for `TLS_MODE`. An unset mode with both `TLS_CERT` and `TLS_KEY` set becomes `custom`.
- `docker-entrypoint.sh` passes `--automigrate=false` to both `pocketbase migrate up` and `pocketbase serve`. It uses the fresh overlay only when `gsd_install_state` prints `fresh`.
- `docker-entrypoint.sh` waits up to 30 seconds for PocketBase. After that it prints a warning and starts Caddy anyway.
- `docker-compose.yml` uses `${GSD_TASKS_ENC_KEY:?...}`, so `docker compose up` fails when the variable is unset.
- `Dockerfile` accepts `amd64` or `arm64` for `TARGETARCH`. It checks the PocketBase archive with `sha256sum -c` against the checksum argument for that architecture.
- `Dockerfile` pins all three base images by digest.
- `Dockerfile` copies hooks and migrations outside `/pb_data`, so an existing volume cannot shadow them.
- `Caddyfile` sets `admin off`. Its deny rules are more specific than `/api/*`, so they take precedence.

### Side Effects

- `Dockerfile` (build time): runs `bun install --frozen-lockfile`, builds the static export, and downloads the PocketBase release archive from GitHub with `curl`.
- `Dockerfile` (build time): runs `setcap cap_net_bind_service=+ep` on the `caddy` and `pocketbase` binaries.
- `docker-entrypoint.sh`: on a fresh install it writes the folder `${TMPDIR:-/tmp}/gsd-fresh-migrations-$$`.
- `docker-entrypoint.sh`: `pocketbase migrate up --dir=/pb_data` writes to the data volume. `pocketbase serve --http=0.0.0.0:8090` and `caddy run` start as background processes.
- `docker-entrypoint.sh:cleanup`: sends `kill` to both processes on `TERM`, `INT`, or `QUIT`.
- `Caddyfile`: `tls internal` makes Caddy create a local certificate authority. The `public` mode makes outbound ACME requests.
- `docker-compose.yml`: keeps `/pb_data` in the named volume `pb_data`.

### Verification

- Run: `bun run test` (Vitest; `tests/docker-entrypoint.test.ts`, `tests/docker-migrations.test.ts`, and `tests/data/docker-context-imports.test.ts` cover this directory)
