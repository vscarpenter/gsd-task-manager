# MCP Server - Pre-Deployment Test Plan

## Overview
Test the MCP server in Claude Desktop to ensure all functionality works before publishing to npm.

**Test Duration:** ~10 minutes for the quick suite, ~20 minutes for the full suite. Run the quick suite for a fast check. Run both before a release.
**Test Date:** ___________
**Tester:** ___________

---

## Pre-Test Setup

### 1. Build the New Version
```bash
cd /absolute/path/to/gsd-taskmanager/packages/mcp-server
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

**Replace the `gsd-tasks` entry with** (use your own path and token):
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
- [ ] Task Access: success

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

**Prompt:** "Delete the task we just created, with dryRun false"
- [ ] Task deleted successfully (without `dryRun: false`, `delete_task` only previews)

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
- PocketBase: [ ] success  Auth: [ ] success  Task Access: [ ] success

#### 1.2 Get Help
**Prompt:** "Show me all available GSD tools"
- [ ] Pass [ ] Fail
- Shows tools organized by category

#### 1.3 Cache Stats
**Prompt:** "Show me cache performance"
- [ ] Pass [ ] Fail

---

### Phase 2: Read Tools (Non-Destructive)

#### 2.1 Sync Status
**Prompt:** "What's my sync status?"
- [ ] Pass [ ] Fail
- Pass only if the reply has `"healthy": true`. The tool reports a failure as `"healthy": false`, not as an error

#### 2.2 Token Status
**Prompt:** "When does my MCP token expire?"
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

#### 2.8 Top Three
**Prompt:** "What are my top three for today?"
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
**Prompt:** "Delete [ID from 4.1] with dryRun false"
- [ ] Pass [ ] Fail

#### 4.5 Bulk Update (Optional)
**Prompt:** "Create 3 test tasks, then complete all at once"
- [ ] Pass [ ] Skip [ ] Fail

---

### Phase 5: Prompts

#### 5.1 Daily Standup
**Prompt:** "Run the daily-standup prompt"
- [ ] Pass [ ] Fail

#### 5.2 Focus Mode
**Prompt:** "Run the focus-mode prompt"
- [ ] Pass [ ] Fail

#### 5.3 Weekly Review
**Prompt:** "Run the weekly-review prompt"
- [ ] Pass [ ] Fail

---

### Phase 6: Error Handling

#### 6.1 Invalid Task ID
**Prompt:** "Get task 'invalid-id-12345'"
- [ ] Graceful error message

---

## Results Summary

**Tests Run:** ___ / 30 (5 quick, 25 full)
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
cd /absolute/path/to/gsd-taskmanager/packages/mcp-server
bun run version:patch
```

`version:patch` changes only this package's `package.json`. Other files hold the
version too: this package's README and CHANGELOG, the root `bun.lock`, `public/index.md`,
`public/.well-known/mcp/server-card.json`, and `components/about/mcp-section.tsx`.
Search the repo for the old version and update each copy.

Merge the version bump to `main` through a pull request. Then push a tag that
matches the new `package.json` version:

```bash
git tag mcp-vX.Y.Z
git push origin mcp-vX.Y.Z
```

The `Publish MCP Server` workflow (`.github/workflows/publish-mcp-server.yml`) runs
the audit, typecheck, tests, and build, then publishes to npm. Restore your Claude
Desktop config with the rollback command below when you finish.

### If FAIL -> Rollback
```bash
# Restore config backup
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Restart Claude Desktop and investigate issues
```
