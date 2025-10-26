#!/bin/bash
# Direct test with your token

cd "$(dirname "$0")"

# Your token
export GSD_API_URL="https://gsd-sync-worker-production.vscarpenter.workers.dev"
export GSD_AUTH_TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"

echo "🧪 Testing GSD MCP Server"
echo "=========================="
echo ""
echo "1. Testing tool list..."

# Test tools list
RESULT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | timeout 3 node dist/index.js 2>&1)

if echo "$RESULT" | grep -q "get_sync_status"; then
    echo "   ✅ Tools available: get_sync_status, list_devices, get_task_stats"
else
    echo "   ❌ Failed to list tools"
    echo "   Output: $RESULT"
    exit 1
fi

echo ""
echo "2. Testing sync status call..."

# Test actual API call
SYNC_RESULT=$(cat <<'EOF' | timeout 5 node dist/index.js 2>&1
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_sync_status", "arguments": {}}}
EOF
)

echo "$SYNC_RESULT"

if echo "$SYNC_RESULT" | grep -q "lastSyncAt\|deviceCount"; then
    echo ""
    echo "   ✅ Sync status retrieved successfully!"
else
    echo ""
    echo "   ⚠️  Couldn't retrieve sync status"
    echo "   This might mean:"
    echo "   - Token expired (get a new one)"
    echo "   - Worker API not accessible"
    echo "   - Account not set up for sync yet"
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "The server is working! Now configure Claude Desktop:"
echo ""
echo "File: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
echo "{"
echo '  "mcpServers": {'
echo '    "gsd-tasks": {'
echo '      "command": "node",'
echo "      \"args\": [\"$(pwd)/dist/index.js\"],"
echo '      "env": {'
echo '        "GSD_API_URL": "https://sync.gsd.vinny.dev",'
echo "        \"GSD_AUTH_TOKEN\": \"$GSD_AUTH_TOKEN\""
echo '      }'
echo '    }'
echo '  }'
echo "}"
echo ""
echo "Then:"
echo "1. Restart Claude Desktop (Cmd+Q, then reopen)"
echo "2. Ask Claude: 'What is my GSD sync status?'"
echo ""
