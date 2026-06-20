# Docker Setup & Run Guide

Step-by-step instructions for building and running GSD Task Manager locally with Docker.

## Prerequisites

### 1. Install Docker Desktop

```bash
brew install --cask docker
```

Launch Docker Desktop from Applications and wait for the whale icon in the menu bar to show "running".

### 2. Verify Docker is available

```bash
docker --version
docker compose version
```

Both commands should print version information without errors.

## Build & Run

```bash
cd docker
docker compose up --build
```

The first build takes a few minutes (bun install + Next.js build + PocketBase download). Subsequent builds use Docker layer caching and are much faster.

Once ready you'll see:

```
===========================================
  GSD Task Manager is running!
  App:   https://localhost
  Admin: not exposed on the public app origin
===========================================
```

## Task encryption key (required)

Task content is encrypted at rest on the server. Generate a 32-character key once:

    openssl rand -hex 16        # 32 hex chars

Put it in a gitignored `.env` beside the compose file (`GSD_TASKS_ENC_KEY=...`) or
your secret manager. **Back it up separately from the database** — a database
backup is useless without this key, and a lost key makes encrypted data
unrecoverable. The container refuses to start if the key is missing or not 32 chars.

## First-Time PocketBase Setup

PocketBase starts with no collections or admin account. Complete these steps once:

1. Create or update a PocketBase superuser inside the container:
   ```bash
   docker compose exec gsd pocketbase superuser upsert admin@example.com 'change-this-password' --dir=/pb_data
   ```
2. Set up the **tasks** collection via the setup script from the repo root:
   ```bash
   PB_URL=https://localhost \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD='change-this-password' \
   ./scripts/setup-pocketbase-collections.sh
   ```
3. To use the admin UI, temporarily publish PocketBase on localhost only:
   ```yaml
   ports:
     - "443:443"
     - "80:80"
     - "127.0.0.1:8090:8090"
   ```
   Restart, open **http://127.0.0.1:8090/_/**, then remove the port mapping when setup is complete.
4. Optionally configure OAuth providers under **Settings → Auth providers** in the local admin dashboard.

## Test the App

Open **https://localhost** in your browser. You'll see a self-signed certificate warning — click **Advanced → Proceed to localhost** (or equivalent). The full app should load with sync pointed at the local PocketBase instance.

### Verify the Reverse Proxy

Confirm the single-origin setup works by running these from a terminal:

```bash
# Static site responds
curl -ks https://localhost/ | head -5

# PocketBase API responds on same origin
curl -ks https://localhost/api/health

# PocketBase admin is not exposed on the app origin
curl -ks -o /dev/null -w "%{http_code}" https://localhost/_/
```

The static site and API should return `200` from the same `https://localhost` origin. The admin check should return `404` unless you temporarily publish `127.0.0.1:8090:8090`.

## Useful Commands

| Command | Purpose |
|---|---|
| `docker compose up --build` | Build and start (foreground, shows logs) |
| `docker compose up --build -d` | Build and start in background |
| `docker compose logs -f` | Follow logs when running detached |
| `docker compose down` | Stop and remove container (data preserved) |
| `docker compose down -v` | Stop and **delete all PocketBase data** |
| `docker compose build --no-cache` | Force full rebuild (skip layer cache) |

> **Note:** Run all `docker compose` commands from the `docker/` directory.

## Trusted Local Certificates (Optional)

By default Caddy generates a self-signed certificate, which causes browser warnings. To eliminate them, use [mkcert](https://github.com/FiloSottile/mkcert):

### 1. Install mkcert and create a local CA

```bash
brew install mkcert
mkcert -install
```

### 2. Generate certificates for localhost

```bash
mkdir -p docker/certs
mkcert -cert-file docker/certs/cert.pem -key-file docker/certs/key.pem localhost
```

### 3. Configure docker-compose.yml

Uncomment the certificate lines in `docker-compose.yml`:

```yaml
volumes:
  - pb_data:/pb_data
  - ./certs:/certs:ro           # ← uncomment this line

environment:
  - SITE_ADDRESS=localhost
  - TLS_CERT=/certs/cert.pem   # ← uncomment this line
  - TLS_KEY=/certs/key.pem     # ← uncomment this line
```

### 4. Restart

```bash
docker compose up --build
```

No more certificate warnings — the browser trusts the mkcert-issued certificate.

## Custom PocketBase Version

Override the default PocketBase version at build time:

```bash
docker compose build --build-arg POCKETBASE_VERSION=0.26.9
```

## Data Persistence & Backups

PocketBase data (database, uploaded files) is stored in a Docker volume named `pb_data`. Data survives container rebuilds.

### Back up data

```bash
docker cp $(docker compose ps -q gsd):/pb_data ./pb_backup
```

### Reset all data

```bash
docker compose down -v
```

> **Warning:** This permanently deletes all PocketBase data including tasks, users, and settings.

## Troubleshooting

### Browser shows certificate warning

Expected with self-signed certificates. Click **Advanced → Proceed** (or equivalent). For trusted certs, follow the mkcert instructions above.

### Port 443 already in use

Change the host port mapping in `docker-compose.yml`:

```yaml
ports:
  - "8443:443"
```

Then access the app at `https://localhost:8443`.

### PocketBase admin not loading

The admin dashboard is not exposed through `https://localhost/_/` by default. Temporarily add `127.0.0.1:8090:8090` to `ports`, restart, and open `http://127.0.0.1:8090/_/`. If the local port still does not respond, wait a few seconds after container start and check logs:

```bash
docker compose logs -f
```

### OAuth not working

OAuth providers must be configured in PocketBase admin (**Settings → Auth providers**). The redirect URL should be `https://localhost/api/oauth2-redirect` (or your custom `SITE_ADDRESS`).

### Build fails during `bun install`

Make sure Docker Desktop has sufficient resources allocated (at least 4 GB RAM). Check **Docker Desktop → Settings → Resources**.
