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
# This creates a temporary user and task on the target server and DELETES both on
# exit. The user is required: docker/pb_hooks/account_lifecycle.pb.js refuses a
# task whose owner is not a live users record.
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

AUTH_PAYLOAD_FILE=$(mktemp)
PB_CURL_CONFIG=$(mktemp)
chmod 600 "$AUTH_PAYLOAD_FILE" "$PB_CURL_CONFIG"

TOKEN=""
ID=""
OWNER=""
# Best-effort cleanup: delete the temporary records we created so the target
# isn't littered, even if an assertion fails partway through. The task goes
# first so a failure here cannot strand it behind a deleted owner.
remove_record() {
  local collection="$1" record="$2" label="$3"
  [ -n "$record" ] || return 0
  if curl --config "$PB_CURL_CONFIG" -sf -X DELETE \
      "$PB_URL/api/collections/$collection/records/$record" >/dev/null 2>&1; then
    echo "   cleaned up $label $record"
  else
    echo "   WARN: could not delete $label $record — remove it manually" >&2
  fi
}

cleanup() {
  if [ -n "$TOKEN" ]; then
    remove_record tasks "$ID" "test record"
    remove_record users "$OWNER" "test user"
  fi
  rm -f "$AUTH_PAYLOAD_FILE" "$PB_CURL_CONFIG"
}
trap cleanup EXIT

echo "1) authenticate against $PB_URL"
jq -n '{identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD}' > "$AUTH_PAYLOAD_FILE"
TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'content-type: application/json' \
  --data-binary @"$AUTH_PAYLOAD_FILE" | jq -r .token)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "   FAIL: could not authenticate superuser at $PB_URL" >&2
  exit 1
fi

printf 'header = "Authorization: %s"\n' "$TOKEN" > "$PB_CURL_CONFIG"
echo "2) create a temporary owning user"
# The account-lifecycle hook refuses a task whose owner is not a live users
# record, so the round-trip needs a real account to own its throwaway task.
OWNER_PASSWORD="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
OWNER_REC=$(curl -s -X POST "$PB_URL/api/collections/users/records" \
  --config "$PB_CURL_CONFIG" -H 'content-type: application/json' \
  -d "$(jq -n --arg email "verify-remote-$$@example.com" --arg password "$OWNER_PASSWORD" \
    '{email: $email, password: $password, passwordConfirm: $password}')")
OWNER=$(echo "$OWNER_REC" | jq -r .id)
if [ -z "$OWNER" ] || [ "$OWNER" = "null" ]; then
  echo "   FAIL: could not create the owning user: $OWNER_REC" >&2
  exit 1
fi
echo "   created owning user id=$OWNER"

echo "3) create a temporary task with non-empty json fields"
TASK_ID="verify-remote-$$"
# `curl -s` rather than `-sf`: under `set -e` a failing `-f` aborts the
# assignment, so the FAIL branch below never reports the server's reason.
REC=$(curl -s -X POST "$PB_URL/api/collections/tasks/records" \
  --config "$PB_CURL_CONFIG" -H 'content-type: application/json' \
  -d "$(jq -n --arg task_id "$TASK_ID" --arg owner "$OWNER" '{
    task_id: $task_id,
    owner: $owner,
    title: "Buy milk",
    description: "2%",
    tags: ["home", "work"],
    subtasks: [{ id: "s1", title: "step one", completed: false }],
    time_entries: [{ start: "2026-06-20T10:00:00Z", end: "2026-06-20T10:30:00Z" }]
  }')")
ID=$(echo "$REC" | jq -r .id)
if [ -z "$ID" ] || [ "$ID" = "null" ]; then
  echo "   FAIL: record creation failed: $REC" >&2
  exit 1
fi
echo "   created record id=$ID"

echo "4) read it back and ASSERT plaintext round-trip over the API"
API_REC=$(curl --config "$PB_CURL_CONFIG" -sf \
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
