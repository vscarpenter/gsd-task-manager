# Testing the GSD MCP Server

## Manual Testing (Without Claude Desktop)

### 1. Check Server Starts

```bash
cd /absolute/path/to/gsd-taskmanager/packages/mcp-server

# Set environment variables
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-token-here"

# Start server (will wait for MCP protocol input)
node dist/index.js
```

Expected output: a JSON log line on stderr whose `message` field is:
```
GSD MCP Server running on stdio
```

Press Ctrl+C to stop.

To check the configuration without starting the server, run
`node dist/index.js --validate` with the same variables set.

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
3. Ask: "What GSD tools are available?"

If the MCP server is loaded, Claude lists the GSD tools.

### 2. Functional Tests

Ask Claude these questions to test a few of the tools:

**Sync Status**:
```
What's my GSD sync status?
Is the sync backend healthy?
```

**Token Status**:
```
When does my MCP token expire?
Do I need to re-authenticate?
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
2. Ask to list your tasks
3. Should get "Not authenticated as a normal users-collection account"
4. Ask for sync status. It reports `"healthy": false` instead of an error

**Wrong PocketBase URL**:
1. Set GSD_POCKETBASE_URL to an `https://` host that doesn't exist
2. Ask to list your tasks
3. Should get a connection error, such as "Failed to fetch tasks from PocketBase"

A URL that isn't HTTPS (other than localhost) stops the server at startup, so
Claude Desktop shows no tools at all.

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
- Error messages

### Enable Verbose Logging

The server has no verbose mode today. The logger in `src/utils/logger.ts` reads
`LOG_LEVEL=debug`, but no code writes a debug line yet. To trace tool calls, create a
logger with `createMcpLogger` in `src/tools/handlers/index.ts`, call its `debug`
method where that file handles a call, rebuild, and start the server with
`LOG_LEVEL=debug`.

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

### Issue: "Not authenticated as a normal users-collection account"
- Token expired. Sign in to the GSD app again, copy a new token, update the config, and restart Claude Desktop
- Token format incorrect
- PocketBase URL wrong. `GSD_POCKETBASE_URL` must be the server that issued the token

### Issue: Tools return empty/null data
- All-null task statistics mean the read failed. An empty account returns zero counts
- User might not have any synced tasks yet
- Check PocketBase is running and accessible
- Verify database has data

### Issue: Module import errors
- Run `npm install` in mcp-server directory
- Rebuild with `npm run build`
- Check Node version >= 18

## Success Criteria

- Server starts without errors
- The tools you tried return valid data when queried
- Claude Desktop shows tools available
- Claude can call tools and get responses
- Error handling works (sign-in error, connection errors, etc.)
