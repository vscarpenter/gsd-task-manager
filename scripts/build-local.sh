#!/bin/bash
set -euo pipefail

export NEXT_DISABLE_SWC_BINARY=1
export NEXT_CACHE_DIR="$(pwd)/.next-cache"
rm -rf .next-cache .next out
mkdir -p .next-cache

npm run build
