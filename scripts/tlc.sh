#!/usr/bin/env bash
# Runs the TLC model checker on one TLA+ spec with a pinned, hash-checked
# tla2tools.jar, so every verify skill gets the same checker on every machine.
#
# Usage: bash scripts/tlc.sh SPEC.tla CONFIG.cfg
#
# Exit status is TLC's own: 0 when every rule holds, 12 when an invariant
# breaks, 11 on a deadlock, 13 when a temporal property breaks, 150 and up when
# the spec or config does not parse.
#
# Environment:
#   JAVA       a Java 11+ binary (default: java_home's 21, then java on PATH)
#   GSD_TLC_CACHE  where the jar is kept (default: ~/.cache/gsd-tlc)
set -euo pipefail

readonly TLA_VERSION="1.7.4"
readonly TLA_SHA256="936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
readonly TLA_URL="https://github.com/tlaplus/tlaplus/releases/download/v${TLA_VERSION}/tla2tools.jar"

die() {
  echo "tlc.sh: $*" >&2
  exit 2
}

[ "$#" -eq 2 ] || die "usage: bash scripts/tlc.sh SPEC.tla CONFIG.cfg"
spec="$1"
config="$2"
[ -f "$spec" ] || die "no spec at $spec"
[ -f "$config" ] || die "no config at $config"

sha256_of() {
  shasum -a 256 "$1" | cut -d' ' -f1
}

ensure_jar() {
  local cache="${GSD_TLC_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/gsd-tlc}"
  local jar="$cache/tla2tools-${TLA_VERSION}.jar"
  if [ ! -f "$jar" ]; then
    mkdir -p "$cache"
    echo "tlc.sh: downloading tla2tools ${TLA_VERSION}" >&2
    curl -fsSL -o "$jar.part" "$TLA_URL"
    mv "$jar.part" "$jar"
  fi
  # Check the hash on every run: a cached jar that changed is not the pinned checker.
  [ "$(sha256_of "$jar")" = "$TLA_SHA256" ] || die "$jar does not match the pinned sha256"
  printf '%s' "$jar"
}

find_java() {
  if [ -n "${JAVA:-}" ]; then
    printf '%s' "$JAVA"
  elif [ -x /usr/libexec/java_home ] && /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    printf '%s/bin/java' "$(/usr/libexec/java_home -v 21)"
  elif command -v java >/dev/null 2>&1; then
    command -v java
  else
    die "no Java found; set JAVA to a Java 11+ binary"
  fi
}

jar="$(ensure_jar)"
java_bin="$(find_java)"
spec_dir="$(cd "$(dirname "$spec")" && pwd)"
config_abs="$(cd "$(dirname "$config")" && pwd)/$(basename "$config")"

# TLC writes its state files to -metadir; keep them out of the repo.
metadir="$(mktemp -d "${TMPDIR:-/tmp}/gsd-tlc.XXXXXX")"
trap 'rm -rf "$metadir"' EXIT

# Run from the spec's folder so modules it EXTENDS from that folder resolve.
cd "$spec_dir"
set +e
"$java_bin" -XX:+UseParallelGC -cp "$jar" tlc2.TLC \
  -workers 1 -metadir "$metadir" -config "$config_abs" "$(basename "$spec")"
status=$?
set -e
exit "$status"
