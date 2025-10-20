#!/bin/bash

# Setup CloudFront to proxy /api/* requests to Cloudflare Worker
# This allows the PWA to make same-origin API calls (gsd.vinny.dev/api/*)
# which are then forwarded to the worker

set -e

DISTRIBUTION_ID="E1T6GDX0TQEP94"
WORKER_DOMAIN="gsd-sync-worker-production.vscarpenter.workers.dev"
ORIGIN_ID="gsd-sync-worker-production"

echo "=================================================="
echo "CloudFront API Proxy Setup"
echo "=================================================="
echo ""
echo "This script will configure CloudFront to proxy API requests:"
echo "  https://gsd.vinny.dev/api/* → https://$WORKER_DOMAIN"
echo ""
echo "Distribution: $DISTRIBUTION_ID"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Fetching current CloudFront configuration..."
CONFIG_FILE="/tmp/cloudfront-config-$$.json"
ETAG_FILE="/tmp/cloudfront-etag-$$.txt"

aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --query 'DistributionConfig' \
  > "$CONFIG_FILE"

aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --query 'ETag' \
  --output text \
  > "$ETAG_FILE"

ETAG=$(cat "$ETAG_FILE")
echo "✓ Configuration fetched (ETag: $ETAG)"

echo ""
echo "Step 2: Checking if worker origin already exists..."
ORIGIN_EXISTS=$(jq ".Origins.Items[] | select(.Id == \"$ORIGIN_ID\") | .Id" "$CONFIG_FILE" | wc -l)

if [ "$ORIGIN_EXISTS" -gt 0 ]; then
    echo "⚠ Worker origin already exists, skipping origin creation"
else
    echo "Adding worker as new origin..."

    # Add worker origin to the Origins array
    jq --arg domain "$WORKER_DOMAIN" --arg id "$ORIGIN_ID" '
      .Origins.Items += [{
        "Id": $id,
        "DomainName": $domain,
        "OriginPath": "",
        "CustomHeaders": {
          "Quantity": 0
        },
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {
          "Enabled": false
        }
      }] |
      .Origins.Quantity = (.Origins.Items | length)
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

    echo "✓ Worker origin added"
fi

echo ""
echo "Step 3: Checking if /api/* behavior already exists..."
BEHAVIOR_EXISTS=$(jq '.CacheBehaviors.Items[]? | select(.PathPattern == "/api/*") | .PathPattern' "$CONFIG_FILE" | wc -l)

if [ "$BEHAVIOR_EXISTS" -gt 0 ]; then
    echo "⚠ /api/* behavior already exists, skipping behavior creation"
else
    echo "Adding /api/* cache behavior..."

    # Add /api/* cache behavior
    jq --arg id "$ORIGIN_ID" '
      .CacheBehaviors.Items += [{
        "PathPattern": "/api/*",
        "TargetOriginId": $id,
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
          }
        },
        "Compress": true,
        "MinTTL": 0,
        "DefaultTTL": 0,
        "MaxTTL": 0,
        "ForwardedValues": {
          "QueryString": true,
          "Cookies": {
            "Forward": "all"
          },
          "Headers": {
            "Quantity": 4,
            "Items": ["Authorization", "Content-Type", "Origin", "Accept"]
          },
          "QueryStringCacheKeys": {
            "Quantity": 0
          }
        },
        "TrustedSigners": {
          "Enabled": false,
          "Quantity": 0
        },
        "TrustedKeyGroups": {
          "Enabled": false,
          "Quantity": 0
        },
        "SmoothStreaming": false,
        "FieldLevelEncryptionId": "",
        "FunctionAssociations": {
          "Quantity": 0
        },
        "LambdaFunctionAssociations": {
          "Quantity": 0
        }
      }] |
      .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

    echo "✓ /api/* behavior added"
fi

echo ""
echo "Step 4: Validating configuration..."
jq '.' "$CONFIG_FILE" > /dev/null && echo "✓ Configuration is valid JSON"

echo ""
echo "Step 5: Updating CloudFront distribution..."
echo "This may take a few minutes..."

aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config file://"$CONFIG_FILE" \
  --if-match "$ETAG" \
  > /tmp/cloudfront-update-result.json

echo "✓ Distribution updated successfully"

echo ""
echo "Step 6: Waiting for deployment to complete..."
echo "This can take 5-15 minutes. You can check status at:"
echo "https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID"
echo ""

aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID" &
WAIT_PID=$!

# Show progress
while kill -0 $WAIT_PID 2>/dev/null; do
    echo -n "."
    sleep 5
done
wait $WAIT_PID

echo ""
echo ""
echo "=================================================="
echo "✓ Setup Complete!"
echo "=================================================="
echo ""
echo "API requests will now be proxied:"
echo "  https://gsd.vinny.dev/api/* → https://$WORKER_DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Update client code to use /api/* instead of worker URL"
echo "  2. Test OAuth flow on iPad PWA"
echo ""
echo "Cleanup:"
rm -f "$CONFIG_FILE" "$ETAG_FILE"
echo "✓ Temporary files removed"
