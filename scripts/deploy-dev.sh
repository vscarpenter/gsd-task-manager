#!/bin/bash
set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
S3_BUCKET="s3://gsd-dev.vinny.dev"
CLOUDFRONT_ID="E1HY1IKF5GT513"
BUILD_DIR="out"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  GSD Task Manager - Deploy to Development${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Step 1: Clean previous build
echo -e "${BLUE}[1/5]${NC} Cleaning previous build..."
npm run clean
echo -e "${GREEN}✓${NC} Cleaned"
echo ""

# Step 2: Build the application
echo -e "${BLUE}[2/5]${NC} Building application..."
npm run build
echo -e "${GREEN}✓${NC} Built"
echo ""

# Step 3: Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
  echo -e "${RED}✗ Error: Build directory '$BUILD_DIR' not found${NC}"
  echo "Make sure 'npm run build' completed successfully"
  exit 1
fi

# Step 4: Sync to S3
echo -e "${BLUE}[3/5]${NC} Syncing to S3 (${S3_BUCKET})..."

# Sync non-HTML files with long cache (1 year)
echo "  → Syncing static assets (JS, CSS, images)..."
aws s3 sync "$BUILD_DIR/" "$S3_BUCKET/" \
  --delete \
  --exclude "*.html" \
  --exclude "sw.js" \
  --cache-control "public,max-age=31536000,immutable"

# Sync HTML files and service worker with no cache
echo "  → Syncing HTML files and service worker..."
aws s3 sync "$BUILD_DIR/" "$S3_BUCKET/" \
  --exclude "*" \
  --include "*.html" \
  --include "sw.js" \
  --cache-control "public,max-age=0,must-revalidate"

# Force no-cache on index.html
echo "  → Forcing no-cache on index.html..."
aws s3 cp "$S3_BUCKET/index.html" "$S3_BUCKET/index.html" \
  --metadata-directive REPLACE \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

echo -e "${GREEN}✓${NC} Synced to S3"
echo ""

# Step 5: Invalidate CloudFront cache
echo -e "${BLUE}[4/5]${NC} Invalidating CloudFront cache (${CLOUDFRONT_ID})..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo -e "${GREEN}✓${NC} Invalidation created: ${INVALIDATION_ID}"
echo ""

# Step 6: Display summary
echo -e "${BLUE}[5/5]${NC} Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Environment:   ${GREEN}Development${NC}"
echo -e "S3 Bucket:     ${S3_BUCKET}"
echo -e "CloudFront:    ${CLOUDFRONT_ID}"
echo -e "Invalidation:  ${INVALIDATION_ID}"
echo -e "URL:           ${GREEN}https://gsd-dev.vinny.dev${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Deployment to development complete!${NC}"
echo ""
echo "Note: CloudFront invalidation may take 1-2 minutes to complete."
echo "You can check the status with:"
echo "  aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"
echo ""
