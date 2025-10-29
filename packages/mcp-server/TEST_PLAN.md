# MCP Server v0.5.0 - Pre-Deployment Test Plan

## Overview
Test the refactored MCP server (v0.5.0) in Claude Desktop to ensure all functionality works before committing to git and publishing to npm.

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
✅ Build successful
✅ No TypeScript errors

### 2. Backup Current Claude Desktop Config
```bash
# macOS
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup

# Verify backup exists
ls -l ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
```
✅ Backup created: ___________

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
        "GSD_API_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "YOUR_TOKEN_HERE",
        "GSD_ENCRYPTION_PASSPHRASE": "YOUR_PASSPHRASE_HERE"
      }
    }
  }
}
```

✅ Config updated
✅ Token and passphrase configured

### 4. Restart Claude Desktop
- Quit Claude Desktop completely (Cmd+Q)
- Reopen Claude Desktop
- Wait for MCP servers to initialize (~5 seconds)

✅ Claude Desktop restarted
✅ No error messages in Claude Desktop logs

---

## Quick Test Suite (Core Functionality - 10 min)

### ✅ Test 1: Server Initialization
**Prompt:** "Use validate_config to check my GSD MCP server setup"
- ⬜ API Connectivity: success
- ⬜ Authentication: success
- ⬜ Encryption: success

### ✅ Test 2: Read Operations
**Prompt:** "List all my tasks"
- ⬜ Returns task list with all fields
- ⬜ No errors

### ✅ Test 3: Analytics
**Prompt:** "Show me my productivity metrics"
- ⬜ Returns metrics (completions, streaks, rates)
- ⬜ No errors

### ✅ Test 4: Write Operation (⚠️ Creates test task)
**Prompt:** "Create a test task: Title 'MCP Test v0.5.0', urgent: true, important: false"
- ⬜ Task created successfully
- ⬜ Returns task ID: ___________

**Prompt:** "Delete the task we just created"
- ⬜ Task deleted successfully

### ✅ Test 5: Prompts
**Prompt:** "Run the daily-standup prompt"
- ⬜ Generates daily report
- ⬜ Uses multiple tools
- ⬜ Formatted output

---

## Full Test Suite (Comprehensive - 20 min)

### Phase 1: Configuration & Help

#### 1.1 Validate Config
**Prompt:** "Validate my GSD MCP configuration"
- ⬜ Pass ⬜ Fail
- API: ⬜ success  Auth: ⬜ success  Encryption: ⬜ success

#### 1.2 Get Help
**Prompt:** "Show me all available GSD tools"
- ⬜ Pass ⬜ Fail
- Shows 18 tools organized by category

---

### Phase 2: Read Tools (Non-Destructive)

#### 2.1 Sync Status
**Prompt:** "What's my sync status?"
- ⬜ Pass ⬜ Fail
- Shows device count, last sync

#### 2.2 List Devices
**Prompt:** "Show my registered devices"
- ⬜ Pass ⬜ Fail
- Lists all devices

#### 2.3 Task Stats
**Prompt:** "Get my task statistics"
- ⬜ Pass ⬜ Fail
- Shows counts (no decryption needed)

#### 2.4 List All Tasks
**Prompt:** "List all my tasks"
- ⬜ Pass ⬜ Fail
- Count: ___________

#### 2.5 Filter Tasks
**Prompt:** "Show only urgent and important tasks"
- ⬜ Pass ⬜ Fail
- Correct Q1 filtering

#### 2.6 Get Single Task
**Prompt:** "Get details for task ID [use ID from 2.4]"
- ⬜ Pass ⬜ Fail
- Full task details returned

#### 2.7 Search Tasks
**Prompt:** "Search for tasks about 'project'"
- ⬜ Pass ⬜ Fail
- Matches: ___________

---

### Phase 3: Analytics Tools

#### 3.1 Productivity Metrics
**Prompt:** "Show productivity metrics"
- ⬜ Pass ⬜ Fail
- Completions, streaks, rates all present

#### 3.2 Quadrant Analysis
**Prompt:** "Analyze quadrant distribution"
- ⬜ Pass ⬜ Fail
- All 4 quadrants analyzed

#### 3.3 Tag Analytics
**Prompt:** "Show tag statistics"
- ⬜ Pass ⬜ Fail
- Tags: ___________ 

#### 3.4 Upcoming Deadlines
**Prompt:** "What are my upcoming deadlines?"
- ⬜ Pass ⬜ Fail
- Grouped: overdue, today, this week

#### 3.5 Task Insights
**Prompt:** "Give me task insights summary"
- ⬜ Pass ⬜ Fail
- AI-friendly summary format

---

### Phase 4: Write Tools (⚠️ Modifies Data)

#### 4.1 Create Task
**Prompt:** "Create task: 'MCP Test v0.5.0', urgent=true, important=false, tags=['#test']"
- ⬜ Pass ⬜ Fail
- Task ID: ___________

#### 4.2 Update Task
**Prompt:** "Update [ID from 4.1] to make it not urgent"
- ⬜ Pass ⬜ Fail
- Quadrant changed

#### 4.3 Complete Task
**Prompt:** "Mark [ID from 4.1] complete"
- ⬜ Pass ⬜ Fail
- Status updated

#### 4.4 Delete Task
**Prompt:** "Delete [ID from 4.1]"
- ⬜ Pass ⬜ Fail
- Task removed

#### 4.5 Bulk Update (Optional)
**Prompt:** "Create 3 test tasks, then complete all at once"
- ⬜ Pass ⬜ Skip ⬜ Fail

---

### Phase 5: Prompts

#### 5.1 Daily Standup
**Prompt:** "Run daily-standup prompt"
- ⬜ Pass ⬜ Fail
- Concise daily report

#### 5.2 Focus Mode
**Prompt:** "Run focus-mode prompt"
- ⬜ Pass ⬜ Fail
- Q1 tasks prioritized

#### 5.3 Weekly Review
**Prompt:** "Run weekly-review prompt"
- ⬜ Pass ⬜ Fail
- Professional report format

---

### Phase 6: Error Handling

#### 6.1 Invalid Task ID
**Prompt:** "Get task 'invalid-id-12345'"
- ⬜ Pass ⬜ Fail
- Graceful error message

---

### Phase 7: Performance

#### 7.1 Sequential Requests
**Prompt:** "List tasks, show metrics, get tag analytics"
- ⬜ Pass ⬜ Fail
- All complete, time: ___________

---

## Results Summary

**Tests Run:** ___ / 30
**Passed:** ___
**Failed:** ___
**Skipped:** ___

### Critical Issues
1. ___________
2. ___________

### Decision
- ⬜ ✅ DEPLOY - All critical tests passed
- ⬜ ⚠️ DEPLOY WITH CAUTION - Minor issues only
- ⬜ ❌ DO NOT DEPLOY - Critical failures

---

## Post-Test Actions

### If PASS → Commit & Publish
```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server

# Publish to npm
npm publish

# Then commit refactoring to git
cd ../..
git add packages/mcp-server
git commit -m "refactor(mcp-server): Split index.ts into modular architecture (v0.5.0)

- Reduced main entry from 1,155 lines to 59 lines (95% reduction)
- Split into 14 focused modules (schemas, handlers, prompts, server)
- Added comprehensive test suite (32 tests, Vitest)
- All files now comply with 300-line guideline
- 100% backward compatible, no breaking changes

Closes #<issue-number>"
```

### If FAIL → Rollback
```bash
# Restore config backup
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Restart Claude Desktop
# Investigate issues before deploying
```

---

## Notes

**What Worked:**
___________

**Issues Found:**
___________

**Performance:**
___________

**Recommendation:**
___________

---

**Tester:** ___________
**Date:** ___________
**Sign-off:** ⬜ Approved ⬜ Rejected
