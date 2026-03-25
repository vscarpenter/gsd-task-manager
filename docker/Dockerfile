# =============================================================================
# GSD Task Manager — Self-Hosted Docker Image
# Multi-stage: bun builds the static site → Caddy + PocketBase runtime
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the Next.js static export
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/mcp-server/package.json packages/mcp-server/

# If behind a corporate proxy, mount host .npmrc via BuildKit secret (see README.md)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc,required=false \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# Build static export (produces out/ directory)
RUN node scripts/generate-build-info.js \
    && bash -c 'source .build-env.sh && bunx --bun next build'

# Download PocketBase in the Debian-based builder (avoids Alpine TLS issues)
ARG POCKETBASE_VERSION=0.24.4
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends unzip curl ca-certificates \
    && curl -fsSL -o /tmp/pb.zip \
       "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" \
    && unzip /tmp/pb.zip -d /tmp/pb/ \
    && chmod +x /tmp/pb/pocketbase \
    && rm /tmp/pb.zip

# ---------------------------------------------------------------------------
# Stage 2: Runtime — Caddy (HTTPS reverse proxy) + PocketBase
# ---------------------------------------------------------------------------
FROM caddy:2-alpine

# Copy PocketBase binary from builder
COPY --from=builder /tmp/pb/pocketbase /usr/local/bin/pocketbase

# Copy static site from builder
COPY --from=builder /app/out /srv

# Copy runtime configuration
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create persistent data directories
RUN mkdir -p /pb_data /certs

# 80  — HTTP (redirects to HTTPS)
# 443 — HTTPS (static site + PocketBase API via reverse proxy)
EXPOSE 80 443

VOLUME ["/pb_data"]

ENTRYPOINT ["/entrypoint.sh"]
