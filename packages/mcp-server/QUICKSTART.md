# Quick Start Guide

Get your GSD MCP server running in 5 minutes.

## 1. Build (if not already done)

```bash
cd /absolute/path/to/gsd-taskmanager/packages/mcp-server
npm install
npm run build
```

## 2. Get Your Auth Token

**From Browser (Easiest)**

1. Open GSD Task Manager in your browser
2. Sign in with Google, Apple, or GitHub to enable cloud sync
3. Open **Settings → Cloud Sync → MCP access → Copy auth token**

The button copies the raw token for `GSD_AUTH_TOKEN`. Keep it private: it grants
access to your synced tasks.

## 3. Configure Claude Desktop

**Find config file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Edit the file** (create if it doesn't exist):

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "node",
      "args": [
        "/absolute/path/to/gsd-taskmanager/packages/mcp-server/dist/index.js"
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
- Replace the sample path with the absolute path to `dist/index.js` on your machine

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
When does my MCP token expire?
```

```
How many tasks do I have?
```

If working, Claude will respond with actual data from your GSD account! A working
setup reports `"healthy": true` for the sync status. A broken one reports
`"healthy": false` without an error, so check that field. Task counts that come
back null also mean the read failed.

## Troubleshooting

**Error: "Configuration error"**
- Check environment variables are set in Claude config
- Ensure no trailing spaces in token
- Use an `https://` URL. Plain `http://` works only for localhost, 127.0.0.1, or [::1]
- Use the token of a normal account. The server refuses administrator (superuser) tokens
- Run `node dist/index.js --validate` with both variables set for a full diagnostic

**Error: "Not authenticated as a normal users-collection account"**
- The token expired or was revoked. Sign in to the GSD app again
- Copy a new token (step 2), put it in the config (step 3), and restart Claude Desktop
- Make sure you copied the full token

**Error: "Cannot find module"**
- Run `npm run build` again
- Check path to dist/index.js is absolute

**No MCP tools available in Claude**
- Restart Claude Desktop
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

## Development Mode

To watch the server's log:

```bash
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-token"
node dist/index.js
```

The server writes its log to stderr as JSON lines. When ready, it writes a line whose
`message` is "GSD MCP Server running on stdio".

## Next Steps

- See [README.md](README.md) for full documentation
- Try asking Claude complex questions about your tasks
- Report issues or suggest features at https://github.com/vscarpenter/gsd-task-manager/issues

---

**Stuck?** Check the full README, or open an issue at the link above.
