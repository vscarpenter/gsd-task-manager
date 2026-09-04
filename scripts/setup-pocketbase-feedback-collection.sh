#!/usr/bin/env bash
#
# Create or reconcile the anonymous, write-only PocketBase feedback collection.
# Public creation is enabled only after the checked-in server hook, rate limit,
# aggregate quota, retention, and privacy-preserving log policy are verified.
#
# Prerequisites:
#   - PocketBase running with docker/pb_hooks/feedback_controls.pb.js loaded
#   - A direct PocketBase URL (the public Caddy origin blocks superuser routes)
#   - PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD
#
# Usage:
#   PB_URL=http://127.0.0.1:8090 \
#   PB_ADMIN_EMAIL=admin@example.com \
#   PB_ADMIN_PASSWORD=secret \
#     ./scripts/setup-pocketbase-feedback-collection.sh
#
set -euo pipefail

PB_URL="${PB_URL:-https://api.vinny.io}"
PB_URL="${PB_URL%/}"
readonly FEEDBACK_RATE_MAX=30
readonly FEEDBACK_RATE_SECONDS=60
readonly FEEDBACK_MAX_RECORDS=10000
readonly FEEDBACK_RETENTION_DAYS=180

if [[ -z "${PB_ADMIN_EMAIL:-}" || -z "${PB_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables"
  exit 1
fi

for cmd in curl mktemp python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Required command not found: $cmd"
    exit 1
  fi
done

WORK_DIR="$(mktemp -d)"
chmod 700 "$WORK_DIR"
trap 'rm -rf -- "$WORK_DIR"' EXIT

AUTH_PAYLOAD_FILE="$WORK_DIR/auth.json"
COLLECTION_PAYLOAD_FILE="$WORK_DIR/collection-disabled.json"
COLLECTION_RESPONSE_FILE="$WORK_DIR/collection-response.json"
COLLECTION_CURL_CONFIG="$WORK_DIR/curl.conf"
CONTROLS_RESPONSE_FILE="$WORK_DIR/controls.json"
SETTINGS_RESPONSE_FILE="$WORK_DIR/settings.json"
SETTINGS_PAYLOAD_FILE="$WORK_DIR/settings-patch.json"
SETTINGS_VERIFY_FILE="$WORK_DIR/settings-verify.json"
PUBLIC_RULE_PAYLOAD_FILE="$WORK_DIR/public-rule.json"
FINAL_COLLECTION_FILE="$WORK_DIR/collection-final.json"
touch "$AUTH_PAYLOAD_FILE" "$COLLECTION_PAYLOAD_FILE" "$COLLECTION_RESPONSE_FILE" \
  "$COLLECTION_CURL_CONFIG" "$CONTROLS_RESPONSE_FILE" "$SETTINGS_RESPONSE_FILE" \
  "$SETTINGS_PAYLOAD_FILE" "$SETTINGS_VERIFY_FILE" "$PUBLIC_RULE_PAYLOAD_FILE" \
  "$FINAL_COLLECTION_FILE"
chmod 600 "$WORK_DIR"/*

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

echo "==> Authenticating with PocketBase at $PB_URL..."
AUTH_RESPONSE="$(curl -sS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  --data-binary @"$AUTH_PAYLOAD_FILE")"
TOKEN="$(printf '%s' "$AUTH_RESPONSE" | python3 -c \
  "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "Error: PocketBase superuser authentication failed."
  exit 1
fi

{
  printf 'header = "Content-Type: application/json"\n'
  printf 'header = "Authorization: %s"\n' "$TOKEN"
} > "$COLLECTION_CURL_CONFIG"

# The server boundary mirrors lib/feedback/feedback-payload.ts. No owner, user,
# device, email, or IP field is permitted. Creation starts disabled and remains
# disabled after any setup failure.
cat > "$COLLECTION_PAYLOAD_FILE" <<'ENDJSON'
{
  "name": "feedback",
  "type": "base",
  "system": false,
  "listRule": null,
  "viewRule": null,
  "createRule": null,
  "updateRule": null,
  "deleteRule": null,
  "fields": [
    {
      "name": "submission_id",
      "type": "text",
      "required": true,
      "system": false,
      "options": { "min": 1, "max": 64 }
    },
    {
      "name": "sentiment",
      "type": "text",
      "required": false,
      "system": false,
      "options": { "min": null, "max": 10, "pattern": "^(up|down)?$" }
    },
    {
      "name": "category",
      "type": "text",
      "required": false,
      "system": false,
      "options": { "min": null, "max": 10, "pattern": "^(idea|praise|gripe|bug)?$" }
    },
    {
      "name": "message",
      "type": "text",
      "required": false,
      "system": false,
      "options": { "min": null, "max": 1000 }
    },
    {
      "name": "votes",
      "type": "json",
      "required": false,
      "system": false,
      "options": { "maxSize": 2000 }
    },
    {
      "name": "app_version",
      "type": "text",
      "required": false,
      "system": false,
      "options": { "min": null, "max": 20 }
    },
    {
      "name": "client_submitted_at",
      "type": "text",
      "required": false,
      "system": false,
      "options": { "min": null, "max": 50 }
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

echo "==> Creating or reconciling 'feedback' with public writes disabled..."
COLLECTION_STATUS="$(curl -sS -o "$COLLECTION_RESPONSE_FILE" -w '%{http_code}' \
  "$PB_URL/api/collections/feedback" \
  --config "$COLLECTION_CURL_CONFIG")"

case "$COLLECTION_STATUS" in
  200)
    COLLECTION_ID="$(python3 - "$COLLECTION_RESPONSE_FILE" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    print(json.load(handle).get("id", ""))
PY
)"
    if [[ ! "$COLLECTION_ID" =~ ^[A-Za-z0-9_]+$ ]]; then
      echo "Error: Existing feedback collection returned an invalid ID."
      exit 1
    fi
    COLLECTION_WRITE_METHOD=PATCH
    COLLECTION_WRITE_PATH="/api/collections/$COLLECTION_ID"
    ;;
  404)
    COLLECTION_WRITE_METHOD=POST
    COLLECTION_WRITE_PATH="/api/collections"
    ;;
  *)
    echo "Error: Unable to inspect feedback collection (HTTP $COLLECTION_STATUS)."
    exit 1
    ;;
esac

COLLECTION_WRITE_STATUS="$(curl -sS -o "$COLLECTION_RESPONSE_FILE" -w '%{http_code}' \
  -X "$COLLECTION_WRITE_METHOD" "$PB_URL$COLLECTION_WRITE_PATH" \
  --config "$COLLECTION_CURL_CONFIG" \
  --data-binary @"$COLLECTION_PAYLOAD_FILE")"
if [[ ! "$COLLECTION_WRITE_STATUS" =~ ^20[01]$ ]]; then
  echo "Error: Unable to create or disable feedback collection (HTTP $COLLECTION_WRITE_STATUS)."
  exit 1
fi

COLLECTION_ID="$(python3 - "$COLLECTION_RESPONSE_FILE" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
assert data.get("id"), "missing collection id"
assert data.get("createRule", "not-null") is None, "anonymous creation was not disabled"
print(data["id"])
PY
)"

echo "==> Verifying checked-in feedback hook..."
CONTROLS_STATUS="$(curl -sS -o "$CONTROLS_RESPONSE_FILE" -w '%{http_code}' \
  "$PB_URL/api/gsd/feedback-controls" \
  --config "$COLLECTION_CURL_CONFIG")"
if [[ "$CONTROLS_STATUS" != "200" ]]; then
  echo "Error: feedback_controls.pb.js is missing or inaccessible (HTTP $CONTROLS_STATUS)."
  echo "Use a direct PocketBase URL; the public Caddy origin blocks this marker route."
  exit 1
fi
python3 - "$CONTROLS_RESPONSE_FILE" "$FEEDBACK_MAX_RECORDS" "$FEEDBACK_RETENTION_DAYS" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
assert data.get("hookVersion") == 1, "unexpected feedback hook version"
assert data.get("quotaLimit") == int(sys.argv[2]), "unexpected feedback quota"
assert data.get("retentionDays") == int(sys.argv[3]), "unexpected retention policy"
PY

echo "==> Installing rate-limit and private-log settings..."
SETTINGS_STATUS="$(curl -sS -o "$SETTINGS_RESPONSE_FILE" -w '%{http_code}' \
  "$PB_URL/api/settings" \
  --config "$COLLECTION_CURL_CONFIG")"
if [[ "$SETTINGS_STATUS" != "200" ]]; then
  echo "Error: Unable to read PocketBase settings (HTTP $SETTINGS_STATUS)."
  exit 1
fi

python3 - "$SETTINGS_RESPONSE_FILE" "$SETTINGS_PAYLOAD_FILE" \
  "$FEEDBACK_RATE_MAX" "$FEEDBACK_RATE_SECONDS" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    settings = json.load(handle)

rate_limits = dict(settings.get("rateLimits") or {})
existing_rules = rate_limits.get("rules")
if not isinstance(existing_rules, list):
    existing_rules = []
rate_limits["enabled"] = True
rate_limits["rules"] = [
    rule
    for rule in existing_rules
    if not isinstance(rule, dict) or rule.get("label") != "feedback:create"
]
rate_limits["rules"].append(
    {
        "label": "feedback:create",
        "audience": "",
        "maxRequests": int(sys.argv[3]),
        "duration": int(sys.argv[4]),
    }
)

logs = dict(settings.get("logs") or {})
logs["maxDays"] = 0 if logs.get("maxDays") == 0 else 1
logs["logIP"] = False
logs["logAuthId"] = False

with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump({"rateLimits": rate_limits, "logs": logs}, handle)
PY

SETTINGS_PATCH_STATUS="$(curl -sS -o "$SETTINGS_RESPONSE_FILE" -w '%{http_code}' \
  -X PATCH "$PB_URL/api/settings" \
  --config "$COLLECTION_CURL_CONFIG" \
  --data-binary @"$SETTINGS_PAYLOAD_FILE")"
if [[ "$SETTINGS_PATCH_STATUS" != "200" ]]; then
  echo "Error: Unable to install feedback controls (HTTP $SETTINGS_PATCH_STATUS)."
  exit 1
fi

SETTINGS_VERIFY_STATUS="$(curl -sS -o "$SETTINGS_VERIFY_FILE" -w '%{http_code}' \
  "$PB_URL/api/settings" \
  --config "$COLLECTION_CURL_CONFIG")"
if [[ "$SETTINGS_VERIFY_STATUS" != "200" ]]; then
  echo "Error: Unable to read back PocketBase settings (HTTP $SETTINGS_VERIFY_STATUS)."
  exit 1
fi
python3 - "$SETTINGS_VERIFY_FILE" "$FEEDBACK_RATE_MAX" "$FEEDBACK_RATE_SECONDS" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    settings = json.load(handle)
rate_limits = settings.get("rateLimits") or {}
rules = [
    rule
    for rule in rate_limits.get("rules", [])
    if isinstance(rule, dict) and rule.get("label") == "feedback:create"
]
assert rate_limits.get("enabled") is True, "PocketBase rate limiting is disabled"
assert len(rules) == 1, "feedback:create rate rule is missing or ambiguous"
assert rules[0].get("audience") == "", "feedback rate rule must cover every caller"
assert rules[0].get("maxRequests") == int(sys.argv[2]), "unexpected request limit"
assert rules[0].get("duration") == int(sys.argv[3]), "unexpected rate duration"
logs = settings.get("logs") or {}
assert isinstance(logs.get("maxDays"), (int, float)), "missing log retention"
assert 0 <= logs["maxDays"] <= 1, "feedback request logs are retained too long"
assert logs.get("logIP") is False, "request IP logging must be disabled"
assert logs.get("logAuthId") is False, "request auth-id logging must be disabled"
PY

CONTROLS_STATUS="$(curl -sS -o "$CONTROLS_RESPONSE_FILE" -w '%{http_code}' \
  "$PB_URL/api/gsd/feedback-controls" \
  --config "$COLLECTION_CURL_CONFIG")"
if [[ "$CONTROLS_STATUS" != "200" ]]; then
  echo "Error: Unable to verify installed feedback controls (HTTP $CONTROLS_STATUS)."
  exit 1
fi
python3 - "$CONTROLS_RESPONSE_FILE" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
assert data.get("ready") is True, "feedback hook reports incomplete controls"
PY

cat > "$PUBLIC_RULE_PAYLOAD_FILE" <<'ENDJSON'
{"createRule": ""}
ENDJSON

echo "==> Enabling anonymous write-only feedback after all controls passed..."
PUBLIC_RULE_STATUS="$(curl -sS -o "$FINAL_COLLECTION_FILE" -w '%{http_code}' \
  -X PATCH "$PB_URL/api/collections/$COLLECTION_ID" \
  --config "$COLLECTION_CURL_CONFIG" \
  --data-binary @"$PUBLIC_RULE_PAYLOAD_FILE")"
if [[ "$PUBLIC_RULE_STATUS" != "200" ]]; then
  echo "Error: Controls are installed, but public feedback could not be enabled (HTTP $PUBLIC_RULE_STATUS)."
  exit 1
fi

FINAL_STATUS="$(curl -sS -o "$FINAL_COLLECTION_FILE" -w '%{http_code}' \
  "$PB_URL/api/collections/$COLLECTION_ID" \
  --config "$COLLECTION_CURL_CONFIG")"
if [[ "$FINAL_STATUS" != "200" ]]; then
  echo "Error: Unable to verify final feedback collection (HTTP $FINAL_STATUS)."
  exit 1
fi
python3 - "$FINAL_COLLECTION_FILE" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
assert data.get("createRule") == "", "anonymous creation was not enabled"
for rule in ("listRule", "viewRule", "updateRule", "deleteRule"):
    assert data.get(rule, "not-null") is None, f"{rule} must remain superuser-only"
PY

echo "==> Feedback collection is ready."
echo "    - 30 creates per 60 seconds per rate-limit audience"
echo "    - 10,000-record transactional aggregate quota"
echo "    - 180-day server-side retention"
echo "    - request IP and auth-ID logging disabled; logs retained at most 1 day"
