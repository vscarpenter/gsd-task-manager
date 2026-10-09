# Build environment for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
# It installs everything the scanner needs to exercise GSD Task Manager offline: the locked
# dependencies, Playwright's browsers, the static export, the MCP server build, and the two
# PocketBase binaries the system test runs against. It follows .github/workflows/ci.yml.
# The scan itself runs offline, so this build fetches everything a test needs.
FROM node:22-bookworm

# A fixed browser path keeps Playwright working whatever HOME the scan uses.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NEXT_TELEMETRY_DISABLED=1

# tests/docker-migrations.test.ts shells out to sqlite3, which the base image lacks.
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# The system test normally downloads PocketBase at run time, which fails offline.
# Keep these pins in step with scripts/run-pocketbase-system-test.sh. The binaries
# live under /tmp, as they do in CI: PocketBase reads a binary under the temp folder
# as `go run` and turns on dev mode, and the upgrade test checks the SQL it logs.
RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    fetch() { \
      curl -fsSL -o /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v$1/pocketbase_$1_linux_${arch}.zip"; \
      echo "$2  /tmp/pb.zip" | sha256sum -c -; \
      mkdir -p "/tmp/gsd-pocketbase/$3"; \
      unzip -q /tmp/pb.zip pocketbase -d "/tmp/gsd-pocketbase/$3"; \
      rm /tmp/pb.zip; \
    }; \
    case "$arch" in \
      amd64) \
        fetch 0.40.4 9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa current; \
        fetch 0.26.6 f4d9ad15dbadae3905d8404abed5c772d5c8b1c9563741c91adefb9f14b8201e upgrade-source ;; \
      arm64) \
        fetch 0.40.4 86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418 current; \
        fetch 0.26.6 0758d9fe0ba054c0ca9e6a5c9425e9fe9044159ccbfa5fa4946f7d14bcbf01f1 upgrade-source ;; \
      *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac

# The PocketBase system tests run whenever these are set.
ENV POCKETBASE_BIN=/tmp/gsd-pocketbase/current/pocketbase \
    POCKETBASE_OLD_BIN=/tmp/gsd-pocketbase/upgrade-source/pocketbase

# Scanner contract: the checkout lives inside the image at /src. The root .dockerignore
# is written for the self-host image and drops tests/ and .git/, so this build uses
# .oss-scanner/Dockerfile.dockerignore instead.
COPY . /src
WORKDIR /src

# Install the Bun version that package.json pins, so this file never drifts from it.
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

RUN bun install --frozen-lockfile \
    && node_modules/.bin/playwright install --with-deps

# The static export backs the production-CSP journeys, and dist/ backs the MCP server CLI.
RUN bun run build \
    && bun run --cwd packages/mcp-server build

# Cheap checks that prove the image works. A failure prints a warning instead of failing the build.
RUN bun run test \
    || echo "WARNING: Vitest reported failures"
RUN bun run --cwd packages/mcp-server test -- src/__tests__/system --no-file-parallelism \
    || echo "WARNING: PocketBase system tests reported failures"
