#!/usr/bin/env bash
#
# Update the existing PocketBase "tasks" collection schema in place.
#
# This script is idempotent:
# - it only adds missing fields
# - it hardens owner-scoped collection rules while preserving indexes and field order
#
# Required environment variables:
#   PB_ADMIN_EMAIL
#   PB_ADMIN_PASSWORD
#
# Optional environment variables:
#   PB_URL (default: https://api.vinny.io)
#
# Usage:
#   PB_URL=https://localhost \
#   PB_ADMIN_EMAIL=admin@example.com \
#   PB_ADMIN_PASSWORD=secret \
#   ./scripts/update-pocketbase-tasks-schema.sh
#
set -euo pipefail

PB_URL="${PB_URL:-https://api.vinny.io}"

if [[ -z "${PB_ADMIN_EMAIL:-}" || -z "${PB_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables"
  echo ""
  echo "Usage:"
  echo "  PB_URL=https://localhost \\"
  echo "  PB_ADMIN_EMAIL=admin@example.com \\"
  echo "  PB_ADMIN_PASSWORD=secret \\"
  echo "  $0"
  exit 1
fi

for cmd in curl jq mktemp python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required command not found: $cmd"
    exit 1
  fi
done

AUTH_PAYLOAD_FILE=$(mktemp)
PB_CURL_CONFIG=$(mktemp)
TMP_JSON=$(mktemp)
chmod 600 "$AUTH_PAYLOAD_FILE" "$PB_CURL_CONFIG" "$TMP_JSON"
trap 'rm -f "$AUTH_PAYLOAD_FILE" "$PB_CURL_CONFIG" "$TMP_JSON"' EXIT

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

AUTH_RESPONSE=$(
  curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    --data-binary @"$AUTH_PAYLOAD_FILE"
)

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')

if [[ -z "$TOKEN" ]]; then
  echo "Error: Authentication failed. Check your admin credentials."
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

cat > "$PB_CURL_CONFIG" <<EOF
header = "Authorization: $TOKEN"
EOF

echo "==> Fetching existing 'tasks' collection..."

CURRENT_COLLECTION=$(
  curl -fsS "$PB_URL/api/collections/tasks" \
    --config "$PB_CURL_CONFIG"
)

echo "$CURRENT_COLLECTION" | jq '
  def ensure_field($field):
    if any(.fields[]; .name == $field.name) then . else .fields += [$field] end;
  def owner_rule: "@request.auth.id != \"\" && owner = @request.auth.id";
  def immutable_owner_rule: owner_rule + " && (@request.body.owner:isset = false || @request.body.owner = owner)";

  ensure_field({
    "name": "notification_sent",
    "type": "bool",
    "required": false,
    "system": false,
    "options": {}
  })
  | ensure_field({
    "name": "last_notification_at",
    "type": "text",
    "required": false,
    "system": false,
    "options": {
      "min": null,
      "max": 50
    }
  })
  | ensure_field({
    "name": "snoozed_until",
    "type": "text",
    "required": false,
    "system": false,
    "options": {
      "min": null,
      "max": 50
    }
  })
  | .listRule = owner_rule
  | .viewRule = owner_rule
  | .createRule = owner_rule
  | .updateRule = immutable_owner_rule
  | .deleteRule = owner_rule
  | {
      name,
      type,
      system,
      listRule,
      viewRule,
      createRule,
      updateRule,
      deleteRule,
      fields,
      indexes
    }
' > "$TMP_JSON"

echo "==> Updating 'tasks' collection schema..."

RESPONSE=$(
  curl -fsS -X PATCH "$PB_URL/api/collections/tasks" \
    --config "$PB_CURL_CONFIG" \
    -H "Content-Type: application/json" \
    --data-binary @"$TMP_JSON"
)

echo "==> Verifying required fields..."

FIELD_NAMES=$(echo "$RESPONSE" | jq -r '.fields[].name')
UPDATE_RULE=$(echo "$RESPONSE" | jq -r '.updateRule // empty')

for field in notification_sent last_notification_at snoozed_until; do
  if ! grep -qx "$field" <<< "$FIELD_NAMES"; then
    echo "Error: Field verification failed for '$field'"
    exit 1
  fi
done

if [[ "$UPDATE_RULE" != *"@request.body.owner:isset = false"* || "$UPDATE_RULE" != *"@request.body.owner = owner"* ]]; then
  echo "Error: Owner immutability rule was not applied"
  exit 1
fi

echo "==> Success! 'tasks' collection updated."
echo ""
echo "Verified fields:"
echo "  - notification_sent"
echo "  - last_notification_at"
echo "  - snoozed_until"
echo "Verified rules:"
echo "  - owner cannot be changed after create"
