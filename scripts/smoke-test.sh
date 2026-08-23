#!/bin/bash
#
# Post-deploy smoke test. Validates that a freshly-deployed environment
# is actually serving the new build. Designed to be cheap (5 HTTP requests)
# and to catch the five classes of silent breakage observed historically:
#
#   1. Site doesn't return 200 (DNS/cert/origin broken)
#   2. sw.js missing or replaced by an SPA fallback
#   3. .well-known/api-catalog wrong Content-Type
#      (fix-discovery-content-types.sh did not run)
#   4. index.html missing no-cache headers
#      (the metadata-REPLACE step did not run)
#   5. .well-known/security.txt missing or lacking its charset
#      (RFC 9116 contact file not published or not stamped)
#
# Required env var: SITE_URL (e.g. https://gsd-dev.vinny.dev)
#
# Exit code: 0 on success, 1 on any failed assertion.

set -euo pipefail

: "${SITE_URL:?Required env var SITE_URL}"

# Strip trailing slash so we can concat paths consistently.
SITE_URL="${SITE_URL%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

fail() {
  echo -e "${RED}✗ Smoke test FAILED: $1${NC}" >&2
  exit 1
}

pass() {
  echo -e "${GREEN}✓${NC} $1"
}

echo "Smoke testing ${SITE_URL} ..."

# 1. Root URL returns 200.
echo "  [1/5] GET ${SITE_URL}/"
curl -fsS -o /dev/null "${SITE_URL}/" \
  || fail "root URL did not return 200"
pass "root URL returns 200"

# 2. sw.js contains the cache marker. If S3 routing fell back to the SPA
#    shell, /sw.js would return index.html instead and this would fail.
echo "  [2/5] GET ${SITE_URL}/sw.js"
sw_body=$(curl -fsS "${SITE_URL}/sw.js" | head -c 500)
echo "$sw_body" | grep -q "CACHE_VERSION" \
  || fail "sw.js did not contain CACHE_VERSION marker (SPA fallback?)"
pass "sw.js served correctly"

# 3. .well-known/api-catalog must be application/linkset+json (RFC 9727).
#    S3 cannot infer this from the (extensionless) filename, so this header
#    can only be correct if fix-discovery-content-types.sh ran.
echo "  [3/5] HEAD ${SITE_URL}/.well-known/api-catalog"
catalog_headers=$(curl -fsSI "${SITE_URL}/.well-known/api-catalog" | tr -d '\r')
echo "$catalog_headers" | grep -iq "^content-type: application/linkset+json" \
  || fail ".well-known/api-catalog wrong Content-Type (discovery fix skipped)"
pass ".well-known/api-catalog Content-Type correct"

# 4. index.html must serve with no-cache. If the cp --metadata-directive
#    REPLACE step was skipped, the previous immutable cache-control sticks.
echo "  [4/5] HEAD ${SITE_URL}/"
index_headers=$(curl -fsSI "${SITE_URL}/" | tr -d '\r')
echo "$index_headers" | grep -iq "^cache-control:.*no-cache" \
  || fail "index.html missing no-cache header"
pass "index.html no-cache header present"

# 5. .well-known/security.txt must be published as text/plain with an explicit
#    charset (RFC 9116). S3 infers bare "text/plain" from the extension, so the
#    charset is what proves fix-discovery-content-types.sh stamped this file.
echo "  [5/5] HEAD ${SITE_URL}/.well-known/security.txt"
security_headers=$(curl -fsSI "${SITE_URL}/.well-known/security.txt" | tr -d '\r') \
  || fail ".well-known/security.txt did not return 200"
echo "$security_headers" | grep -iq "^content-type: text/plain; *charset=utf-8" \
  || fail ".well-known/security.txt wrong Content-Type (discovery fix skipped)"
pass ".well-known/security.txt served correctly"

echo ""
echo -e "${GREEN}✓ All smoke tests passed for ${SITE_URL}${NC}"
