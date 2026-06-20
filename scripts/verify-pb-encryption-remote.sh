#!/usr/bin/env bash
# Remote round-trip check for the tasks API of a RUNNING PocketBase.
#
# What this proves: the tasks REST API accepts a task and returns its content as
# PLAINTEXT on read. Once the encryption hook is deployed, a passing round-trip
# means decrypt-on-read works and the API contract is unchanged for clients.
#
# What this does NOT prove: ciphertext AT REST. Verifying at-rest requires reading
# the server's SQLite DB on the host (it cannot be checked over HTTPS). Use
# scripts/verify-pb-encryption.sh locally for the full at-rest proof, and after
# deploy inspect the production DB on the host, e.g.:
#   docker exec <pb-container> sqlite3 /pb_data/data.db \
#     "select substr(title,1,12), substr(tags,1,12) from tasks limit 5;"
#
# Credentials come from the environment — NEVER hardcode them (this file is public):
#   PB_URL             target base URL, e.g. https://api.vinny.io
#   PB_ADMIN_EMAIL     superuser email
#   PB_ADMIN_PASSWORD  superuser password
#
# This creates a temporary task on the target server and DELETES it on exit.
#
# Usage:
#   PB_URL=https://api.vinny.io PB_ADMIN_EMAIL=you@example.com \
#     PB_ADMIN_PASSWORD='your-password' ./scripts/verify-pb-encryption-remote.sh
set -euo pipefail

: "${PB_URL:?set PB_URL (e.g. https://api.vinny.io)}"
: "${PB_ADMIN_EMAIL:?set PB_ADMIN_EMAIL (superuser email)}"
: "${PB_ADMIN_PASSWORD:?set PB_ADMIN_PASSWORD (superuser password)}"
PB_URL="${PB_URL%/}"   # strip any trailing slash

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Error: required command not found: $cmd" >&2; exit 1; }
done

TOKEN=""
ID=""
# Best-effort cleanup: delete the temporary task we created so the target isn't
# littered, even if an assertion fails partway through.
cleanup() {
  if [ -n "$ID" ] && [ -n "$TOKEN" ]; then
    if curl -sf -X DELETE -H "Authorization: $TOKEN" \
        "$PB_URL/api/collections/tasks/records/$ID" >/dev/null 2>&1; then
      echo "   cleaned up test record $ID"
    else
      echo "   WARN: could not delete test record $ID — remove it manually" >&2
    fi
  fi
}
trap cleanup EXIT

echo "1) authenticate against $PB_URL"
# Piped to jq so a non-2xx response yields an empty/null token (handled below)
# rather than aborting under set -e before the friendly check runs.
TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'content-type: application/json' \
  -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" | jq -r .token)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "   FAIL: could not authenticate superuser at $PB_URL" >&2
  exit 1
fi

echo "2) create a temporary task with non-empty json fields"
TASK_ID="verify-remote-$$"
REC=$(curl -sf -X POST "$PB_URL/api/collections/tasks/records" \
  -H "Authorization: $TOKEN" -H 'content-type: application/json' \
  -d "{
    \"task_id\":\"$TASK_ID\",
    \"owner\":\"verify-remote\",
    \"title\":\"Buy milk\",
    \"description\":\"2%\",
    \"tags\":[\"home\",\"work\"],
    \"subtasks\":[{\"id\":\"s1\",\"title\":\"step one\",\"completed\":false}],
    \"time_entries\":[{\"start\":\"2026-06-20T10:00:00Z\",\"end\":\"2026-06-20T10:30:00Z\"}]
  }")
ID=$(echo "$REC" | jq -r .id)
if [ -z "$ID" ] || [ "$ID" = "null" ]; then
  echo "   FAIL: record creation failed: $REC" >&2
  exit 1
fi
echo "   created record id=$ID"

echo "3) read it back and ASSERT plaintext round-trip over the API"
API_REC=$(curl -sf -H "Authorization: $TOKEN" \
  "$PB_URL/api/collections/tasks/records/$ID")

VIEW=$(echo "$API_REC" | jq -r .title)
if [ "$VIEW" = "Buy milk" ]; then echo "   OK title: $VIEW";
else echo "   FAIL: title round-trip: $VIEW" >&2; exit 1; fi

TAGS=$(echo "$API_REC" | jq -c '.tags')
if [ "$TAGS" = '["home","work"]' ]; then echo "   OK tags: $TAGS";
else echo "   FAIL: tags round-trip: $TAGS (expected [\"home\",\"work\"])" >&2; exit 1; fi

SUBTASK_TITLE=$(echo "$API_REC" | jq -r '.subtasks[0].title')
SUBTASK_DONE=$(echo "$API_REC" | jq -r '.subtasks[0].completed')
if [ "$SUBTASK_TITLE" = "step one" ] && [ "$SUBTASK_DONE" = "false" ]; then
  echo "   OK subtasks[0]: title=$SUBTASK_TITLE completed=$SUBTASK_DONE";
else echo "   FAIL: subtasks round-trip: title=$SUBTASK_TITLE completed=$SUBTASK_DONE" >&2; exit 1; fi

TE_START=$(echo "$API_REC" | jq -r '.time_entries[0].start')
if [ "$TE_START" = "2026-06-20T10:00:00Z" ]; then echo "   OK time_entries[0].start: $TE_START";
else echo "   FAIL: time_entries round-trip: $TE_START" >&2; exit 1; fi

echo ""
echo "ROUND-TRIP PASSED — the API returns plaintext."
echo "NOTE: this does NOT prove ciphertext at rest. Inspect the server DB on the host:"
echo "  docker exec <pb-container> sqlite3 /pb_data/data.db \\"
echo "    \"select substr(title,1,12), substr(tags,1,12) from tasks limit 5;\""
