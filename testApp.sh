#!/bin/zsh
#
# testApp.sh — Build the static export and serve it locally over HTTPS.
#
# Builds the Next.js static export (output: "export" -> out/) and serves it
# with live-server at https://dev.local:8080 so the PWA can be tested over TLS.
#
# Config can be overridden via environment variables:
#   HOST          hostname to bind          (default: dev.local)
#   PORT          port to bind              (default: 8080)
#   HTTPS_CONFIG  live-server HTTPS config  (default: ~/certs/https-config.js)
#
# Usage: ./testApp.sh

set -euo pipefail

# Resolve the repo root from this script's own location (:A = absolute, :h = dir)
# so it works no matter what directory it's invoked from.
readonly PROJECT_DIR="${0:A:h}"
readonly OUT_DIR="$PROJECT_DIR/out"
readonly HOST="${HOST:-dev.local}"
readonly PORT="${PORT:-8080}"
readonly HTTPS_CONFIG="${HTTPS_CONFIG:-$HOME/certs/https-config.js}"

die()  { print -u2 -- "error: $*"; exit 1; }
step() { print -- "==> $*"; }

# --- Preflight: fail early with an actionable message if anything is missing ---
command -v bun >/dev/null 2>&1 \
  || die "bun not found on PATH — install from https://bun.sh"

# Resolve live-server dynamically instead of hardcoding an install path.
live_server_bin="$(command -v live-server 2>/dev/null)" \
  || die "live-server not found on PATH — install with 'npm i -g live-server'"

[[ -f "$HTTPS_CONFIG" ]] \
  || die "HTTPS config not found: $HTTPS_CONFIG (override with HTTPS_CONFIG=/path/to/config.js)"

[[ -f "$PROJECT_DIR/package.json" ]] \
  || die "package.json not found in $PROJECT_DIR — is this the repo root?"

# --- Build the static export ---
step "Building static export in $PROJECT_DIR"
cd "$PROJECT_DIR" || die "cannot cd into $PROJECT_DIR"
bun run build     || die "build failed — not starting the server"

# The build wipes and regenerates out/; bail if it produced nothing to serve.
[[ -f "$OUT_DIR/index.html" ]] \
  || die "build produced no $OUT_DIR/index.html — nothing to serve"

# --- Serve (exec so Ctrl+C and signals go straight to live-server) ---
step "Serving $OUT_DIR at https://$HOST:$PORT  (Ctrl+C to stop)"
cd "$OUT_DIR" || die "cannot cd into $OUT_DIR"
exec "$live_server_bin" --https="$HTTPS_CONFIG" --host="$HOST" --port="$PORT"
