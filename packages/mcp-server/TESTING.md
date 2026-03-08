# Testing the GSD MCP Server

## Manual Testing (Without Claude Desktop)

### 1. Check Server Starts

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server

# Set environment variables
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-token-here"

# Start server (will wait for MCP protocol input)
node dist/index.js
```

Expected output:
```
GSD MCP Server running on stdio
```

Press Ctrl+C to stop.

### 2. Test Tool Discovery

Create a test file `test-list-tools.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

Then run:

```bash
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-token"
cat test-list-tools.json | node dist/index.js
```

Expected: JSON response with available tools

### 3. Test Sync Status Tool

Create `test-sync-status.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_sync_status",
    "arguments": {}
  }
}
```

Run:

```bash
cat test-sync-status.json | node dist/index.js
```

Expected: JSON response with sync status data

## Testing with Claude Desktop

### 1. Installation Test

After configuring Claude Desktop (see QUICKSTART.md):

1. Open Claude Desktop
2. Start new conversation
3. Type: `/mcp-tools` (if available) or just ask a question

If MCP server is loaded, you'll see tools available.

### 2. Functional Tests

Ask Claude these questions to test each tool:

**Sync Status**:
```
What's my GSD sync status?
When was my last sync?
Do I have any conflicts?
```

**Device List**:
```
Show me all my GSD devices
What devices are connected?
Which device was last active?
```

**Task Stats**:
```
How many tasks do I have?
Give me task statistics
What's my total task count?
```

### 3. Error Handling Tests

**Expired Token**:
1. Use an old/invalid token
2. Ask for sync status
3. Should get 401 error message

**Wrong PocketBase URL**:
1. Set GSD_POCKETBASE_URL to invalid URL
2. Ask for device list
3. Should get connection error

**Missing Config**:
1. Remove env vars from Claude config
2. Restart Claude Desktop
3. Should see configuration error in logs

## Debugging

### Check Claude Desktop Logs

**macOS**:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Windows**:
```bash
Get-Content $env:APPDATA\Claude\logs\mcp*.log -Wait
```

Look for:
- Server startup messages
- Tool invocation logs
- Error messages
- API request/response info

### Enable Verbose Logging

Add to index.ts (for development):

```typescript
console.error('Tool called:', name);
console.error('Arguments:', args);
console.error('Response:', JSON.stringify(result));
```

Rebuild and test.

### Test PocketBase API Directly

Test PocketBase API without MCP:

```bash
curl https://api.vinny.io/api/health
```

Should return health status JSON.

## Common Issues

### Issue: Server not showing in Claude Desktop
- Check config file syntax (valid JSON)
- Verify absolute path to dist/index.js
- Restart Claude Desktop completely
- Check logs for startup errors

### Issue: 401 Unauthorized
- Token expired - re-authenticate via OAuth
- Token format incorrect
- PocketBase URL wrong - check environment matches

### Issue: Tools return empty/null data
- User might not have any synced tasks yet
- Check PocketBase is running and accessible
- Verify database has data

### Issue: Module import errors
- Run `npm install` in mcp-server directory
- Rebuild with `npm run build`
- Check Node version >= 18

## Success Criteria

- Server starts without errors
- All tools return valid data when queried
- Claude Desktop shows tools available
- Claude can call tools and get responses
- Error handling works (401, connection errors, etc.)
