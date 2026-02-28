#!/usr/bin/env bash
#
# Create the PocketBase 'tasks' collection with the correct schema
# for GSD Task Manager sync.
#
# Prerequisites:
#   - PocketBase server running at $PB_URL (default: https://api.vinny.io)
#   - Superuser credentials: set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars
#     (PocketBase v0.23+ uses _superusers collection for admin auth)
#
# Usage:
#   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret ./scripts/setup-pocketbase-collections.sh
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

echo "==> Authenticating with PocketBase at $PB_URL..."

# PocketBase v0.23+ uses _superusers collection for admin auth
AUTH_RESPONSE=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [[ -z "$TOKEN" ]]; then
  echo "Error: Authentication failed. Check your admin credentials."
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "==> Authenticated. Creating 'tasks' collection..."

# Create the tasks collection with all fields matching PBTaskRecord
COLLECTION_PAYLOAD=$(cat <<'ENDJSON'
{
  "name": "tasks",
  "type": "base",
  "system": false,
  "listRule": "@request.auth.id != \"\" && owner = @request.auth.id",
  "viewRule": "@request.auth.id != \"\" && owner = @request.auth.id",
  "createRule": "@request.auth.id != \"\" && owner = @request.auth.id",
  "updateRule": "@request.auth.id != \"\" && owner = @request.auth.id",
  "deleteRule": "@request.auth.id != \"\" && owner = @request.auth.id",
  "fields": [
    {
      "name": "task_id",
      "type": "text",
      "required": true,
      "system": false,
      "options": {
        "min": 1,
        "max": 255
      }
    },
    {
      "name": "owner",
      "type": "text",
      "required": true,
      "system": false,
      "options": {
        "min": 1,
        "max": 255
      }
    },
    {
      "name": "title",
      "type": "text",
      "required": true,
      "system": false,
      "options": {
        "min": 1,
        "max": 500
      }
    },
    {
      "name": "description",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 5000
      }
    },
    {
      "name": "urgent",
      "type": "bool",
      "required": false,
      "system": false,
      "options": {}
    },
    {
      "name": "important",
      "type": "bool",
      "required": false,
      "system": false,
      "options": {}
    },
    {
      "name": "quadrant",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "due_date",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "completed",
      "type": "bool",
      "required": false,
      "system": false,
      "options": {}
    },
    {
      "name": "completed_at",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "recurrence",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "tags",
      "type": "json",
      "required": false,
      "system": false,
      "options": {
        "maxSize": 10000
      }
    },
    {
      "name": "subtasks",
      "type": "json",
      "required": false,
      "system": false,
      "options": {
        "maxSize": 50000
      }
    },
    {
      "name": "dependencies",
      "type": "json",
      "required": false,
      "system": false,
      "options": {
        "maxSize": 10000
      }
    },
    {
      "name": "notification_enabled",
      "type": "bool",
      "required": false,
      "system": false,
      "options": {}
    },
    {
      "name": "notify_before",
      "type": "number",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": null,
        "noDecimal": false
      }
    },
    {
      "name": "estimated_minutes",
      "type": "number",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": null,
        "noDecimal": false
      }
    },
    {
      "name": "time_spent",
      "type": "number",
      "required": false,
      "system": false,
      "options": {
        "min": 0,
        "max": null,
        "noDecimal": false
      }
    },
    {
      "name": "time_entries",
      "type": "json",
      "required": false,
      "system": false,
      "options": {
        "maxSize": 100000
      }
    },
    {
      "name": "client_updated_at",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "client_created_at",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 50
      }
    },
    {
      "name": "device_id",
      "type": "text",
      "required": false,
      "system": false,
      "options": {
        "min": null,
        "max": 100
      }
    }
  ],
  "indexes": [
    "CREATE INDEX idx_tasks_owner ON tasks (owner)",
    "CREATE UNIQUE INDEX idx_tasks_task_id_owner ON tasks (task_id, owner)",
    "CREATE INDEX idx_tasks_client_updated ON tasks (client_updated_at)"
  ]
}
ENDJSON
)

RESPONSE=$(curl -s -X POST "$PB_URL/api/collections" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d "$COLLECTION_PAYLOAD")

# Check for success
if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')" 2>/dev/null; then
  COLLECTION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "==> Success! 'tasks' collection created (ID: $COLLECTION_ID)"
  echo ""
  echo "Collection has:"
  echo "  - 22 fields matching PBTaskRecord schema"
  echo "  - API rules: authenticated users can only access their own tasks"
  echo "  - Indexes: owner, task_id+owner (unique), updated"
  echo ""
  echo "You can now sync tasks from the app."
else
  echo "Error creating collection:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
