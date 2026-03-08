# MCP Server - Pre-Deployment Test Plan

## Overview
Test the MCP server in Claude Desktop to ensure all functionality works before publishing to npm.

**Test Duration:** ~15-20 minutes
**Test Date:** ___________
**Tester:** ___________

---

## Pre-Test Setup

### 1. Build the New Version
```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server
npm run build
```
- Build successful
- No TypeScript errors

### 2. Backup Current Claude Desktop Config
```bash
# macOS
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup

# Verify backup exists
ls -l ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
```

### 3. Update Claude Desktop Config to Use Local Build
Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Replace the gsd-mcp-server entry with:**
```json
{
  "mcpServers": {
    "gsd-taskmanager": {
      "command": "node",
      "args": [
        "/Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "GSD_POCKETBASE_URL": "https://api.vinny.io",
        "GSD_AUTH_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### 4. Restart Claude Desktop
- Quit Claude Desktop completely (Cmd+Q)
- Reopen Claude Desktop
- Wait for MCP servers to initialize (~5 seconds)

---

## Quick Test Suite (Core Functionality - 10 min)

### Test 1: Server Initialization
**Prompt:** "Use validate_config to check my GSD MCP server setup"
- [ ] PocketBase Connectivity: success
- [ ] Authentication: success

### Test 2: Read Operations
**Prompt:** "List all my tasks"
- [ ] Returns task list with all fields
- [ ] No errors

### Test 3: Analytics
**Prompt:** "Show me my productivity metrics"
- [ ] Returns metrics (completions, streaks, rates)
- [ ] No errors

### Test 4: Write Operation (Creates test task)
**Prompt:** "Create a test task: Title 'MCP Test', urgent: true, important: false"
- [ ] Task created successfully
- [ ] Returns task ID: ___________

**Prompt:** "Delete the task we just created"
- [ ] Task deleted successfully

### Test 5: Prompts
**Prompt:** "Run the daily-standup prompt"
- [ ] Generates daily report
- [ ] Uses multiple tools
- [ ] Formatted output

---

## Full Test Suite (Comprehensive - 20 min)

### Phase 1: Configuration & Help

#### 1.1 Validate Config
**Prompt:** "Validate my GSD MCP configuration"
- [ ] Pass [ ] Fail
- PocketBase: [ ] success  Auth: [ ] success

#### 1.2 Get Help
**Prompt:** "Show me all available GSD tools"
- [ ] Pass [ ] Fail
- Shows tools organized by category

---

### Phase 2: Read Tools (Non-Destructive)

#### 2.1 Sync Status
**Prompt:** "What's my sync status?"
- [ ] Pass [ ] Fail

#### 2.2 List Devices
**Prompt:** "Show my registered devices"
- [ ] Pass [ ] Fail

#### 2.3 Task Stats
**Prompt:** "Get my task statistics"
- [ ] Pass [ ] Fail

#### 2.4 List All Tasks
**Prompt:** "List all my tasks"
- [ ] Pass [ ] Fail
- Count: ___________

#### 2.5 Filter Tasks
**Prompt:** "Show only urgent and important tasks"
- [ ] Pass [ ] Fail

#### 2.6 Get Single Task
**Prompt:** "Get details for task ID [use ID from 2.4]"
- [ ] Pass [ ] Fail

#### 2.7 Search Tasks
**Prompt:** "Search for tasks about 'project'"
- [ ] Pass [ ] Fail

---

### Phase 3: Analytics Tools

#### 3.1 Productivity Metrics
**Prompt:** "Show productivity metrics"
- [ ] Pass [ ] Fail

#### 3.2 Quadrant Analysis
**Prompt:** "Analyze quadrant distribution"
- [ ] Pass [ ] Fail

#### 3.3 Tag Analytics
**Prompt:** "Show tag statistics"
- [ ] Pass [ ] Fail

#### 3.4 Upcoming Deadlines
**Prompt:** "What are my upcoming deadlines?"
- [ ] Pass [ ] Fail

#### 3.5 Task Insights
**Prompt:** "Give me task insights summary"
- [ ] Pass [ ] Fail

---

### Phase 4: Write Tools (Modifies Data)

#### 4.1 Create Task
**Prompt:** "Create task: 'MCP Test', urgent=true, important=false, tags=['#test']"
- [ ] Pass [ ] Fail
- Task ID: ___________

#### 4.2 Update Task
**Prompt:** "Update [ID from 4.1] to make it not urgent"
- [ ] Pass [ ] Fail

#### 4.3 Complete Task
**Prompt:** "Mark [ID from 4.1] complete"
- [ ] Pass [ ] Fail

#### 4.4 Delete Task
**Prompt:** "Delete [ID from 4.1]"
- [ ] Pass [ ] Fail

#### 4.5 Bulk Update (Optional)
**Prompt:** "Create 3 test tasks, then complete all at once"
- [ ] Pass [ ] Skip [ ] Fail

---

### Phase 5: Prompts

#### 5.1 Daily Standup
- [ ] Pass [ ] Fail

#### 5.2 Focus Mode
- [ ] Pass [ ] Fail

#### 5.3 Weekly Review
- [ ] Pass [ ] Fail

---

### Phase 6: Error Handling

#### 6.1 Invalid Task ID
**Prompt:** "Get task 'invalid-id-12345'"
- [ ] Graceful error message

---

## Results Summary

**Tests Run:** ___ / 30
**Passed:** ___
**Failed:** ___
**Skipped:** ___

### Decision
- [ ] DEPLOY - All critical tests passed
- [ ] DEPLOY WITH CAUTION - Minor issues only
- [ ] DO NOT DEPLOY - Critical failures

---

## Post-Test Actions

### If PASS -> Publish
```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server
bun run version:patch
npm run build
npm publish
```

### If FAIL -> Rollback
```bash
# Restore config backup
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Restart Claude Desktop and investigate issues
```
