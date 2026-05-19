#!/bin/bash
#
# Thin wrapper: build, then deploy to production via scripts/deploy-app.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

npm run build

export S3_BUCKET="s3://gsd.vinny.dev"
export CLOUDFRONT_ID="E1T6GDX0TQEP94"
export ENV_LABEL="Production"
export SITE_URL="https://gsd.vinny.dev"

exec "$SCRIPT_DIR/deploy-app.sh"
