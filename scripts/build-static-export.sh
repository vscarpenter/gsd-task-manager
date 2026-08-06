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
