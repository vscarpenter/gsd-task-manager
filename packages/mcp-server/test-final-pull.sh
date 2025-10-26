#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"

echo "Testing pull with sinceTimestamp: 1"
echo "===================================="

RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"mcp-server","lastVectorClock":{},"sinceTimestamp":1,"limit":10}' \
  https://gsd-sync-worker-production.vscarpenter.workers.dev/api/sync/pull)

echo "$RESPONSE" | jq '.'

TASK_COUNT=$(echo "$RESPONSE" | jq -r '.tasks | length // 0')
HAS_ERROR=$(echo "$RESPONSE" | jq -r '.error // "none"')

echo ""
echo "Summary:"
echo "  Task count: $TASK_COUNT"
echo "  Error: $HAS_ERROR"

if [ "$HAS_ERROR" != "none" ]; then
  echo ""
  echo "❌ Pull failed with error: $HAS_ERROR"
  echo "   This suggests an issue with the Worker pull handler"
  exit 1
elif [ "$TASK_COUNT" -gt 0 ]; then
  echo ""
  echo "✅ Successfully retrieved $TASK_COUNT tasks!"
  echo "   The MCP server should now be able to decrypt them"
else
  echo ""
  echo "⚠️  No tasks returned (but no error)"
  echo "   Tasks might be filtered out or not synced yet"
fi
