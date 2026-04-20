#!/bin/bash

# Deploy CloudFront Functions for URL rewriting and agent-discovery response headers.
# This script publishes both functions and attaches them to the distribution
# (viewer-request and viewer-response respectively).

set -e  # Exit on error

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:?Error: CLOUDFRONT_DISTRIBUTION_ID environment variable is required}"

REQUEST_FUNCTION_NAME="gsd-url-rewrite"
REQUEST_FUNCTION_FILE="$PROJECT_ROOT/cloudfront-function-url-rewrite.cjs"
REQUEST_FUNCTION_COMMENT="URL rewrite + Accept: text/markdown negotiation for Next.js static export"

RESPONSE_FUNCTION_NAME="gsd-response-headers"
RESPONSE_FUNCTION_FILE="$PROJECT_ROOT/cloudfront-function-response-headers.cjs"
RESPONSE_FUNCTION_COMMENT="Agent discovery: Link headers + Vary: Accept + markdown content-type"

publish_function() {
  local name="$1"
  local file="$2"
  local comment="$3"

  echo ""
  echo "🚀 Publishing CloudFront Function: $name"
  echo "📂 Source: $file"

  local exists
  exists=$(aws cloudfront list-functions --query "FunctionList.Items[?Name=='$name'].Name" --output text)

  if [ -z "$exists" ]; then
    echo "✨ Creating new function..."
    aws cloudfront create-function \
      --name "$name" \
      --function-config "{\"Comment\":\"$comment\",\"Runtime\":\"cloudfront-js-2.0\"}" \
      --function-code fileb://"$file" \
      --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
      --output text
  else
    echo "📝 Function exists, updating code..."
    local etag
    etag=$(aws cloudfront describe-function --name "$name" --query 'ETag' --output text)
    aws cloudfront update-function \
      --name "$name" \
      --if-match "$etag" \
      --function-config "{\"Comment\":\"$comment\",\"Runtime\":\"cloudfront-js-2.0\"}" \
      --function-code fileb://"$file" \
      --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
      --output text
  fi

  local etag
  etag=$(aws cloudfront describe-function --name "$name" --query 'ETag' --output text)
  aws cloudfront publish-function --name "$name" --if-match "$etag" > /dev/null
  echo "✅ Function published: $name"
}

# Step 1: Publish both functions, then resolve their LIVE-stage ARNs (the
# published stage is what the distribution must reference).
publish_function "$REQUEST_FUNCTION_NAME" "$REQUEST_FUNCTION_FILE" "$REQUEST_FUNCTION_COMMENT"
publish_function "$RESPONSE_FUNCTION_NAME" "$RESPONSE_FUNCTION_FILE" "$RESPONSE_FUNCTION_COMMENT"

REQUEST_FUNCTION_ARN=$(aws cloudfront describe-function --name "$REQUEST_FUNCTION_NAME" --stage LIVE --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)
RESPONSE_FUNCTION_ARN=$(aws cloudfront describe-function --name "$RESPONSE_FUNCTION_NAME" --stage LIVE --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)

echo ""
echo "📋 Live function ARNs:"
echo "  viewer-request:  $REQUEST_FUNCTION_ARN"
echo "  viewer-response: $RESPONSE_FUNCTION_ARN"

# Step 2: Get the distribution config
echo ""
echo "📋 Getting CloudFront distribution config..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" > /tmp/dist-config.json
DIST_ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-config-only.json

# Step 3: Attach both functions to DefaultCacheBehavior
echo ""
echo "🔗 Attaching functions to distribution..."
jq --arg req "$REQUEST_FUNCTION_ARN" --arg res "$RESPONSE_FUNCTION_ARN" \
  '.DefaultCacheBehavior.FunctionAssociations.Quantity = 2 |
   .DefaultCacheBehavior.FunctionAssociations.Items = [
     { "FunctionARN": $req, "EventType": "viewer-request" },
     { "FunctionARN": $res, "EventType": "viewer-response" }
   ]' /tmp/dist-config-only.json > /tmp/dist-config-updated.json

aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$DIST_ETAG" \
  --distribution-config file:///tmp/dist-config-updated.json > /dev/null

echo "✅ Distribution updated"

# Step 4: Invalidate so changes take effect immediately
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
echo "Distribution: https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID"
