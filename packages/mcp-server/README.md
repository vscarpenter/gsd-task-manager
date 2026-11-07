# GSD Task Manager MCP Server

[![npm version](https://badge.fury.io/js/gsd-mcp-server.svg)](https://www.npmjs.com/package/gsd-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for GSD Task Manager. Provides **full task management** capabilities including create, read, update, and delete operations through Claude Desktop and other MCP-compatible AI assistants. Communicates with a self-hosted PocketBase backend.

## Quick Start

Install a reviewed, exact release and run its interactive setup wizard:

```bash
npm install --global gsd-mcp-server@1.4.1
gsd-mcp-server --setup
```

1.4.1 is the current release when this README was written; the npm badge above
shows the latest. Install that exact version rather than a range or `npx`.

The wizard validates a normal user account and writes an owner-only configuration
artifact for Claude Desktop. That generated configuration launches the exact local
Node executable and package entrypoint used by the wizard; it never asks `npx` to
select code while passing your bearer token. Open the artifact only in a trusted
editor and merge it into Claude Desktop. To update, explicitly install another exact
reviewed version and rerun the wizard.

See [Installation](#installation) section below for detailed setup instructions.

## Features

**Reliability & Performance**
- ✅ **Rate-limit handling** - Writes are paced and retried once after a 429, honoring Retry-After. Reads are not retried, so ask again after a network error.
- ✅ **Token Monitoring** - Proactive warnings for expiring tokens (healthy/warning/critical/expired/invalid)
- ✅ **Caching** - In-memory TTL cache (30s) with automatic invalidation on writes
- ✅ **Dry-Run Mode** - Preview all write operations before committing
- ✅ **Dependency Validation** - Circular dependency detection using BFS algorithm
- ✅ **Cache Stats Tool** - Monitor cache hit rates and performance

**Write Operations** (v0.4.0)
- ✅ **Create Tasks** - Create tasks from a plain-English request; Claude fills in the fields (supports dryRun)
- ✅ **Update Tasks** - Modify any task property (supports dryRun)
- ✅ **Complete Tasks** - Mark tasks as done or incomplete (supports dryRun)
- ✅ **Delete Tasks** - Permanently remove tasks (supports dryRun)
- ✅ **Bulk Operations** - Update up to 50 tasks at once, or delete up to 10 (supports dryRun)
- 🔒 **Safety Features** - Bulk limits (50 tasks, 10 deletes), validation, dry-run preview

**Quick Start Helpers** (v0.3.2)
- ✅ **6 Built-in Prompts** - One-click workflows (daily standup, weekly review, focus mode, etc.)
- ✅ **Comprehensive Help Tool** - In-Claude documentation with topic filtering
- ✅ Zero learning curve - Discover features as you use them

**Interactive Setup & Validation** (v0.3.0)
- ✅ Interactive setup wizard (`--setup`)
- ✅ Configuration validator (`--validate`)
- ✅ Automatic connectivity and auth testing
- ✅ Enhanced error messages with actionable guidance
- ✅ Multi-device support (fixes hardcoded device ID)

**Analytics & Insights** (v0.3.0)
- ✅ Comprehensive productivity metrics
- ✅ Quadrant distribution analysis
- ✅ Tag-based analytics with completion rates
- ✅ Upcoming deadline tracking (overdue, today, this week)
- ✅ AI-friendly task insights summaries
- ✅ Streak tracking (current and longest)

**Metadata Access** (v0.1.0)
- ✅ Sync backend health check (`get_sync_status`) and token expiry (`get_token_status`)
- ✅ Task statistics (metadata only)

**Task Access** (v0.2.0+)
- ✅ List all tasks with full content (cached)
- ✅ Search tasks by title, description, tags, subtasks
- ✅ Filter by quadrant, completion status, tags
- ✅ Get individual task details
- ✅ Full CRUD operations: Create, read, update, delete tasks (v0.4.0+)

## Prerequisites

1. **GSD Task Manager** with sync enabled
2. **OAuth Authentication** completed (Google, Apple, or GitHub)
3. **Node.js** 20 or later (18 still runs, but it is past end of life)
4. **Claude Desktop** or another MCP-compatible client

## CLI Usage

The MCP server includes interactive tools for easy setup and troubleshooting:

```bash
# Interactive setup wizard (recommended for first-time users)
gsd-mcp-server --setup

# Validate existing configuration
gsd-mcp-server --validate

# Show help and usage information
gsd-mcp-server --help

# Run as MCP server (normal mode - used by Claude Desktop)
gsd-mcp-server
```

**Setup Wizard Features:**
- ✅ Tests PocketBase connectivity before configuration
- ✅ Validates authentication token
- ✅ Generates ready-to-use Claude Desktop config
- ✅ Provides platform-specific config file paths

**Validation Tool Features** (`--validate`; the `validate_config` tool runs the
connectivity, authentication, and task-access checks only):
- ✅ Checks environment variables
- ✅ Tests PocketBase connectivity and authentication
- ✅ Provides actionable error messages

## Installation

**Two installation options:**

### Option A: Install an Exact Published Release (Recommended)

Install an explicitly reviewed version, such as `npm install --global
gsd-mcp-server@1.4.1`. Updating is a deliberate reinstall followed by `--setup`.
Don't run the server through `npx`: the setup wizard writes the path of the copy
that ran it, and npm can prune the npx cache, which silently breaks Claude Desktop.

### Option B: Build from Source

For development or if you want to modify the code:

1. Clone the repository
2. Navigate to `packages/mcp-server`
3. Install dependencies: `npm install`
4. Build the server: `npm run build`

## Setup

### 1. Get Your Auth Token

You'll need an auth token from your PocketBase sync setup:

1. Open GSD Task Manager in your browser
2. Sign in with Google, Apple, or GitHub to enable cloud sync
3. Open **Settings → Cloud Sync → MCP access → Copy auth token**

Paste the copied token as the `GSD_AUTH_TOKEN` value. The button copies only the
raw token. Keep it private: it grants access to your synced tasks.

The copied token is the web session's current one, so it can have anywhere from
30 days down to a few days left. Run `get_token_status` after pasting to see the
real date. When the web app renews its own session, a token already copied into
MCP keeps working until its own expiry.

### 2. Configure Claude Desktop

Add the MCP server to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Using the exact published package (recommended):** run `gsd-mcp-server --setup`,
then merge the generated owner-only artifact. The credential-bearing configuration
is intentionally not reproduced in terminal-oriented instructions.

**Using local build (for development):**

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

**Configuration Notes**:
- Replace `your-auth-token-here` with your actual token from Step 1
- `GSD_POCKETBASE_URL`: Your PocketBase URL (`https://api.vinny.io` for the hosted service, or your own server). Must be HTTPS, or http://localhost / 127.0.0.1 / [::1] for local development, with no credentials, query, or fragment.
- Administrator (superuser) tokens are refused; use the token of a normal signed-in account.

### 3. Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Usage

### Built-in Prompts (v0.3.2)

The MCP server includes 6 pre-configured conversation starters that appear in Claude Desktop:

1. **daily-standup** - Daily task review with overdue items and productivity summary
2. **weekly-review** - Weekly productivity analysis with completion stats and trends
3. **focus-mode** - Get urgent and important tasks (Q1: Do First) to work on now
4. **upcoming-deadlines** - Show all overdue, due today, and due this week tasks
5. **productivity-report** - Comprehensive report with metrics, streaks, and insights
6. **tag-analysis** - Analyze task distribution and completion rates by tags/projects

**How to use:** Click the "Use Prompt" button in Claude Desktop, or just ask directly!

### Natural Language Queries

Once configured, you can ask Claude questions like:

**Sync Status** (v0.1.0)
- "What's my GSD sync status?"
- "When does my MCP token expire?"
- "Is the sync backend reachable?"

**Task Overview** (v0.1.0)
- "How many tasks do I have in GSD?"
- "Give me task statistics"
- "Is my sync backend healthy?"

**Task Access** (v0.2.0+)
- "List all my tasks"
- "Show me tasks in the Do First quadrant"
- "What tasks are due this week?"
- "Search for tasks about [keyword]"
- "Show me all tasks tagged work"
- "What are my urgent tasks?"
- "Find tasks mentioning [name or topic]"

**Analytics & Insights** (v0.3.0)
- "What's my productivity this week?"
- "Show me my completion streak"
- "Analyze my task distribution across quadrants"
- "What tags do I use most?"
- "Which quadrant has the best completion rate?"
- "Show me overdue tasks"
- "Give me a productivity summary"

**Configuration & Troubleshooting** (v0.3.0)
- "Validate my MCP configuration"
- "Check if my setup is working correctly"
- "Diagnose connection issues"

**Help & Discovery** (v0.3.2)
- "Help me use the GSD MCP server"
- "Show me usage examples"
- "What tools are available?"
- "How do I troubleshoot issues?"

**Write Operations** (v0.4.0)
- "Create a task: Finish quarterly report, urgent and important, due Friday"
- "Mark task abc123 as complete"
- "Move all work tasks to the Schedule quadrant"
- "Update task xyz789 to add tags project-alpha and high-priority"
- "Delete completed tasks from last month"
- "Complete all tasks tagged quick-wins"
- "Change due date of task def456 to next Monday"

Claude will use the MCP tools to fetch real-time data from your PocketBase backend and can now modify your tasks!

Tags are stored lowercase without a leading `#`, the way the apps store them. The
server stores tags exactly as given, so ask for `work`, not `#work`, or the tag
won't match the one the apps use.

### Saved items (1.4.0)

Items saved in the apps (Move to Saved) stay out of `list_tasks`, `get_task`,
`search_tasks`, and the analytics tools, so `get_task` answers "Task not found"
for a saved ID. `get_task_stats` and `get_sync_status` still count them. Updates
keep an item saved. Completing a saved item is refused, so return it to the
matrix in the app first. The MCP server can't save an item or return one.

## Available Tools

### `get_sync_status`
Get sync health information.

**Returns**:
```json
{
  "healthy": true,
  "taskCount": 42,
  "lastSyncAt": null,
  "authenticated": true,
  "pocketBaseUrl": "https://[pocketbase-host]"
}
```

`lastSyncAt` is always null because PocketBase is live. `taskCount` includes Saved items.
The host is redacted so the output is safe to paste into a chat.

### `get_task_stats`
Get task statistics (metadata only).

**Returns**:
```json
{
  "totalTasks": 42,
  "activeTasks": 38,
  "completedTasks": 4,
  "lastUpdated": "2026-10-30T14:00:00.000Z",
  "oldestTask": "2026-01-05T09:00:00.000Z",
  "newestTask": "2026-10-30T14:00:00.000Z"
}
```

Counts include Saved items. Every field is null if the stats can't be read.

---

### `list_tasks` (v0.2.0)
List tasks with optional filtering. Saved items are excluded. **Requires authentication**.

**Parameters**:
- `quadrant` (optional): Filter by quadrant ID
  - `urgent-important` (Q1 - Do First)
  - `not-urgent-important` (Q2 - Schedule)
  - `urgent-not-important` (Q3 - Delegate)
  - `not-urgent-not-important` (Q4 - Eliminate)
- `completed` (optional): Filter by completion status (true/false)
- `tags` (optional): Array of tags to filter by (matches any; exact match, so use `work`, not `#work`)

**Returns**:
```json
[
  {
    "id": "task-abc123",
    "title": "Finish quarterly report",
    "description": "Complete Q4 financial analysis",
    "urgent": true,
    "important": true,
    "quadrant": "urgent-important",
    "completed": false,
    "dueDate": "2025-01-03T17:00:00.000Z",
    "tags": ["work", "finance"],
    "subtasks": [
      { "id": "sub-1", "title": "Gather data", "completed": true },
      { "id": "sub-2", "title": "Write analysis", "completed": false }
    ],
    "recurrence": "none",
    "dependencies": [],
    "createdAt": "2024-12-26T00:00:00.000Z",
    "updatedAt": "2024-12-27T00:00:00.000Z",
  }
]
```

### `get_task` (v0.2.0)
Get a single task by ID. **Requires authentication**.

**Parameters**:
- `taskId` (required): The unique ID of the task

**Returns**: Single task object (same structure as `list_tasks`). A Saved item answers "Task not found".

### `search_tasks` (v0.2.0)
Search tasks by text query across titles, descriptions, tags, and subtasks. **Requires authentication**.

**Parameters**:
- `query` (required): Search text to match

**Returns**: Array of matching tasks (same structure as `list_tasks`). Saved items are excluded.

---

### `get_productivity_metrics` (v0.3.0)
Get comprehensive productivity metrics. Saved items are excluded. **Requires authentication**.

**Returns**:
```json
{
  "completedToday": 5,
  "completedThisWeek": 23,
  "completedThisMonth": 87,
  "activeStreak": 7,
  "longestStreak": 14,
  "completionRate": 68,
  "quadrantDistribution": {
    "urgent-important": 12,
    "not-urgent-important": 18,
    "urgent-not-important": 5,
    "not-urgent-not-important": 3
  },
  "tagStats": [...],
  "overdueCount": 2,
  "dueTodayCount": 3,
  "dueThisWeekCount": 7,
  "noDueDateCount": 15,
  "activeTasks": 38,
  "completedTasks": 42,
  "totalTasks": 80
}
```

### `get_quadrant_analysis` (v0.3.0)
Analyze task distribution and performance across quadrants. **Requires authentication**.

**Returns**:
```json
[
  {
    "quadrantId": "urgent-important",
    "name": "Q1: Do First",
    "completionRate": 85,
    "totalTasks": 20,
    "completedTasks": 17,
    "activeTasks": 3
  },
  ...
]
```

### `get_tag_analytics` (v0.3.0)
Get statistics for all tags with usage and completion rates. **Requires authentication**.

**Parameters**:
- `limit` (optional): Maximum number of tags to return (a positive whole number)

**Returns**:
```json
[
  {
    "tag": "work",
    "count": 35,
    "completedCount": 28,
    "completionRate": 80
  },
  ...
]
```

### `get_upcoming_deadlines` (v0.3.0)
Get tasks grouped by deadline urgency. **Requires authentication**.

**Returns**:
```json
{
  "overdue": [...],
  "dueToday": [...],
  "dueThisWeek": [...]
}
```

### `get_task_insights` (v0.3.0)
Generate AI-friendly summary of task insights. **Requires authentication**.

**Returns**: Plain text summary with key metrics, streaks, deadlines, and recommendations.

### `validate_config` (v0.3.0)
Diagnose the server's connection: PocketBase connectivity, authentication, and
task access. It doesn't check environment variables; the `--validate` CLI does.

**Returns**:
```json
{
  "checks": [
    {
      "name": "PocketBase Connectivity",
      "status": "success",
      "details": "Connected to https://[pocketbase-host]"
    },
    {
      "name": "Authentication",
      "status": "success",
      "details": "Authenticated (42 tasks accessible)"
    },
    {
      "name": "Task Access",
      "status": "success",
      "details": "Successfully fetched 40 tasks"
    }
  ]
}
```

The host is redacted so the output is safe to paste into a chat. A token the
server rejects reports `"status": "error"` with `"Token validation failed"`.
Task Access counts exclude Saved items.

### `get_help` (v0.3.2)
Get comprehensive help documentation including available tools, usage examples, and troubleshooting tips.

**Parameters**:
- `topic` (optional): Filter help by topic
  - `tools` - List all available tools
  - `analytics` - Analytics capabilities
  - `setup` - Setup and configuration guide
  - `examples` - Usage examples
  - `troubleshooting` - Common issues and solutions

**Returns**: Markdown-formatted help text

**Example Usage:**
- "Help me use the GSD MCP server"
- "Show me analytics examples"
- "How do I troubleshoot authentication issues?"

### `get_token_status` (v0.6.0)
Check authentication token status including expiration date, days remaining, and warnings.

**Returns**:
```json
{
  "status": "warning",
  "expired": false,
  "expiresAt": "2026-11-08T12:00:00.000Z",
  "daysRemaining": 5,
  "message": "Auth token expires in 5 days. Consider re-authenticating this week.",
  "instructions": [
    "1. Open the GSD web app you sync with (gsd.vinny.dev for the hosted service) and sign in",
    "2. Open Settings → Cloud Sync → Copy auth token",
    "3. Update GSD_AUTH_TOKEN in your Claude Desktop config",
    "4. Restart Claude Desktop"
  ]
}
```

**Status Levels** (thresholds from `src/auth/token-status.ts`):
- `healthy` - More than 14 days until expiration
- `warning` - 4-14 days until expiration
- `critical` - 3 days or fewer until expiration
- `expired` - Token has expired
- `invalid` - No token is configured, or it isn't a PocketBase JWT

Tokens from the hosted server and the Docker image last 30 days. The MCP server
never renews its token, so copy a fresh one from the web app before it expires.

**Example Usage:**
- "Check my token status"
- "Is my authentication about to expire?"
- "Do I need to re-authenticate?"

### `get_cache_stats` (v0.6.0)
Get task cache statistics including hit rate, cache size, and TTL configuration.

**Parameters**:
- `reset` (optional): If true, reset statistics after retrieving them

**Returns**:
```json
{
  "performance": { "hitRate": "84.0%", "hits": 42, "misses": 8 },
  "taskListCache": { "currentSize": 1, "maxEntries": 1000, "ttlSeconds": 30 },
  "singleTaskCache": { "currentSize": 0, "maxEntries": 1000, "ttlSeconds": 30 },
  "notes": [
    "Cache is invalidated after every write operation",
    "TTL-based expiration ensures data freshness"
  ]
}
```

With `reset: true`, the response also includes `"statsReset": true`.

**Example Usage:**
- "Show me cache performance"
- "What's my cache hit rate?"
- "Reset cache statistics"

---

## Write Operation Tools (v0.4.0, enhanced v0.6.0)

### `create_task`
Create a new task from structured fields; the quadrant is derived from `urgent` and `important`. **Requires authentication**.

**Parameters**:
- `title` (required): Task title
- `urgent` (required): Is this task urgent? (time-sensitive)
- `important` (required): Is this task important? (high-value, strategic)
- `description` (optional): Task description
- `dueDate` (optional): Due date as ISO 8601 datetime string (e.g., `"2025-10-27T17:00:00.000Z"`)
- `tags` (optional): Array of tags, lowercase, without a leading `#` (e.g., `["work", "project-alpha"]`)
- `subtasks` (optional): Array of subtask objects `{title, completed}`
- `recurrence` (optional): `'none'` | `'daily'` | `'weekly'` | `'monthly'`
- `dependencies` (optional): Array of task IDs that must be completed first
- `notifyBefore` (optional): Minutes before the due date to remind you (default 15). `0` reminds at the due time. To turn reminders off, set `notificationEnabled: false`
- `notificationEnabled` (optional): Whether reminders are on for this task (default: true)
- `estimatedMinutes` (optional): Estimated time in whole minutes, 1-10080
- `dryRun` (optional): If true, validate and preview without saving (v0.6.0)

http(s) URLs in a new task's title are moved into its description.

**Limits**: title 80 characters, description 600, at most 20 tags of 30 characters
each, at most 50 subtasks of 100 characters each, at most 50 dependencies.
`dueDate` must be ISO 8601 with a time zone (`Z` or an offset).

**Returns**: The newly created task object with generated ID (or preview if dryRun)

**Example:**
```
Create a task:
- Title: "Finish quarterly report"
- Urgent: true
- Important: true
- Due date: Friday at 5pm
- Tags: work, finance
```

### `update_task`
Update an existing task. All fields except ID are optional. **Requires authentication**.

**Parameters**:
- `id` (required): Task ID to update
- `title` (optional): New task title
- `description` (optional): New description
- `urgent` (optional): Change urgency (moves between quadrants)
- `important` (optional): Change importance (moves between quadrants)
- `dueDate` (optional): New due date as ISO 8601 datetime string (empty string to clear)
- `tags` (optional): Replace all tags
- `subtasks` (optional): Replace all subtasks (objects with `{id, title, completed}`)
- `recurrence` (optional): Change recurrence pattern
- `dependencies` (optional): Replace all dependencies (validated for circular refs)
- `completed` (optional): Mark as complete/incomplete. Doesn't create the next recurring instance; use `complete_task` for that. Refused for a Saved item.
- `notifyBefore`, `notificationEnabled`, `estimatedMinutes` (optional): Same as `create_task`
- `dryRun` (optional): If true, validate and preview changes without saving (v0.6.0)

The same limits as `create_task` apply. If the task changed in another app since it
was read, the update fails with a conflict; re-read the task and retry.

**Returns**: The updated task object with list of changes (or preview if dryRun)

**Example:**
```
Update task abc123:
- Move to "Schedule" quadrant (urgent=false, important=true)
- Add tags: project-alpha, q1-goals
```

### `complete_task`
Mark a task as complete or incomplete. Quick shortcut for updating completion status. **Requires authentication**.

**Parameters**:
- `id` (required): Task ID
- `completed` (required): `true` to mark complete, `false` to mark incomplete
- `dryRun` (optional): If true, preview the change without saving (v0.6.0)

**Returns**: The updated task object (or preview if dryRun)

Completing a recurring task also creates its next instance, as the apps do, and the
response includes it. Daily moves the due date 1 day, weekly 7 days, and monthly 1
month, and the new instance starts with its subtasks unchecked. A dry run previews
both. Completing a Saved item is refused.

**Example:**
```
Mark task xyz789 as complete
```

### `delete_task`
Permanently delete a task. **This action cannot be undone.** **Requires authentication**.

**Parameters**:
- `id` (required): Task ID to delete
- `dryRun` (optional, **default `true`**): Shows what would be deleted. Pass `dryRun: false` to delete.

**Returns**: Confirmation with task title and any affected dependent tasks. Dependency
references on other tasks are cleaned up.

**Example:**
```
Delete task def456
```

**⚠️ Warning**: A delete is permanent and skips the 30-day Trash on every client
(web, iOS, Android), so it can't be restored. Calls preview by default; pass
`dryRun: false` to apply.

**Dry-Run Response** (plain text):
```
🔍 DRY RUN - Task would be deleted (not deleted):

Task: "Example Task" (def456)

⚠️ The following tasks depend on this task and would be affected:
  - Task that depends on this one

To delete this task, pass dryRun=false explicitly.
```

### `bulk_update_tasks`
Update multiple tasks at once. Limited to 50 tasks per operation, and 10 per delete, for safety. **Requires authentication**.

**Parameters**:
- `taskIds` (required): Array of task IDs to update (max 50, or 10 for `delete`)
- `operation` (required): Operation object with `type` field
  - `type: 'complete'` - Mark all as complete/incomplete (doesn't create next recurring instances; refused if any task is Saved)
    - `completed`: boolean
  - `type: 'move_quadrant'` - Move all to a quadrant
    - `urgent`: boolean
    - `important`: boolean
  - `type: 'add_tags'` - Add tags to all tasks
    - `tags`: string[] (lowercase, without a leading `#`)
  - `type: 'remove_tags'` - Remove tags from all tasks
    - `tags`: string[]
  - `type: 'set_due_date'` - Set due date for all tasks
    - `dueDate`: ISO 8601 datetime string (empty string to clear)
  - `type: 'delete'` - Delete all tasks (permanent; skips the 30-day Trash on every client)
- `dryRun` (optional): Preview without saving. **Deletes default to `dryRun: true`**; pass `dryRun: false` to apply them.

**Returns**: `updated`, `deleted`, `errors`, and `conflicts` (task IDs skipped because they changed mid-batch), or a preview when `dryRun` is set.

**Examples:**
```
Complete all tasks tagged quick-wins

Move all work tasks to the Schedule quadrant

Add the priority tag to all overdue tasks

Delete all completed tasks from last year
```

**🔒 Safety Features**:
- Maximum 50 tasks per operation, and 10 per delete
- Clear error messages for each failed task
- Not transactional: each task is written separately. A task that changed since the batch was read is skipped and listed under `conflicts`. Failures are listed under `errors`, and the rest of the batch still applies.

## Privacy & Security

**What This Server Can Access** (when authenticated):
- ✅ Sync metadata (timestamps, counts, status)
- ✅ Task titles, descriptions, quadrants, tags, due dates
- ✅ Subtasks, checklists, and task dependencies
- ✅ **Can create, update, and delete tasks**

**Where the data goes**: everything a tool returns, including titles, descriptions,
tags, subtasks, and due dates, goes to your AI assistant's provider as part of the
conversation. The server itself talks only to your PocketBase URL.

**Security Model**:
- 🔒 **PocketBase backend**: Tasks stored on the hosted service or your own PocketBase instance
- 🔒 **OAuth authentication**: PocketBase OAuth2 with Google, Apple, and GitHub providers
- 🔒 **API rules**: PocketBase enforces owner-based access (`owner = @request.auth.id`)
- 🛡️ **Safety limits**: Bulk operations limited to 50 tasks (10 deletes), clear validation
- 🔍 **Dry-run mode**: Preview write operations before committing

## Troubleshooting

### "Configuration error: Required environment variables"
- Check that `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` are set in your Claude Desktop config
- Ensure there are no typos in the environment variable names

### "Not authenticated as a normal users-collection account"
- Your auth token expired or was revoked. Sign in to the GSD web app again
- Open **Settings → Cloud Sync → MCP access → Copy auth token**, then replace `GSD_AUTH_TOKEN` in your config
- Restart Claude Desktop
- On a self-hosted (Docker) server, **Sign out of all devices** in the web app also ends the MCP token, so copy a new one after using it

### "Cannot reach PocketBase at …"
- "Your saved credentials were not changed" means it's a network or VPN problem; the token is fine
- Try again once you're back online, or run `gsd-mcp-server --validate`

### "PocketBase URL must use HTTPS"
- Use an `https://` URL. Plain `http://` works only for localhost, 127.0.0.1, or [::1]

### "PocketBase superuser tokens are not accepted"
- You pasted an administrator token. Copy the token of a normal signed-in account from the web app instead

### "Return this saved item to the matrix before completing it"
- The task is in Saved. Choose Return to matrix in the app, then complete it

### "Task … changed between read and write"
- The task changed in another app between the read and the write. Re-read the task and retry

### "API request failed: 404 Not Found"
- Check that `GSD_POCKETBASE_URL` is correct
- Ensure your PocketBase instance is running and accessible
- Try accessing the URL in your browser: `{GSD_POCKETBASE_URL}/api/health`

### "Cannot find module" error
- **If using an exact installed release**: Reinstall that version and rerun `--setup`
- **If using local build**:
  - Run `npm run build` to compile TypeScript
  - Check that the path in Claude config is absolute and correct
  - Verify that `dist/index.js` exists after building

## Development

**Watch Mode** (auto-rebuild on changes):
```bash
npm run dev
```

**Manual Build**:
```bash
npm run build
```

**Testing Locally** (without Claude Desktop):
```bash
export GSD_POCKETBASE_URL="https://api.vinny.io"
export GSD_AUTH_TOKEN="your-auth-token"
npm start
```

Then send MCP protocol JSON over stdin (advanced).

**Publishing to npm**:
```bash
# Update version (patch/minor/major)
bun run version:patch   # or version:minor / version:major

# Build and publish
npm run build
npm publish
```

## Architecture

```
packages/mcp-server/
├── src/
│   ├── index.ts           # CLI entry: parses options, starts the server
│   ├── server/            # Server setup, tool registration, config, startup
│   ├── auth/              # JWT token status
│   ├── pocketbase-client.ts # PocketBase SDK client and principal checks
│   ├── tools.ts           # Backward-compatible re-exports
│   ├── cache.ts           # TTL-based in-memory cache
│   ├── dependencies.ts    # Circular dependency validation
│   ├── constants.ts       # Payload limits shared with the web app
│   ├── errors.ts          # Typed errors (ConflictError)
│   ├── version.ts         # Package version read at runtime
│   ├── text/              # Capture-parser mirror (URL extraction)
│   ├── utils/             # Logger
│   ├── api/               # Host redaction; legacy HTTP client and retry (unused by tools)
│   ├── tools/
│   │   ├── handlers/      # Tool request handlers
│   │   │   ├── index.ts   # Handler dispatcher
│   │   │   ├── read-handlers.ts
│   │   │   ├── write-handlers.ts
│   │   │   ├── analytics-handlers.ts
│   │   │   └── system-handlers.ts
│   │   └── schemas/       # MCP tool schemas (19 tools)
│   │       ├── index.ts
│   │       ├── read-tools.ts     # 6 read tools
│   │       ├── write-tools.ts    # 5 write tools
│   │       ├── analytics-tools.ts # 5 analytics tools
│   │       └── system-tools.ts   # 3 system tools
│   ├── write-ops/         # Write operations (v0.6.0)
│   │   ├── types.ts       # Input/output types
│   │   ├── helpers.ts     # ID generation, PocketBase writes
│   │   ├── task-operations.ts  # CRUD with dry-run
│   │   └── bulk-operations.ts  # Bulk updates
│   ├── analytics/         # Analytics calculations
│   └── cli/               # Setup wizard, validation
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── README.md              # This file
├── QUICKSTART.md          # Quick setup guide (in the repo, not the npm package)
└── TESTING.md             # Testing procedures (in the repo, not the npm package)
```

**Tech Stack**:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Runtime schema validation
- `typescript` - Type safety
- `pocketbase` - PocketBase JS SDK
- `vitest` - Testing framework

**Communication Flow**:
```
Claude Desktop
    ↓ MCP Protocol (stdio)
GSD MCP Server
    ↓ PocketBase JS SDK (HTTPS)
PocketBase (hosted or self-hosted)
    ↓ SQLite
Tasks (owner-scoped; encrypted at rest on the Docker image; on the hosted
       server, at-rest protection depends on the server's configuration)
```

## Contributing

This is an experimental feature. Feedback and contributions welcome!

1. Test the PoC and report issues
2. Suggest additional tools/features
3. Submit PRs for enhancements

## License

MIT - Same as GSD Task Manager

---

**Current release:** 1.4.1. See [CHANGELOG.md](CHANGELOG.md) for every release.
