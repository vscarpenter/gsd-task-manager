#!/bin/sh
set -e

# Refuse to start without a valid encryption key (fail closed at boot, not just
# at first write).
if [ -z "$GSD_TASKS_ENC_KEY" ] || [ "${#GSD_TASKS_ENC_KEY}" -ne 32 ]; then
    echo "[gsd] FATAL: GSD_TASKS_ENC_KEY must be set to a 32-character key" >&2
    exit 1
fi

# Deployments predating TLS_MODE configure a certificate as a bare TLS_CERT and
# TLS_KEY pair, which is still what docker-compose.yml and docker-setup-and-run.md
# describe. Defaulting those to `internal` would quietly swap a trusted
# certificate for Caddy's private CA and break every OAuth callback, so an unset
# mode alongside both paths means custom.
if [ -z "${TLS_MODE:-}" ] && [ -n "${TLS_CERT:-}" ] && [ -n "${TLS_KEY:-}" ]; then
    TLS_MODE=custom
fi

TLS_MODE="${TLS_MODE:-internal}"
case "$TLS_MODE" in
    internal|public)
        ;;
    custom)
        if [ -z "${TLS_CERT:-}" ] || [ -z "${TLS_KEY:-}" ]; then
            echo "[gsd] FATAL: TLS_CERT and TLS_KEY are required when TLS_MODE=custom" >&2
            exit 1
        fi
        if [ ! -r "$TLS_CERT" ] || [ ! -r "$TLS_KEY" ]; then
            echo "[gsd] FATAL: custom TLS certificate or key is not readable" >&2
            exit 1
        fi
        ;;
    *)
        echo "[gsd] FATAL: TLS_MODE must be internal, public, or custom" >&2
        exit 1
        ;;
esac
export TLS_MODE
echo "[gsd] TLS mode: $TLS_MODE"

# ---------------------------------------------------------------------------
# GSD Task Manager — Container Entrypoint
# Starts PocketBase (background) and Caddy (foreground-ish), with clean
# shutdown on SIGTERM/SIGINT so Docker stop works gracefully.
# ---------------------------------------------------------------------------

cleanup() {
    echo "[gsd] Shutting down..."
    kill "$PB_PID"    2>/dev/null || true
    kill "$CADDY_PID" 2>/dev/null || true
    wait "$PB_PID" "$CADDY_PID" 2>/dev/null || true
    exit 0
}
trap cleanup TERM INT QUIT

# -- Start PocketBase ------------------------------------------------------
MIGRATIONS_DIR=/pb_migrations
TASKS_TABLE_EXISTS=0
if [ -f /pb_data/data.db ]; then
    TASKS_TABLE_EXISTS="$(sqlite3 /pb_data/data.db \
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tasks';" \
        2>/dev/null || echo 0)"
fi

if [ "$TASKS_TABLE_EXISTS" != "1" ]; then
    # The shipped backfill predates fresh-install handling and must remain
    # immutable for databases that already recorded it. A fresh database has
    # no legacy tasks, so apply a same-name no-op plus the forward remediation.
    MIGRATIONS_DIR="${TMPDIR:-/tmp}/gsd-fresh-migrations-$$"
    mkdir -p "$MIGRATIONS_DIR"
    cp /pb_fresh_migrations/1781000000_encrypt_existing_tasks.js "$MIGRATIONS_DIR/"
    cp /pb_migrations/1781100000_harden_task_encryption_cleanup.js "$MIGRATIONS_DIR/"
    cp /pb_migrations/1781200000_reencrypt_invalid_prefixed_task_fields.js "$MIGRATIONS_DIR/"
fi

echo "[gsd] Applying PocketBase migrations..."
/usr/local/bin/pocketbase migrate up \
    --dir=/pb_data \
    --hooksDir=/pb_hooks \
    --migrationsDir="$MIGRATIONS_DIR" \
    --automigrate=false

echo "[gsd] Starting PocketBase..."
/usr/local/bin/pocketbase serve \
    --http=0.0.0.0:8090 \
    --dir=/pb_data \
    --hooksDir=/pb_hooks \
    --migrationsDir="$MIGRATIONS_DIR" \
    --automigrate=false \
    --publicDir=/pb_data/pb_public &
PB_PID=$!

echo "[gsd] Waiting for PocketBase..."
for i in $(seq 1 30); do
    if wget -q --spider http://localhost:8090/api/health 2>/dev/null; then
        echo "[gsd] PocketBase is ready"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[gsd] Warning: PocketBase did not become ready in 30 s"
    fi
    sleep 1
done

# -- Start Caddy -----------------------------------------------------------
echo "[gsd] Starting Caddy..."
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

echo ""
echo "==========================================="
echo "  GSD Task Manager is running!"
echo "  App:   https://${SITE_ADDRESS:-localhost}"
echo "  Admin: not exposed on the public app origin"
echo "==========================================="
echo ""

# Wait for either process to exit, then tear everything down
wait "$PB_PID" "$CADDY_PID" 2>/dev/null || true
cleanup
