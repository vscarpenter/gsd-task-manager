#!/bin/bash
#
# Thin wrapper: clean, build, then deploy to development via scripts/deploy-app.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

npm run clean
npm run build

export S3_BUCKET="s3://gsd-dev.vinny.dev"
export CLOUDFRONT_ID="E1HY1IKF5GT513"
export ENV_LABEL="Development"
export SITE_URL="https://gsd-dev.vinny.dev"

exec "$SCRIPT_DIR/deploy-app.sh"
