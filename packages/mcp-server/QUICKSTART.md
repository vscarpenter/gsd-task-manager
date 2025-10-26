# Quick Start Guide

Get your GSD MCP server running in 5 minutes.

## 1. Build (if not already done)

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server
npm install
npm run build
```

## 2. Get Your Auth Token

**Option 1: From Browser (Easiest)**

1. Open https://gsd.vinny.dev in your browser
2. Sign in with Google/Apple OAuth
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to: Application → Storage → Local Storage → https://gsd.vinny.dev
5. Find key: `gsd_auth_token`
6. Copy the value (it's a long JWT string starting with `eyJ...`)

**Option 2: From Sync Settings (if available)**

1. Open GSD → Settings → Sync
2. Look for "MCP Server Setup" section
3. Click "Copy Token"

## 3. Configure Claude Desktop

**Find config file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Edit the file** (create if it doesn't exist):

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "node",
      "args": [
        "/Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "GSD_API_URL": "https://sync.gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

**Important**:
- Replace the `GSD_AUTH_TOKEN` value with your actual token
- If testing locally, use `http://localhost:8787` for `GSD_API_URL`
- Use absolute path to `dist/index.js`

## 4. Restart Claude Desktop

1. Quit Claude Desktop completely (Cmd+Q on Mac)
2. Reopen Claude Desktop
3. Start a new conversation

## 5. Test It!

Try these prompts in Claude Desktop:

```
What's my GSD sync status?
```

```
Show me all my connected devices
```

```
How many tasks do I have?
```

If working, Claude will respond with actual data from your GSD account!

## Troubleshooting

**Error: "Configuration error"**
- Check environment variables are set in Claude config
- Ensure no trailing spaces in token

**Error: "401 Unauthorized"**
- Token expired - get a new one from browser
- Make sure you copied the full token

**Error: "Cannot find module"**
- Run `npm run build` again
- Check path to dist/index.js is absolute

**No MCP tools available in Claude**
- Restart Claude Desktop
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

## Token Refresh

JWT tokens expire (typically after 7 days). When you get 401 errors:

1. Get fresh token from browser (see step 2 above)
2. Update `GSD_AUTH_TOKEN` in Claude config
3. Restart Claude Desktop

## Development Mode

To see debug output:

```bash
export GSD_API_URL="https://sync.gsd.vinny.dev"
export GSD_AUTH_TOKEN="your-token"
node dist/index.js
```

The server will print "GSD MCP Server running on stdio" when ready.

## Next Steps

- See [README.md](README.md) for full documentation
- Try asking Claude complex questions about your tasks
- Report issues or suggest features
- Consider contributing decryption support for task content access

---

**Stuck?** Check the full README or ask in the project Discord.
