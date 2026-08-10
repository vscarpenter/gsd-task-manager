#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Generated immediately before this wrapper by the package build command.
# shellcheck disable=SC1091
source .build-env.sh

# Keep the dependency's noisy freshness warning out of build logs while
# preserving `next build`'s exit status through the pipeline.
next build 2>&1 | grep -v baseline-browser-mapping

if [[ ! -s out/index.html ]]; then
  echo "Static export failed: out/index.html was not produced." >&2
  exit 1
fi

# Next's static App Router export includes executable hydration/RSC blocks in
# HTML. Move them to hashed same-origin files so production can enforce
# `script-src 'self'` without nonces or unsafe-inline.
node scripts/externalize-inline-assets.cjs out
