# Testing the GSD MCP Server

## Manual Testing (Without Claude Desktop)

### 1. Check Server Starts

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server

# Set environment variables
export GSD_API_URL="https://sync.gsd.vinny.dev"
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
export GSD_API_URL="https://sync.gsd.vinny.dev"
export GSD_AUTH_TOKEN="your-token"
cat test-list-tools.json | node dist/index.js
```

Expected: JSON response with 3 tools (get_sync_status, list_devices, get_task_stats)

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
How much storage am I using?
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

**Wrong API URL**:
1. Set GSD_API_URL to invalid URL
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

### Test API Directly

Test Worker API without MCP:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://sync.gsd.vinny.dev/api/sync/status
```

Should return sync status JSON.

## Common Issues

### Issue: Server not showing in Claude Desktop
- Check config file syntax (valid JSON)
- Verify absolute path to dist/index.js
- Restart Claude Desktop completely
- Check logs for startup errors

### Issue: 401 Unauthorized
- Token expired - get fresh token
- Token format incorrect - should start with `eyJ`
- API URL wrong - check environment matches

### Issue: Tools return empty/null data
- User might not have any synced tasks yet
- Check Worker API is deployed and accessible
- Verify database has data

### Issue: Module import errors
- Run `npm install` in mcp-server directory
- Rebuild with `npm run build`
- Check Node version >= 18

## Success Criteria

✅ Server starts without errors
✅ Lists 3 tools when queried
✅ get_sync_status returns valid data
✅ list_devices returns array of devices
✅ get_task_stats returns counts
✅ Claude Desktop shows tools available
✅ Claude can call tools and get responses
✅ Error handling works (401, connection errors, etc.)

## Next Steps

After successful testing:

1. Document your findings
2. Try advanced queries with Claude
3. Monitor performance and errors
4. Suggest improvements
5. Consider implementing decryption support

## Known Limitations (v0.1.0)

- No task content access (encrypted blobs)
- Limited stats (derived from sync status)
- Token must be manually refreshed
- No write operations
- Metadata only

These are intentional for the PoC!
