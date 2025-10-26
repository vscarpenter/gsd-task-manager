#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"

echo "Testing exact request that MCP server sends"
echo "============================================"
echo ""
echo "Request body:"
echo '{
  "deviceId": "9Sc6Q_f_mj_pjhRkDM-vZg",
  "lastVectorClock": {},
  "sinceTimestamp": 1,
  "limit": 1000
}' | jq '.'

echo ""
echo "Making request..."

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"9Sc6Q_f_mj_pjhRkDM-vZg","lastVectorClock":{},"sinceTimestamp":1,"limit":1000}' \
  https://gsd-sync-worker-production.vscarpenter.workers.dev/api/sync/pull)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo ""
echo "Response (HTTP $HTTP_CODE):"
echo "$BODY" | jq '.'

if [ "$HTTP_CODE" = "200" ]; then
  TASK_COUNT=$(echo "$BODY" | jq -r '.tasks | length')
  echo ""
  echo "✅ Success! Retrieved $TASK_COUNT tasks"
else
  echo ""
  echo "❌ Request failed with HTTP $HTTP_CODE"
  echo ""
  echo "This is the EXACT same request the MCP server sends."
  echo "If this fails, the issue is with the Worker or the request format."
fi
