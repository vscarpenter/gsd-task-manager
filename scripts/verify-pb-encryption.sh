#!/usr/bin/env bash
# Verify server-side at-rest encryption end-to-end against a local PocketBase.
# Requires: a pocketbase binary ($PB_BIN, default ./pocketbase), sqlite3, curl, jq, python3.
#
# Usage:
#   PB_BIN=/path/to/pocketbase ./scripts/verify-pb-encryption.sh
#
# This is a staging/local harness — it is NOT run in CI (no PB binary there).
# It proves Acceptance Criteria 1-3 and 5: content is ciphertext at rest in
# SQLite and plaintext over the REST API.
#
# JSON-field coercion risk (staging gate):
#   The columns tags/subtasks/time_entries are json-typed in PocketBase (see
#   scripts/setup-pocketbase-collections.sh). The encryption hook stores a bare
#   "enc:v1:<ciphertext>" string in them — NOT a JSON array. Whether PocketBase
#   0.26.6's json column accepts a bare string is only provable against a running
#   instance. This harness now asserts ciphertext-at-rest AND full array round-trip
#   for all three json fields. If ANY of those assertions FAIL at staging, the
#   remedy is to change the three columns (tags, subtasks, time_entries) from json
#   type to text type in scripts/setup-pocketbase-collections.sh and re-confirm
#   that the decrypt hook still returns arrays over the REST API after that change.
set -euo pipefail

PB_BIN="${PB_BIN:-./pocketbase}"
KEY="$(openssl rand -hex 16)"            # 32 hex chars
WORK="$(mktemp -d)"
ADMIN_EMAIL="verify@example.com"
ADMIN_PASS="verify-pass-1234"

# Kill the background PocketBase process and remove the temp working dir on exit.
trap 'kill "${PB_PID:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

for cmd in curl jq sqlite3 python3 openssl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 1
  fi
done
# Note: python3 is required by setup-pocketbase-collections.sh, invoked in step 2

echo "1) start PocketBase with the encryption hook"
GSD_TASKS_ENC_KEY="$KEY" "$PB_BIN" serve \
  --dir="$WORK" --hooksDir=docker/pb_hooks --migrationsDir=docker/pb_migrations \
  --http=127.0.0.1:8099 >"$WORK/pb.log" 2>&1 &
PB_PID=$!

echo "   waiting for PocketBase to be ready..."
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:8099/api/health >/dev/null && break
  sleep 1
done

if ! curl -sf http://127.0.0.1:8099/api/health >/dev/null 2>&1; then
  echo "FAIL: PocketBase did not start in 30s; check $WORK/pb.log" >&2
  exit 1
fi

echo "2) create superuser + tasks collection"
"$PB_BIN" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASS" --dir="$WORK" >/dev/null

# setup-pocketbase-collections.sh reads credentials from env vars:
#   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
PB_URL=http://127.0.0.1:8099 \
  PB_ADMIN_EMAIL="$ADMIN_EMAIL" \
  PB_ADMIN_PASSWORD="$ADMIN_PASS" \
  bash scripts/setup-pocketbase-collections.sh >/dev/null

echo "3) authenticate and create a task via the API"
# PocketBase 0.23+ admin auth endpoint
TOKEN=$(curl -sf -X POST http://127.0.0.1:8099/api/collections/_superusers/auth-with-password \
  -H 'content-type: application/json' \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | jq -r .token)

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "   FAIL: could not authenticate superuser" >&2
  exit 1
fi

# Create a task with non-empty json fields so the at-rest and round-trip assertions
# cover the json-typed columns (tags, subtasks, time_entries), not just text fields.
REC=$(curl -sf -X POST http://127.0.0.1:8099/api/collections/tasks/records \
  -H "Authorization: $TOKEN" -H 'content-type: application/json' \
  -d '{
    "task_id":"t1",
    "owner":"verify",
    "title":"Buy milk",
    "description":"2%",
    "tags":["home","work"],
    "subtasks":[{"id":"s1","title":"step one","completed":false}],
    "time_entries":[{"start":"2026-06-20T10:00:00Z","end":"2026-06-20T10:30:00Z"}]
  }')
ID=$(echo "$REC" | jq -r .id)

if [[ -z "$ID" || "$ID" == "null" ]]; then
  echo "   FAIL: record creation failed: $REC" >&2
  exit 1
fi
echo "   created record id=$ID"

echo "4) ASSERT ciphertext at rest in SQLite"
# PocketBase stores its database as data.db under the --dir path.
# Staging assumption: confirm this filename against the running PB version if the
# query returns no rows.

# title (text column)
RAW=$(sqlite3 "$WORK/data.db" "select title from tasks where id='$ID';")
case "$RAW" in
  enc:v1:*) echo "   OK at-rest title: $RAW" ;;
  *) echo "   FAIL: title stored as plaintext: $RAW" >&2; exit 1 ;;
esac

# tags (json column — must store bare enc:v1: ciphertext, not a JSON array)
RAW=$(sqlite3 "$WORK/data.db" "select tags from tasks where id='$ID';")
case "$RAW" in
  enc:v1:*) echo "   OK at-rest tags: $RAW" ;;
  *) echo "   FAIL: tags stored as plaintext or rejected by PB json column: $RAW" >&2; exit 1 ;;
esac

# subtasks (json column)
RAW=$(sqlite3 "$WORK/data.db" "select subtasks from tasks where id='$ID';")
case "$RAW" in
  enc:v1:*) echo "   OK at-rest subtasks: $RAW" ;;
  *) echo "   FAIL: subtasks stored as plaintext or rejected by PB json column: $RAW" >&2; exit 1 ;;
esac

# time_entries (json column)
RAW=$(sqlite3 "$WORK/data.db" "select time_entries from tasks where id='$ID';")
case "$RAW" in
  enc:v1:*) echo "   OK at-rest time_entries: $RAW" ;;
  *) echo "   FAIL: time_entries stored as plaintext or rejected by PB json column: $RAW" >&2; exit 1 ;;
esac

echo "5) ASSERT plaintext over the REST API"
API_REC=$(curl -sf -H "Authorization: $TOKEN" \
  "http://127.0.0.1:8099/api/collections/tasks/records/$ID")

# title
VIEW=$(echo "$API_REC" | jq -r .title)
if [ "$VIEW" = "Buy milk" ]; then
  echo "   OK over-API title: $VIEW"
else
  echo "   FAIL: API returned title: $VIEW" >&2
  exit 1
fi

# tags — must round-trip to ["home","work"]
TAGS=$(echo "$API_REC" | jq -c '.tags')
if [ "$TAGS" = '["home","work"]' ]; then
  echo "   OK over-API tags: $TAGS"
else
  echo "   FAIL: API returned tags: $TAGS (expected [\"home\",\"work\"])" >&2
  exit 1
fi

# subtasks — check first entry's title and completed fields
SUBTASK_TITLE=$(echo "$API_REC" | jq -r '.subtasks[0].title')
SUBTASK_DONE=$(echo "$API_REC" | jq -r '.subtasks[0].completed')
if [ "$SUBTASK_TITLE" = "step one" ] && [ "$SUBTASK_DONE" = "false" ]; then
  echo "   OK over-API subtasks[0]: title=$SUBTASK_TITLE completed=$SUBTASK_DONE"
else
  echo "   FAIL: API returned subtasks[0].title=$SUBTASK_TITLE completed=$SUBTASK_DONE (expected step one / false)" >&2
  exit 1
fi

# time_entries — check first entry's start field
TE_START=$(echo "$API_REC" | jq -r '.time_entries[0].start')
if [ "$TE_START" = "2026-06-20T10:00:00Z" ]; then
  echo "   OK over-API time_entries[0].start: $TE_START"
else
  echo "   FAIL: API returned time_entries[0].start=$TE_START (expected 2026-06-20T10:00:00Z)" >&2
  exit 1
fi

echo ""
echo "ALL CHECKS PASSED"
