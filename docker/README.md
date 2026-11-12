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

Open **https://localhost** (accept the certificate warning on first visit: Caddy's internal CA signs the default certificate, and your browser doesn't trust that CA).

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
`docker exec gsd` instead, and add `-p 127.0.0.1:8090:8090` while you set up. A
running container can't drop a port. When setup is done, remove the container
(`docker rm -f gsd`) and run it again without that flag. The `pb_data` volume keeps
your data.

### First-Time PocketBase Setup

PocketBase starts with no `tasks` collection and no admin account. Migrations run
before it serves, but on a new volume they don't create the collection. The setup
script in step 3 creates it. Complete these steps once:

1. Create or update a PocketBase superuser inside the container:
   ```bash
   docker compose exec gsd pocketbase superuser upsert admin@example.com 'change-this-password' --dir=/pb_data
   ```
2. Temporarily publish PocketBase on localhost only: uncomment the third line below
   under `ports` in `docker-compose.yml`, then restart (`docker compose up -d`). The setup script signs in as the superuser, and
   Caddy blocks superuser routes on the public origin, so the script can't run
   through `https://localhost`.
   ```yaml
   ports:
     - "443:443"
     - "80:80"
     - "127.0.0.1:8090:8090"
   ```
3. Create the **tasks** collection from the `docker/` directory (the script needs
   `curl`, `mktemp`, and `python3` on the host):
   ```bash
   PB_URL=http://127.0.0.1:8090 \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD='change-this-password' \
   ../scripts/setup-pocketbase-collections.sh
   ```
4. Configure OAuth (Google, Apple, GitHub) if desired in the admin dashboard at
   **http://127.0.0.1:8090/_/**: open the **users** collection's settings, then
   **Options › OAuth2**. Register `https://localhost/api/gsd/oauth-callback` (or the
   same path on your custom `SITE_ADDRESS`) as the redirect URL with each provider.
   That route also accepts the POST that Apple sends.
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

Caddy answers 404 itself for the admin dashboard (`/_/*`) and for a few `/api/*`
paths: the superuser and legacy admin routes, `/api/gsd/feedback-controls*`, and
`/api/oauth2-redirect*`. The `Caddyfile` has the full list.

Everything runs behind a single HTTPS origin, so there are no CORS or mixed-content issues.
The PocketBase admin dashboard is not exposed through the public app origin. To reach
it, publish PocketBase on localhost as the setup steps above show.
For custom domains, the app syncs with the same origin unless
`NEXT_PUBLIC_POCKETBASE_URL` is set when the app is built.

## Configuration

### Environment Variables

Set these under `environment` in `docker-compose.yml`. Compose passes only the
variables listed there, so add a line for any variable the file doesn't list yet.
`GSD_TASKS_ENC_KEY` is the exception: Compose reads it from `docker/.env` or your shell.

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

If you proxy PocketBase on a different origin instead of the same host, the static
app needs `NEXT_PUBLIC_POCKETBASE_URL` at build time. The `Dockerfile` declares no
`ARG` or `ENV` for it, and `.dockerignore` keeps `.env` files out of the build. So
this image always uses the same origin unless you edit the `Dockerfile`'s builder
stage to set the variable. The `Caddyfile` also sends `connect-src 'self'` in its
Content-Security-Policy header, so add the other origin there too, or the browser
blocks the requests.

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

The image pins PocketBase 0.40.4 and checks the download against a SHA-256 for
each CPU type. To build another version, override the version and both checksums.
A version alone fails the checksum step:

```bash
docker compose build \
  --build-arg POCKETBASE_VERSION=<version> \
  --build-arg POCKETBASE_SHA256_AMD64=<sha256 of the linux_amd64 zip> \
  --build-arg POCKETBASE_SHA256_ARM64=<sha256 of the linux_arm64 zip>
```

### Private npm Registry

If your npm registry needs sign-in, the build can read your `~/.npmrc` as a BuildKit
secret named `npmrc`. Uncomment both `secrets` blocks in `docker-compose.yml`: the
one under `build`, and the one at the end of the file.

## Data Persistence

PocketBase data (database, uploaded files) is stored in a Docker volume named `pb_data`. Your data survives container rebuilds.

The entrypoint runs migrations with automigration disabled before serving. You
don't choose a migration set; the entrypoint does. PocketBase records each file it
applies and doesn't run it again. A database that already has a `tasks` table
applies the files in `pb_migrations/`. A database with no `tasks` table applies the
same files, with the two in `pb_fresh_migrations/` taking the place of their
namesakes. There the encryption backfill does nothing, because there are no old
tasks to encrypt, and each migration that adds a `tasks` field skips the missing
collection. The setup script then creates the collection with every field. Never
edit a migration file that a database has already applied.

To back up, stop the stack first for a consistent SQLite copy, then copy the
volume out of the container:
```bash
docker compose stop
docker cp $(docker compose ps -aq gsd):/pb_data ./pb_backup
docker compose start
```
Back up `GSD_TASKS_ENC_KEY` separately; the database is unreadable without it.

To delete the database and start over (destroys all data in the `pb_data` volume):
```bash
docker compose down -v
```

## Sessions and Tokens

User tokens last 30 days (set by migration `1793562900_users_auth_token_30_days.js`,
on fresh and existing installs). On this image, **Sign out of all devices** in the
web app's sync dialog ends every session for the account, including
tokens copied into an MCP client (`pb_hooks/session_revoke.pb.js`).

## Tasks Collection Schema

`scripts/setup-pocketbase-collections.sh` creates the collection, and the migrations
in `docker/pb_migrations/` add later fields to an existing one. Together they are the
source of truth. Use the script rather than
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
| `notification_enabled` | Bool | | The web app sets true on a new task |
| `notification_sent` | Bool | | Default: false |
| `notify_before` | Number | | Minutes |
| `last_notification_at` | Text | | ISO timestamp |
| `estimated_minutes` | Number | | |
| `time_spent` | Number | | Minutes |
| `time_entries` | JSON | | Array of time entry objects |
| `saved_at` | Text | | ISO timestamp; empty when the task isn't Saved |
| `snoozed_until` | Text | | ISO timestamp |
| `focus_date` | Text | | Top three pick: the local date, `YYYY-MM-DD` |
| `focus_rank` | Number | | Top three pick: rank 1 to 3, or 0 when the task isn't a pick |
| `client_updated_at` | Text | | ISO timestamp (for LWW sync) |
| `client_created_at` | Text | | ISO timestamp |
| `device_id` | Text | | Originating device |

**Indexes**: `owner`; unique `(task_id, owner)`; `client_updated_at`.

**API Rules** (five, as the script sets them):
- `listRule`, `viewRule`, `createRule`, `deleteRule`: `@request.auth.id != "" && owner = @request.auth.id`
- `updateRule`: `@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = owner)`

## Troubleshooting

### Browser shows certificate warning
Expected with the default certificate, which Caddy's internal CA signs (`TLS_MODE=internal`). Click **Advanced → Proceed** (or equivalent). For a trusted local cert, use [mkcert](https://github.com/FiloSottile/mkcert) to generate certs and mount them as described above.

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
- `docker-entrypoint.sh` exits 1 on an invalid key, an invalid `TLS_MODE`, or a missing or unreadable certificate or key in `custom` mode. Its `cleanup` function exits 0. Under `set -e` the script also ends when `gsd_install_state` returns 1, when `gsd_build_fresh_migrations` fails, or when `pocketbase migrate up` fails.
- `docker-entrypoint.sh` runs in this order: validate the key, resolve `TLS_MODE`, source `migrations.sh`, call `gsd_install_state /pb_data`, run `pocketbase migrate up`, start `pocketbase serve`, wait for `/api/health`, start `caddy run`.
- `docker-compose.yml` defines one service, `gsd`, with ports `443:443` and `80:80`, the volume `pb_data:/pb_data`, and `restart: unless-stopped`. It sets `SITE_ADDRESS=localhost` in the service environment.
- `Caddyfile` reads the placeholders `SITE_ADDRESS`, `TLS_MODE`, `TLS_CERT`, and `TLS_KEY`. It imports `tls_internal`, `tls_public`, or `tls_custom`.
- `Caddyfile` proxies `/api/*` to `localhost:8090` and serves `/srv` for everything else, with `/index.html` as the fallback.
- `Caddyfile` sets these headers on every response: `Content-Security-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`. It removes `Server` and `X-Powered-By`.
- `Caddyfile` sets `Cache-Control` on static files: one year and `immutable` for `/_next/static/*`, and `no-cache, no-store, must-revalidate` for `*.html` and `/`.
- `Caddyfile` returns 404 for `/api/collections/_superusers/*`, the same collection by id, `/api/admins/*`, `/api/gsd/feedback-controls*`, `/api/oauth2-redirect*`, and `/_/*`.
- Subdirectories:
  - [lib](./lib/README.md): the shell library that picks the migration set.
  - [pb_hooks](./pb_hooks.md): the PocketBase hooks.
  - [pb_migrations](./pb_migrations.md): the shipped migrations.
  - [pb_fresh_migrations](./pb_fresh_migrations.md): the overlay for fresh installs.

### Invariants

- `docker-entrypoint.sh` refuses to start unless `GSD_TASKS_ENC_KEY` has exactly 32 characters.
- `docker-entrypoint.sh` accepts `internal`, `public`, and `custom` for `TLS_MODE`. An unset mode with both `TLS_CERT` and `TLS_KEY` set becomes `custom`.
- `docker-entrypoint.sh` passes `--automigrate=false` to both `pocketbase migrate up` and `pocketbase serve`. It uses the fresh overlay only when `gsd_install_state` prints `fresh`. It passes `--hooksDir=/pb_hooks` to both commands and `--publicDir=/pb_data/pb_public` to `pocketbase serve`.
- `docker-entrypoint.sh` waits up to 30 seconds for PocketBase. After that it prints a warning and starts Caddy anyway.
- `docker-compose.yml` uses `${GSD_TASKS_ENC_KEY:?...}`, so `docker compose up` fails when the variable is unset.
- `Dockerfile` accepts `amd64` or `arm64` for `TARGETARCH`. It checks the PocketBase archive with `sha256sum -c` against the checksum argument for that architecture.
- `Dockerfile` pins all three base images by digest.
- `Dockerfile` copies hooks and migrations outside `/pb_data`, so an existing volume cannot shadow them.
- `Caddyfile` sets `admin off`. Its deny rules are more specific than `/api/*`, so they take precedence.

### Side Effects

- `Dockerfile` (build time): runs `bun install --frozen-lockfile`, builds the static export, and downloads the PocketBase release archive from GitHub with `curl`.
- `Dockerfile` (build time): runs `apt-get update` and `apt-get install` for `unzip`, `curl`, and `ca-certificates`. The runtime stage runs `apk add --no-cache libcap sqlite`. `migrations.sh` calls `sqlite3` at runtime.
- `Dockerfile` (build time): runs `setcap cap_net_bind_service=+ep` on the `caddy` and `pocketbase` binaries.
- `docker-entrypoint.sh`: on a fresh install it writes the folder `${TMPDIR:-/tmp}/gsd-fresh-migrations-$$`.
- `docker-entrypoint.sh`: `pocketbase migrate up --dir=/pb_data` writes to the data volume. `pocketbase serve --http=0.0.0.0:8090` and `caddy run` start as background processes.
- `docker-entrypoint.sh:cleanup`: sends `kill` to both processes on `TERM`, `INT`, or `QUIT`. The script also calls it when either process exits on its own, so the container exits 0 after PocketBase or Caddy stops.
- `Caddyfile`: `tls internal` makes Caddy create a local certificate authority. The `public` mode makes outbound ACME requests.
- `docker-compose.yml`: keeps `/pb_data` in the named volume `pb_data`.

### Verification

- Run: `bun run test` (Vitest; `tests/docker-entrypoint.test.ts`, `tests/docker-migrations.test.ts`, and `tests/data/docker-context-imports.test.ts` cover this directory)
