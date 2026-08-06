#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURRENT_POCKETBASE_VERSION="0.39.10"
UPGRADE_SOURCE_VERSION="0.26.6"
SYSTEM_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/gsd-pocketbase-system.XXXXXX")"

cleanup() {
  case "$SYSTEM_ROOT" in
    "${TMPDIR:-/tmp}"/gsd-pocketbase-system.*) rm -rf "$SYSTEM_ROOT" ;;
    *) echo "Refusing to remove unexpected system-test path: $SYSTEM_ROOT" >&2 ;;
  esac
}
trap cleanup EXIT

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    PLATFORM="linux_amd64"
    CURRENT_SHA256="67f68c8041dbb6a35fd7af5997ffc5063a7a7b96bf9df810360788f9e9975408"
    UPGRADE_SOURCE_SHA256="f4d9ad15dbadae3905d8404abed5c772d5c8b1c9563741c91adefb9f14b8201e"
    ;;
  Linux-aarch64|Linux-arm64)
    PLATFORM="linux_arm64"
    CURRENT_SHA256="5bad497eaf2522418673eacfcc90e75106036f19b4aeeac6e59bc48503c01ddf"
    UPGRADE_SOURCE_SHA256="0758d9fe0ba054c0ca9e6a5c9425e9fe9044159ccbfa5fa4946f7d14bcbf01f1"
    ;;
  Darwin-arm64)
    PLATFORM="darwin_arm64"
    CURRENT_SHA256="6b58246406274f66bb1ada518f19f8067d31f5fd47781144c0c863e98699b149"
    UPGRADE_SOURCE_SHA256="811d6d28f8d4c21f1a42021b9ec1bf022dcd4fd0dd52b3d33b489e9b866c156f"
    ;;
  Darwin-x86_64)
    PLATFORM="darwin_amd64"
    CURRENT_SHA256="8c8fcaa6e9315d8453bdac0c55d6def22933e103ad2da3a5063de87d3210f49c"
    UPGRADE_SOURCE_SHA256="27a63132efe1ef7c13bcb693e6395435a7e1e673952aa7aefdf08aa8ac1ffc6a"
    ;;
  *)
    echo "Unsupported system-test platform: $(uname -s)-$(uname -m)" >&2
    exit 1
    ;;
esac

download_pocketbase() {
  local version="$1"
  local expected_sha256="$2"
  local destination="$3"
  local archive="pocketbase_${version}_${PLATFORM}.zip"

  curl -fsSL -o "$SYSTEM_ROOT/$archive" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${version}/$archive"

  if command -v sha256sum >/dev/null 2>&1; then
    echo "$expected_sha256  $SYSTEM_ROOT/$archive" | sha256sum -c -
  else
    local actual_sha256
    actual_sha256="$(shasum -a 256 "$SYSTEM_ROOT/$archive" | awk '{print $1}')"
    if [[ "$actual_sha256" != "$expected_sha256" ]]; then
      echo "PocketBase $version archive checksum mismatch." >&2
      exit 1
    fi
  fi

  mkdir -p "$destination"
  unzip -q "$SYSTEM_ROOT/$archive" pocketbase -d "$destination"
  chmod +x "$destination/pocketbase"
}

download_pocketbase "$CURRENT_POCKETBASE_VERSION" "$CURRENT_SHA256" "$SYSTEM_ROOT/current"
download_pocketbase "$UPGRADE_SOURCE_VERSION" "$UPGRADE_SOURCE_SHA256" "$SYSTEM_ROOT/upgrade-source"

cd "$REPO_ROOT"
POCKETBASE_BIN="$SYSTEM_ROOT/current/pocketbase" \
  POCKETBASE_OLD_BIN="$SYSTEM_ROOT/upgrade-source/pocketbase" \
  bun run --cwd packages/mcp-server test -- src/__tests__/system --no-file-parallelism
