#!/bin/bash

# Deploy CloudFront Function for Security Headers
# This script creates a CloudFront Function and attaches it to the distribution (viewer-response)

set -e  # Exit on error

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

FUNCTION_NAME="gsd-security-headers"
DISTRIBUTION_ID="E1T6GDX0TQEP94"
FUNCTION_FILE="$PROJECT_ROOT/cloudfront-function-security-headers.js"

echo "🚀 Deploying CloudFront Function: $FUNCTION_NAME"
echo "📂 Using function file: $FUNCTION_FILE"

# Step 1: Check if function already exists
echo ""
echo "📋 Checking if function exists..."
FUNCTION_EXISTS=$(aws cloudfront list-functions --query "FunctionList.Items[?Name=='$FUNCTION_NAME'].Name" --output text)

if [ -z "$FUNCTION_EXISTS" ]; then
  echo "✨ Creating new CloudFront Function..."

  # Create the function
  FUNCTION_ARN=$(aws cloudfront create-function \
    --name "$FUNCTION_NAME" \
    --function-config Comment="Security headers (CSP, X-Frame-Options, etc.) for GSD Task Manager",Runtime="cloudfront-js-2.0" \
    --function-code fileb://"$FUNCTION_FILE" \
    --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
    --output text)

  echo "✅ Function created: $FUNCTION_ARN"
else
  echo "📝 Function exists, updating code..."

  # Get current ETag
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)

  # Update the function
  FUNCTION_ARN=$(aws cloudfront update-function \
    --name "$FUNCTION_NAME" \
    --if-match "$ETAG" \
    --function-config Comment="Security headers (CSP, X-Frame-Options, etc.) for GSD Task Manager",Runtime="cloudfront-js-2.0" \
    --function-code fileb://"$FUNCTION_FILE" \
    --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
    --output text)

  echo "✅ Function updated: $FUNCTION_ARN"
fi

# Step 2: Publish the function
echo ""
echo "📤 Publishing function..."
ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG" > /dev/null
echo "✅ Function published"

# Step 3: Get the distribution config
echo ""
echo "📋 Getting CloudFront distribution config..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/dist-config.json
DIST_ETAG=$(jq -r '.ETag' /tmp/dist-config.json)

# Step 4: Update the distribution config to attach the function
echo ""
echo "🔗 Attaching function to distribution..."

# Extract just the DistributionConfig
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-config-only.json

# Get existing viewer-request function (if any)
VIEWER_REQUEST_FUNCTION=$(jq -r '.DefaultCacheBehavior.FunctionAssociations.Items[] | select(.EventType == "viewer-request") | .FunctionARN' /tmp/dist-config-only.json || echo "")

# Build function associations array
if [ -z "$VIEWER_REQUEST_FUNCTION" ]; then
  # Only viewer-response (this function)
  jq --arg arn "$FUNCTION_ARN" \
    '.DefaultCacheBehavior.FunctionAssociations.Quantity = 1 |
     .DefaultCacheBehavior.FunctionAssociations.Items = [
       {
         "FunctionARN": $arn,
         "EventType": "viewer-response"
       }
     ]' /tmp/dist-config-only.json > /tmp/dist-config-updated.json
else
  # Both viewer-request and viewer-response
  jq --arg arn "$FUNCTION_ARN" --arg vr_arn "$VIEWER_REQUEST_FUNCTION" \
    '.DefaultCacheBehavior.FunctionAssociations.Quantity = 2 |
     .DefaultCacheBehavior.FunctionAssociations.Items = [
       {
         "FunctionARN": $vr_arn,
         "EventType": "viewer-request"
       },
       {
         "FunctionARN": $arn,
         "EventType": "viewer-response"
       }
     ]' /tmp/dist-config-only.json > /tmp/dist-config-updated.json
fi

# Update the distribution
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$DIST_ETAG" \
  --distribution-config file:///tmp/dist-config-updated.json > /dev/null

echo "✅ Distribution updated"

# Step 5: Create invalidation to clear cache
echo ""
echo "🗑️  Creating cache invalidation..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✅ Cache invalidation created: $INVALIDATION_ID"

# Cleanup
rm -f /tmp/dist-config.json /tmp/dist-config-only.json /tmp/dist-config-updated.json

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Security headers are now being added to all responses:"
echo "  - Content-Security-Policy (CSP)"
echo "  - X-Frame-Options: DENY"
echo "  - X-Content-Type-Options: nosniff"
echo "  - X-XSS-Protection: 1; mode=block"
echo "  - Referrer-Policy: strict-origin-when-cross-origin"
echo "  - Permissions-Policy: geolocation=(), microphone=(), camera=()"
echo ""
echo "Cache invalidation is in progress. Changes may take a few minutes to propagate."
echo "You can check the status at: https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID"
