#!/bin/bash
#
# Deploy the existing static export in out/ to a target environment.
#
# Builds are NOT performed here. CI builds once and promotes the same
# artifact across environments; local wrappers (deploy-dev.sh, deploy-prod.sh)
# handle the build step before calling this script.
#
# Required env vars:
#   S3_BUCKET       e.g. s3://gsd.vinny.dev
#   CLOUDFRONT_ID   e.g. E1T6GDX0TQEP94
#   ENV_LABEL       e.g. Production
#   SITE_URL        e.g. https://gsd.vinny.dev

set -euo pipefail

: "${S3_BUCKET:?Required env var S3_BUCKET (e.g. s3://gsd.vinny.dev)}"
: "${CLOUDFRONT_ID:?Required env var CLOUDFRONT_ID}"
: "${ENV_LABEL:?Required env var ENV_LABEL (e.g. Production)}"
: "${SITE_URL:?Required env var SITE_URL}"

# Disable AWS CLI pager so this is safe to run in CI / non-tty contexts.
export AWS_PAGER=""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

BUILD_DIR="out"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  GSD Task Manager — Deploy to ${ENV_LABEL}${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if [ ! -d "$BUILD_DIR" ]; then
  echo -e "${RED}✗ Error: Build directory '$BUILD_DIR' not found${NC}" >&2
  echo "Run 'bun run build' (or 'npm run build') before deploying." >&2
  exit 1
fi

echo -e "${BLUE}[1/3]${NC} Syncing to S3 (${S3_BUCKET})..."

echo "  → Syncing static assets (JS, CSS, images)..."
aws s3 sync "$BUILD_DIR/" "$S3_BUCKET/" \
  --delete \
  --exclude "*.html" \
  --exclude "sw.js" \
  --exclude "sw-cache-logic.js" \
  --cache-control "public,max-age=31536000,immutable"

echo "  → Syncing HTML files and service worker..."
aws s3 sync "$BUILD_DIR/" "$S3_BUCKET/" \
  --exclude "*" \
  --include "*.html" \
  --include "sw.js" \
  --include "sw-cache-logic.js" \
  --cache-control "public,max-age=0,must-revalidate"

echo "  → Forcing no-cache on index.html..."
aws s3 cp "$S3_BUCKET/index.html" "$S3_BUCKET/index.html" \
  --metadata-directive REPLACE \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo "  → Fixing Content-Type on agent-discovery files..."
"$SCRIPT_DIR/fix-discovery-content-types.sh" "$S3_BUCKET"

echo -e "${GREEN}✓${NC} Synced to S3"
echo ""

echo -e "${BLUE}[2/3]${NC} Invalidating CloudFront cache (${CLOUDFRONT_ID})..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)
echo -e "${GREEN}✓${NC} Invalidation created: ${INVALIDATION_ID}"
echo ""

# Expose the invalidation ID to GitHub Actions so the calling workflow can
# wait on it before running the smoke test. No-op outside CI.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "invalidation_id=${INVALIDATION_ID}" >> "$GITHUB_OUTPUT"
fi

echo -e "${BLUE}[3/3]${NC} Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Environment:   ${GREEN}${ENV_LABEL}${NC}"
echo -e "S3 Bucket:     ${S3_BUCKET}"
echo -e "CloudFront:    ${CLOUDFRONT_ID}"
echo -e "Invalidation:  ${INVALIDATION_ID}"
echo -e "URL:           ${GREEN}${SITE_URL}${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Deployment to ${ENV_LABEL} complete!${NC}"
echo ""
echo "CloudFront invalidation may take 1-2 minutes to propagate."
echo "Check status: aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"
