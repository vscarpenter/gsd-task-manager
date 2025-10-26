#!/bin/bash
# Manual test - replace YOUR_TOKEN with your actual token

# Set these variables
export GSD_API_URL="https://sync.gsd.vinny.dev"
export GSD_AUTH_TOKEN="YOUR_TOKEN_HERE"  # Replace this!

cd "$(dirname "$0")"

echo "Testing MCP server with your token..."
echo ""

# Create a test request to list tools
cat <<EOF | timeout 5 node dist/index.js
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
EOF

echo ""
echo ""
echo "If you see a list of 3 tools above, it works!"
echo "Next step: Configure Claude Desktop (see QUICKSTART.md)"
