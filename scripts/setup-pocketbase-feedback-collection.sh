#!/usr/bin/env bash
#
# Create the PocketBase 'feedback' collection.
#
# The collection is write-only from a client's point of view: anyone may create
# a record, and nobody but a superuser may list, view, change, or delete one.
# Reading happens in the admin UI at /_/.
#
# There is deliberately no owner, user, device, email, or IP field. Feedback is
# anonymous by construction rather than by policy, so a signed-in sync user and
# a first-time visitor are indistinguishable here. Do not add an identifier to
# this collection without revisiting tasks/spec-anonymous-feedback.md, the about
# page copy, and the published privacy policy.
#
# Both this collection and `tasks` use an app-owned client timestamp. PocketBase
# `created` / `updated` exist for diagnostics, but must never be referenced in
# sort, filter, or index expressions.
#
# Prerequisites:
#   - PocketBase server running at $PB_URL (default: https://api.vinny.io)
#   - Superuser credentials: set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars
#     (PocketBase v0.23+ uses _superusers collection for admin auth)
#
# Usage:
#   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret ./scripts/setup-pocketbase-feedback-collection.sh
#
set -euo pipefail

PB_URL="${PB_URL:-https://api.vinny.io}"

if [[ -z "${PB_ADMIN_EMAIL:-}" || -z "${PB_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables"
  echo ""
  echo "Usage:"
  echo "  PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret $0"
  exit 1
fi

for cmd in curl mktemp python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required command not found: $cmd"
    exit 1
  fi
done

AUTH_PAYLOAD_FILE=$(mktemp)
COLLECTION_PAYLOAD_FILE=$(mktemp)
COLLECTION_CURL_CONFIG=$(mktemp)
chmod 600 "$AUTH_PAYLOAD_FILE" "$COLLECTION_PAYLOAD_FILE" "$COLLECTION_CURL_CONFIG"
trap 'rm -f "$AUTH_PAYLOAD_FILE" "$COLLECTION_PAYLOAD_FILE" "$COLLECTION_CURL_CONFIG"' EXIT

echo "==> Authenticating with PocketBase at $PB_URL..."

python3 - "$AUTH_PAYLOAD_FILE" <<'PY'
import json
import os
import sys

with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(
        {
            "identity": os.environ["PB_ADMIN_EMAIL"],
            "password": os.environ["PB_ADMIN_PASSWORD"],
        },
        handle,
    )
PY

# PocketBase v0.23+ uses _superusers collection for admin auth
AUTH_RESPONSE=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  --data-binary @"$AUTH_PAYLOAD_FILE")

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [[ -z "$TOKEN" ]]; then
  echo "Error: Authentication failed. Check your admin credentials."
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "==> Authenticated. Creating 'feedback' collection..."

cat > "$COLLECTION_CURL_CONFIG" <<EOF
header = "Content-Type: application/json"
header = "Authorization: $TOKEN"
EOF

# Field maxes mirror lib/feedback/feedback-payload.ts. The client enforces them
# too, but the server is the boundary that actually has to hold.
cat > "$COLLECTION_PAYLOAD_FILE" <<'ENDJSON'
{
  "name": "feedback",
  "type": "base",
  "system": false,
  "listRule": null,
  "viewRule": null,
  "createRule": "",
  "updateRule": null,
  "deleteRule": null,
  "fields": [
    {
      "name": "submission_id",
      "type": "text",
      "required": true,
      "system": false,
      "options": {
        "min": 1,
        "max": 64
      }
    },
    {
      "name": "sentiment",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 10,
        "pattern": "^(up|down)?$"
      }
    },
    {
      "name": "category",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 10,
        "pattern": "^(idea|praise|gripe|bug)?$"
      }
    },
    {
      "name": "message",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 1000
      }
    },
    {
      "name": "votes",
      "type": "json",
      "required": false,
      "system": false,
      "options": {
        "maxSize": 2000
      }
    },
    {
      "name": "app_version",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 20
      }
    },
    {
      "name": "client_submitted_at",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "created",
      "type": "autodate",
      "onCreate": true,
      "onUpdate": false
    },
    {
      "name": "updated",
      "type": "autodate",
      "onCreate": true,
      "onUpdate": true
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX idx_feedback_submission_id ON feedback (submission_id)",
    "CREATE INDEX idx_feedback_client_submitted ON feedback (client_submitted_at)"
  ]
}
ENDJSON

RESPONSE=$(curl -s -X POST "$PB_URL/api/collections" \
  --config "$COLLECTION_CURL_CONFIG" \
  --data-binary @"$COLLECTION_PAYLOAD_FILE")

if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')" 2>/dev/null; then
  COLLECTION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "==> Success! 'feedback' collection created (ID: $COLLECTION_ID)"
  echo ""
  echo "Collection has:"
  echo "  - 7 client-written fields, none of which identify the submitter"
  echo "  - API rules: anyone may create; only a superuser may read or modify"
  echo "  - A unique submission_id, so a retried submission cannot double-post"
  echo ""
  echo "TWO MANUAL STEPS REMAIN. This endpoint is unauthenticated, so both matter:"
  echo ""
  echo "  1. Rate limiting. In the admin UI at $PB_URL/_/ open"
  echo "     Settings -> Application -> Rate limiting, enable it, and add a rule"
  echo "     for the 'feedback' collection create route. This script does not set"
  echo "     it, because rate limits are global server settings and writing them"
  echo "     from here would clobber any rule you already have."
  echo ""
  echo "  2. Log retention. Settings -> Logs controls how long request logs are"
  echo "     kept, and those logs record client IPs. Anonymous feedback next to an"
  echo "     indefinitely-retained IP log is not anonymous; shorten the window."
  echo ""
else
  echo "Error creating collection:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
