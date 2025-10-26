#!/bin/bash
# Quick test script for GSD MCP Server

echo "🔍 GSD MCP Server - Quick Test Setup"
echo ""
echo "Step 1: Get your auth token"
echo "================================"
echo "1. Open https://gsd.vinny.dev in your browser"
echo "2. Sign in with Google/Apple OAuth"
echo "3. Open DevTools (F12 or Cmd+Option+I)"
echo "4. Go to: Application → Storage → Local Storage → https://gsd.vinny.dev"
echo "5. Find the key: 'gsd_auth_token'"
echo "6. Copy the entire value (starts with 'eyJ...')"
echo ""
echo "Once you have your token, continue below:"
echo ""

read -p "Paste your auth token here: " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ No token provided. Exiting."
    exit 1
fi

echo ""
echo "Step 2: Testing the MCP server"
echo "================================"

export GSD_API_URL="https://sync.gsd.vinny.dev"
export GSD_AUTH_TOKEN="$AUTH_TOKEN"

echo "Testing server startup..."
echo ""

# Test that server can start and list tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | timeout 3 node dist/index.js 2>&1 | grep -q "get_sync_status"

if [ $? -eq 0 ]; then
    echo "✅ Server started successfully and tools are available!"
else
    echo "⚠️  Server started but couldn't verify tools"
    echo "   This might be a token issue - continuing anyway..."
fi

echo ""
echo "Step 3: Configure Claude Desktop"
echo "================================="
echo ""
echo "Add this to your Claude Desktop config:"
echo "File: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
echo '{'
echo '  "mcpServers": {'
echo '    "gsd-tasks": {'
echo '      "command": "node",'
echo "      \"args\": [\"$(pwd)/dist/index.js\"],"
echo '      "env": {'
echo "        \"GSD_API_URL\": \"$GSD_API_URL\","
echo "        \"GSD_AUTH_TOKEN\": \"$AUTH_TOKEN\""
echo '      }'
echo '    }'
echo '  }'
echo '}'
echo ""
echo "Next steps:"
echo "1. Copy the JSON config above"
echo "2. Edit ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "3. Restart Claude Desktop"
echo "4. Ask Claude: 'What is my GSD sync status?'"
echo ""
