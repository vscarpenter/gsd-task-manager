# MCP Server Write Operations Test Plan

## Prerequisites
✅ Built: v0.4.1 with schema fixes
✅ Config: Claude Desktop pointing to local build
✅ Auth: Token and encryption passphrase configured

## Setup

1. **Restart Claude Desktop** to load the new v0.4.1 build
   - Quit Claude Desktop completely
   - Reopen Claude Desktop
   - Wait for MCP server to initialize

2. **Verify MCP server is running**
   - Start a new conversation
   - Ask: "Can you list my tasks using the gsd-tasks MCP server?"
   - Should see your existing tasks (read operation test)

## Test 1: create_task ✓

**Test Case:** Create a simple task in Q1 (Urgent & Important)

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, create a new task:
- Title: "Test MCP Write Operations"
- Description: "Testing v0.4.1 schema fixes"
- Urgent: true
- Important: true
- Tags: ["testing", "mcp"]
```

**Expected Result:**
- ✅ Claude calls `create_task` tool
- ✅ Returns success message with task details
- ✅ Task shows quadrantId: "urgent-important"
- ✅ No 400 error from Worker

**Verification:**
- Ask Claude: "List tasks with tag 'testing'"
- Should see the newly created task

## Test 2: update_task ✓

**Test Case:** Update the task we just created

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, update the task "Test MCP Write Operations":
- Add a due date for tomorrow
- Add a new tag "bug-fix"
- Change description to "Testing v0.4.1 schema fixes - UPDATED"
```

**Expected Result:**
- ✅ Claude calls `update_task` tool
- ✅ Returns updated task with new values
- ✅ Tags now include "testing", "mcp", "bug-fix"
- ✅ Due date is set

**Verification:**
- Ask Claude: "Get the task 'Test MCP Write Operations' and show me all details"
- Verify all updates are present

## Test 3: complete_task ✓

**Test Case:** Mark task as completed

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, mark the task "Test MCP Write Operations" as completed.
```

**Expected Result:**
- ✅ Claude calls `complete_task` tool
- ✅ Returns task with completed: true
- ✅ Task still exists with all data intact

**Verification:**
- Ask Claude: "Show me all completed tasks"
- Should see the test task in completed state

## Test 4: Create Multiple Tasks (for Bulk Test)

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, create 3 new tasks:
1. "Bulk Test Task 1" - Urgent and Important
2. "Bulk Test Task 2" - Not Urgent but Important
3. "Bulk Test Task 3" - Urgent but Not Important
```

**Expected Result:**
- ✅ Claude creates 3 tasks successfully
- ✅ Each in correct quadrant

## Test 5: bulk_update_tasks ✓

**Test Case 5a:** Complete multiple tasks at once

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, mark all 3 "Bulk Test Task" tasks as completed in a single bulk operation.
```

**Expected Result:**
- ✅ Claude calls `bulk_update_tasks` with type: 'complete'
- ✅ Returns count of updated tasks (3)
- ✅ All 3 tasks now completed

**Test Case 5b:** Add tags to multiple tasks

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, add the tag "bulk-test" to all 3 "Bulk Test Task" tasks in one operation.
```

**Expected Result:**
- ✅ Claude calls `bulk_update_tasks` with type: 'add_tags'
- ✅ All 3 tasks now have "bulk-test" tag

**Test Case 5c:** Move tasks to different quadrant

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, move all "Bulk Test Task" tasks to Q4 (Not Urgent, Not Important) in one operation.
```

**Expected Result:**
- ✅ Claude calls `bulk_update_tasks` with type: 'move_quadrant'
- ✅ All tasks now in quadrant "not-urgent-not-important"

## Test 6: delete_task ✓

**Test Case:** Delete individual task

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, delete the task "Test MCP Write Operations".
```

**Expected Result:**
- ✅ Claude calls `delete_task` tool
- ✅ Returns success message
- ✅ Task no longer appears in list

**Verification:**
- Ask Claude: "Search for 'Test MCP Write Operations'"
- Should return no results

## Test 7: bulk_update_tasks (Delete Multiple) ✓

**Prompt to Claude:**
```
Using the gsd-tasks MCP server, delete all 3 "Bulk Test Task" tasks in a single bulk operation.
```

**Expected Result:**
- ✅ Claude calls `bulk_update_tasks` with type: 'delete'
- ✅ Returns count of deleted tasks (3)
- ✅ All test tasks removed

## Test 8: Verify Sync to Worker 🔍

**Check Worker Database:**

Option A - Use Worker logs:
```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/worker
timeout 30 npx wrangler tail --env production --format pretty
```
Then perform a create operation and watch for logs.

Option B - Use webapp to verify:
1. Open https://gsd.vinny.dev
2. Check if created tasks appear
3. Verify updates, completions, deletions synced

Option C - Use list_tasks MCP tool:
```
Ask Claude: "List all my tasks and show me the last 5 created"
```
Verify the tasks we created are there with correct data.

## Success Criteria ✅

All tests pass if:
- [ ] No 400 errors from Worker API
- [ ] All operations return success messages
- [ ] Tasks persist across operations
- [ ] Changes visible in webapp (if checked)
- [ ] Vector clock handled by server (no errors)
- [ ] Encryption/decryption works both ways

## Failure Scenarios ❌

If any operation fails, capture:
1. The exact error message from Claude
2. Network error details (if shown)
3. Which operation failed (create/update/delete/bulk)
4. Worker logs (if accessible)

## Notes

- Testing in **production** Worker (gsd-sync-worker-production.vscarpenter.workers.dev)
- Using real auth token and encryption passphrase
- All created test tasks will persist unless deleted
- Can safely run tests multiple times (cleanup with delete operations)

---

**After Testing:** Report results back to decide whether to publish v0.4.1 to npm.
