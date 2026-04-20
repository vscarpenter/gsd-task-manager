#!/usr/bin/env bash
#
# Update the existing PocketBase "tasks" collection schema in place.
#
# This script is idempotent:
# - it only adds missing fields
# - it preserves the existing collection rules, indexes, and field order
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

for cmd in curl jq mktemp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required command not found: $cmd"
    exit 1
  fi
done

echo "==> Authenticating with PocketBase at $PB_URL..."

AUTH_RESPONSE=$(
  curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}"
)

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')

if [[ -z "$TOKEN" ]]; then
  echo "Error: Authentication failed. Check your admin credentials."
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "==> Fetching existing 'tasks' collection..."

CURRENT_COLLECTION=$(
  curl -fsS "$PB_URL/api/collections/tasks" \
    -H "Authorization: $TOKEN"
)

TMP_JSON=$(mktemp)
trap 'rm -f "$TMP_JSON"' EXIT

echo "$CURRENT_COLLECTION" | jq '
  def ensure_field($field):
    if any(.fields[]; .name == $field.name) then . else .fields += [$field] end;

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
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary @"$TMP_JSON"
)

echo "==> Verifying required fields..."

FIELD_NAMES=$(echo "$RESPONSE" | jq -r '.fields[].name')

for field in notification_sent last_notification_at snoozed_until; do
  if ! grep -qx "$field" <<< "$FIELD_NAMES"; then
    echo "Error: Field verification failed for '$field'"
    exit 1
  fi
done

echo "==> Success! 'tasks' collection updated."
echo ""
echo "Verified fields:"
echo "  - notification_sent"
echo "  - last_notification_at"
echo "  - snoozed_until"
