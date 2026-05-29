# Self-Hosted GSD Task Manager (Docker)

Run the full GSD Task Manager stack locally — static PWA, PocketBase sync backend, and HTTPS — in a single container.

## Quick Start

```bash
cd docker
docker compose up --build
```

Open **https://localhost** (accept the self-signed certificate warning on first visit).

### First-Time PocketBase Setup

PocketBase starts with no collections or admin account. Complete these steps once:

1. Create or update a PocketBase superuser inside the container:
   ```bash
   docker compose exec gsd pocketbase superuser upsert admin@example.com 'change-this-password' --dir=/pb_data
   ```
2. Create the **tasks** collection from outside the container:
   ```bash
   PB_URL=https://localhost \
   PB_ADMIN_EMAIL=admin@example.com \
   PB_ADMIN_PASSWORD='change-this-password' \
   ../scripts/setup-pocketbase-collections.sh
   ```
3. If you need the PocketBase admin dashboard, temporarily publish it on localhost only:
   ```yaml
   ports:
     - "443:443"
     - "80:80"
     - "127.0.0.1:8090:8090"
   ```
   Then open **http://127.0.0.1:8090/_/** and remove the port mapping when setup is complete.
4. Go to **Settings → Auth providers** in the local admin dashboard to configure OAuth (Google, GitHub) if desired.

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
| `TLS_CERT` | `internal` | Path to TLS cert **or** `internal` for self-signed |
| `TLS_KEY` | *(empty)* | Path to TLS private key (omit for self-signed) |

If you proxy PocketBase on a different origin instead of the same host, set
`NEXT_PUBLIC_POCKETBASE_URL` at build time so the static app can target the
correct backend.

### Custom SSL Certificates

1. Place your certificate and key in `docker/certs/`:
   ```
   docker/certs/cert.pem
   docker/certs/key.pem
   ```
2. Uncomment the volumes and environment lines in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./certs:/certs:ro
   environment:
     - TLS_CERT=/certs/cert.pem
     - TLS_KEY=/certs/key.pem
   ```
3. Restart: `docker compose up -d`

### Automatic Let's Encrypt (Public Domain)

If you have a public domain pointing to your server:

```yaml
environment:
  - SITE_ADDRESS=gsd.example.com
  # No TLS_CERT/TLS_KEY needed — Caddy handles ACME automatically
```

Caddy will obtain and renew certificates from Let's Encrypt automatically.

### Custom PocketBase Version

Override the default PocketBase version at build time:

```bash
docker compose build --build-arg POCKETBASE_VERSION=0.26.9
```

## Data Persistence

PocketBase data (database, uploaded files) is stored in a Docker volume named `pb_data`. Your data survives container rebuilds.

To back up:
```bash
docker compose exec gsd cp -r /pb_data /backup
# or copy out of the volume:
docker cp $(docker compose ps -q gsd):/pb_data ./pb_backup
```

To reset (destroys all data):
```bash
docker compose down -v
```

## Tasks Collection Schema

If setting up PocketBase manually via the admin UI, create a collection named **tasks** with these fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | Text | ✓ | |
| `description` | Text | | |
| `urgent` | Bool | | Default: false |
| `important` | Bool | | Default: false |
| `quadrant` | Text | | |
| `completed` | Bool | | Default: false |
| `completed_at` | Text | | ISO timestamp |
| `due_date` | Text | | ISO timestamp |
| `recurrence` | Text | | none, daily, weekly, monthly |
| `tags` | JSON | | Array of strings |
| `subtasks` | JSON | | Array of subtask objects |
| `dependencies` | JSON | | Array of task IDs |
| `notification_sent` | Bool | | Default: false |
| `notify_before` | Number | | Minutes |
| `last_notification_at` | Text | | ISO timestamp |
| `snoozed_until` | Text | | ISO timestamp |
| `estimated_minutes` | Number | | |
| `time_spent` | Number | | Minutes |
| `time_entries` | JSON | | Array of time entry objects |
| `client_updated_at` | Text | | ISO timestamp (for LWW sync) |
| `device_id` | Text | | Originating device |
| `owner` | Text | ✓ | User ID |

**API Rules** (all four): `@request.auth.id != "" && owner = @request.auth.id`

## Troubleshooting

### Browser shows certificate warning
Expected with self-signed certificates. Click **Advanced → Proceed** (or equivalent). For a trusted local cert, use [mkcert](https://github.com/FiloSottile/mkcert) to generate certs and mount them as described above.

### Port 443 already in use
Change the host port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8443:443"
```
Then access `https://localhost:8443`.

### PocketBase admin not loading
The admin dashboard is not exposed through `https://localhost/_/` by default. Temporarily add `127.0.0.1:8090:8090` to `ports`, restart, and open `http://127.0.0.1:8090/_/`. Remove that port mapping when setup is complete. If the local port still does not respond, wait a few seconds after container start and check logs with `docker compose logs -f`.

### OAuth not working
OAuth providers must be configured in PocketBase admin (**Settings → Auth providers**). The redirect URL should be `https://localhost/api/oauth2-redirect` (or your custom `SITE_ADDRESS`).
