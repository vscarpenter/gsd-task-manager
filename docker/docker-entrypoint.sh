#!/bin/sh
set -e

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
echo "[gsd] Starting PocketBase..."
/usr/local/bin/pocketbase serve \
    --http=0.0.0.0:8090 \
    --dir=/pb_data \
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
echo "  Admin: https://${SITE_ADDRESS:-localhost}/_/"
echo "==========================================="
echo ""

# Wait for either process to exit, then tear everything down
wait "$PB_PID" "$CADDY_PID" 2>/dev/null || true
cleanup
