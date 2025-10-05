#!/bin/bash

# Update CloudFront Security Headers Script
# This script attaches the security headers policy to your CloudFront distribution

set -e  # Exit on any error

# Configuration
DISTRIBUTION_ID="E1T6GDX0TQEP94"
POLICY_ID="25fb874b-5507-4752-bace-63174109ead5"

echo "=========================================="
echo "CloudFront Security Headers Update"
echo "=========================================="
echo ""
echo "Distribution ID: $DISTRIBUTION_ID"
echo "Policy ID: $POLICY_ID"
echo ""

# Step 1: Get current distribution configuration and ETag
echo "Step 1: Fetching current distribution configuration..."
ETAG=$(aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --query 'ETag' \
  --output text)

echo "  ✓ ETag retrieved: $ETAG"

# Get the full distribution config
aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --output json > /tmp/dist-config-full.json

# Step 2: Extract just the DistributionConfig (without ETag wrapper)
echo ""
echo "Step 2: Extracting distribution configuration..."
jq '.DistributionConfig' /tmp/dist-config-full.json > /tmp/dist-config.json
echo "  ✓ Configuration extracted"

# Step 3: Add the ResponseHeadersPolicyId to DefaultCacheBehavior
echo ""
echo "Step 3: Adding security headers policy to default cache behavior..."
jq --arg policy_id "$POLICY_ID" \
  '.DefaultCacheBehavior.ResponseHeadersPolicyId = $policy_id' \
  /tmp/dist-config.json > /tmp/dist-config-updated.json

echo "  ✓ Policy ID added: $POLICY_ID"

# Step 4: Show what will be updated (optional - comment out if you don't want to see this)
echo ""
echo "Step 4: Preview of changes..."
echo "  Current ResponseHeadersPolicyId:"
jq -r '.DefaultCacheBehavior.ResponseHeadersPolicyId // "  (not set)"' /tmp/dist-config.json
echo "  New ResponseHeadersPolicyId:"
jq -r '.DefaultCacheBehavior.ResponseHeadersPolicyId' /tmp/dist-config-updated.json

# Step 5: Confirm before proceeding
echo ""
read -p "Do you want to proceed with the update? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Update cancelled."
  exit 0
fi

# Step 6: Update the distribution
echo ""
echo "Step 5: Updating CloudFront distribution..."
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/dist-config-updated.json \
  --output json > /tmp/update-result.json

echo "  ✓ Distribution updated successfully"

# Step 7: Create invalidation to clear cache
echo ""
echo "Step 6: Creating cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "  ✓ Invalidation created: $INVALIDATION_ID"

# Cleanup temp files
echo ""
echo "Step 7: Cleaning up temporary files..."
rm -f /tmp/dist-config-full.json /tmp/dist-config.json /tmp/dist-config-updated.json /tmp/update-result.json
echo "  ✓ Cleanup complete"

# Summary
echo ""
echo "=========================================="
echo "✅ Update Complete!"
echo "=========================================="
echo ""
echo "Security headers policy has been attached to your distribution."
echo ""
echo "⏱️  Deployment Status:"
echo "  The changes are now deploying across CloudFront's edge locations."
echo "  This typically takes 15-30 minutes."
echo ""
echo "📊 Check deployment status:"
echo "  aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
echo "🔍 Verify headers after deployment:"
echo "  curl -I https://gsd.vinny.dev | grep -i 'permissions-policy\\|strict-transport\\|x-frame'"
echo ""
echo "Or test with online tools:"
echo "  - https://securityheaders.com/?q=https://gsd.vinny.dev"
echo "  - https://observatory.mozilla.org/analyze/gsd.vinny.dev"
echo ""
