#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"

echo "Testing with limit: 100 (valid)"
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"9Sc6Q_f_mj_pjhRkDM-vZg","lastVectorClock":{},"sinceTimestamp":1,"limit":100}' \
  https://gsd-sync-worker-production.vscarpenter.workers.dev/api/sync/pull)

TASK_COUNT=$(echo "$RESPONSE" | jq -r '.tasks | length // 0')
HAS_ERROR=$(echo "$RESPONSE" | jq -r '.error // "none"')

if [ "$HAS_ERROR" != "none" ]; then
  echo "❌ Error: $HAS_ERROR"
else
  echo "✅ Success! Retrieved $TASK_COUNT tasks"
fi
