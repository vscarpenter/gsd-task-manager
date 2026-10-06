# =============================================================================
# GSD Task Manager — Self-Hosted Docker Image
# Multi-stage: Node builds the static site → Caddy + PocketBase runtime
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the Next.js static export
# ---------------------------------------------------------------------------
# Real Node runs `next build` here. The oven/bun image links `node` to Bun,
# and Bun 1.3.14 crashed while exiting after a successful build (exit 132).
# Copy only the Bun binary so `bun install` stays on Bun and `node` stays Node.
FROM node:24-trixie-slim@sha256:6950b66b4c0cb0151ce89fa75074673850763d096b044f422c6729b588dd4956 AS builder

COPY --from=oven/bun:1@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json bun.lock ./
COPY packages/mcp-server/package.json packages/mcp-server/

RUN --mount=type=secret,id=npmrc,target=/app/.npmrc,required=false \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# `bun run build` puts node_modules/.bin on PATH, but a RUN step does not.
# The static-export wrapper calls a bare `next`, so add the bin dir here.
ENV PATH="/app/node_modules/.bin:$PATH"

# Build static export (produces out/ directory)
RUN node scripts/generate-build-info.cjs \
    && node scripts/update-sw-version.cjs \
    && bash scripts/build-static-export.sh

# Download PocketBase in the Debian-based builder (avoids Alpine TLS issues)
ARG POCKETBASE_VERSION=0.40.4
ARG POCKETBASE_SHA256_AMD64=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa
ARG POCKETBASE_SHA256_ARM64=86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends unzip curl ca-certificates \
    && case "$TARGETARCH" in \
         amd64) PB_SHA256="$POCKETBASE_SHA256_AMD64" ;; \
         arm64) PB_SHA256="$POCKETBASE_SHA256_ARM64" ;; \
         *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
       esac \
    && curl -fsSL -o /tmp/pb.zip \
       "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" \
    && echo "$PB_SHA256  /tmp/pb.zip" | sha256sum -c - \
    && unzip /tmp/pb.zip -d /tmp/pb/ \
    && chmod +x /tmp/pb/pocketbase \
    && rm /tmp/pb.zip

# ---------------------------------------------------------------------------
# Stage 2: Runtime — Caddy (HTTPS reverse proxy) + PocketBase
# ---------------------------------------------------------------------------
FROM caddy:2-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648

# Run as non-root user for security
RUN addgroup -S gsd && adduser -S gsd -G gsd

# Copy PocketBase binary from builder
COPY --from=builder /tmp/pb/pocketbase /usr/local/bin/pocketbase

# Copy static site from builder
COPY --from=builder /app/out /srv

# Copy runtime configuration
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Encryption hook + backfill migration, baked into the image OUTSIDE the
# /pb_data volume so an existing named volume cannot shadow them.
COPY docker/pb_hooks/      /pb_hooks/
COPY docker/pb_migrations/ /pb_migrations/
COPY docker/pb_fresh_migrations/ /pb_fresh_migrations/

# Allow non-root to bind privileged ports (80, 443)
RUN apk add --no-cache libcap sqlite \
    && setcap cap_net_bind_service=+ep /usr/bin/caddy \
    && setcap cap_net_bind_service=+ep /usr/local/bin/pocketbase

# Create persistent data directories and grant ownership to non-root user
RUN mkdir -p /pb_data /certs /data/caddy /config/caddy \
    && chown -R gsd:gsd /pb_data /certs /srv /data/caddy /config/caddy

# 80  — HTTP (redirects to HTTPS)
# 443 — HTTPS (static site + PocketBase API via reverse proxy)
EXPOSE 80 443

VOLUME ["/pb_data"]

USER gsd

ENTRYPOINT ["/entrypoint.sh"]
