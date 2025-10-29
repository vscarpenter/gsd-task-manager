# 🚀 Quick Test Reference - MCP Server v0.5.0

## Setup (Do Once)
```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server
npm run build
```

**Update Claude Desktop Config:**
`~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "gsd-taskmanager": {
      "command": "node",
      "args": ["/Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server/dist/index.js"],
      "env": {
        "GSD_API_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "YOUR_TOKEN",
        "GSD_ENCRYPTION_PASSPHRASE": "YOUR_PASSPHRASE"
      }
    }
  }
}
```

**Restart Claude Desktop** (Cmd+Q, then reopen)

---

## 5-Minute Smoke Test

### 1. Server Check
```
"Validate my GSD MCP configuration"
```
✅ All 3 checks pass (API, Auth, Encryption)

### 2. Read Test
```
"List all my tasks"
```
✅ Returns tasks with full details

### 3. Analytics Test
```
"Show my productivity metrics"
```
✅ Returns completions, streaks, rates

### 4. Write Test (Creates & Deletes)
```
"Create a test task: 'MCP v0.5.0 Test', urgent=true, important=false"
```
✅ Task created, note the ID

```
"Delete the task we just created"
```
✅ Task deleted

### 5. Prompt Test
```
"Run the daily-standup prompt"
```
✅ Multi-tool report generated

---

## Common Test Prompts

### Configuration
- "Validate my setup"
- "Show me all available tools"
- "Get help with analytics tools"

### Read Operations
- "List my urgent and important tasks"
- "Show tasks tagged #work"
- "Search for tasks about 'meeting'"
- "Get details for task ID abc123"

### Analytics
- "What's my productivity this week?"
- "Analyze my quadrant distribution"
- "Show tag completion rates"
- "What deadlines are coming up?"

### Write Operations (⚠️ Modifies data)
- "Create task: 'Test', urgent=true, important=true"
- "Update task abc123 to make it not urgent"
- "Mark task abc123 complete"
- "Delete task abc123"

### Prompts
- "Run daily-standup"
- "Run focus-mode"
- "Run weekly-review"

---

## Quick Checklist

- [ ] Config validates successfully
- [ ] Can list tasks
- [ ] Can get analytics
- [ ] Can create/delete test task
- [ ] Prompts work
- [ ] No errors in Claude Desktop

**Result:** ___________

---

## Rollback If Needed

```bash
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Restart Claude Desktop
