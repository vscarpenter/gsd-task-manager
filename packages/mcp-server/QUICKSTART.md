# Quick Start Guide

Get your GSD MCP server running in 5 minutes.

## 1. Build (if not already done)

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server
npm install
npm run build
```

## 2. Get Your Auth Token

**From Browser (Easiest)**

1. Open GSD Task Manager in your browser
2. Sign in with Google/GitHub OAuth
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to: Application → Storage → Local Storage
5. Find the PocketBase auth token
6. Copy the value

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
        "GSD_POCKETBASE_URL": "https://api.vinny.io",
        "GSD_AUTH_TOKEN": "your-auth-token-here"
      }
    }
  }
}
```

**Important**:
- Replace the `GSD_AUTH_TOKEN` value with your actual token
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
- Token expired - re-authenticate via OAuth in the GSD app
- Make sure you copied the full token

**Error: "Cannot find module"**
- Run `npm run build` again
- Check path to dist/index.js is absolute

**No MCP tools available in Claude**
- Restart Claude Desktop
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

## Development Mode

To see debug output:

```bash
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-token"
node dist/index.js
```

The server will print "GSD MCP Server running on stdio" when ready.

## Next Steps

- See [README.md](README.md) for full documentation
- Try asking Claude complex questions about your tasks
- Report issues or suggest features

---

**Stuck?** Check the full README or ask in the project Discord.
