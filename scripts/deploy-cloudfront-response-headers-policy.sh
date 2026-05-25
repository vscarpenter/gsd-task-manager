#!/bin/bash

# Apply the gsd-security-headers Response Headers Policy from version control.
#
# This script keeps the authoritative production security headers
# (CSP, HSTS, COOP/CORP, Permissions-Policy, frame protection) in
# `cloudfront/response-headers-policy.json` instead of letting them
# drift in the AWS console. Run it whenever the policy file changes.
#
# Idempotent: creates the policy if it does not exist, updates it
# (ETag-aware) if it does.
#
# Environment variables:
#   POLICY_NAME  Defaults to 'gsd-security-headers' (matches what the
#                CloudFront distribution references).

set -euo pipefail

export AWS_PAGER=""
export AWS_REGION="${AWS_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POLICY_FILE="$PROJECT_ROOT/cloudfront/response-headers-policy.json"
POLICY_NAME="${POLICY_NAME:-gsd-security-headers}"

for cmd in aws jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "❌ Required tool not found on PATH: $cmd" >&2
    exit 1
  }
done

[[ -f "$POLICY_FILE" ]] || {
  echo "❌ Policy file missing: $POLICY_FILE" >&2
  exit 1
}

# Sanity-check that the JSON parses before we send it to AWS.
jq -e . "$POLICY_FILE" > /dev/null

# Use a private temp dir with cleanup on exit.
TMPDIR_LOCAL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

echo "🔍 Checking for existing policy: $POLICY_NAME"

# Find an existing policy by name. The list endpoint paginates, but the
# `--query` filter handles that for our scale.
EXISTING_ID=$(aws cloudfront list-response-headers-policies \
  --type custom \
  --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='$POLICY_NAME'].ResponseHeadersPolicy.Id" \
  --output text 2>/dev/null || true)

if [[ -z "$EXISTING_ID" || "$EXISTING_ID" == "None" ]]; then
  echo "✨ Creating new Response Headers Policy: $POLICY_NAME"
  aws cloudfront create-response-headers-policy \
    --response-headers-policy-config "file://$POLICY_FILE" \
    --query 'ResponseHeadersPolicy.Id' \
    --output text
else
  echo "📝 Updating existing Response Headers Policy: $POLICY_NAME (id=$EXISTING_ID)"

  # ETag is required for update; fetch the current ETag.
  ETAG=$(aws cloudfront get-response-headers-policy \
    --id "$EXISTING_ID" \
    --query 'ETag' \
    --output text)

  aws cloudfront update-response-headers-policy \
    --id "$EXISTING_ID" \
    --if-match "$ETAG" \
    --response-headers-policy-config "file://$POLICY_FILE" \
    --query 'ResponseHeadersPolicy.Id' \
    --output text
fi

echo ""
echo "✅ Policy applied. Distribution must reference it by id in its DefaultCacheBehavior."
echo "    To verify: aws cloudfront get-distribution-config --id \$CLOUDFRONT_DISTRIBUTION_ID \\"
echo "      | jq '.DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId'"
