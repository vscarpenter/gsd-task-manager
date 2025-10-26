#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"

echo "Testing pull with sinceTimestamp: 1 (epoch + 1ms)"
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"mcp-server","lastVectorClock":{},"sinceTimestamp":1,"limit":10}' \
  https://gsd-sync-worker-production.vscarpenter.workers.dev/api/sync/pull | jq '.'
