# GSD Task Manager MCP Server

[![npm version](https://badge.fury.io/js/gsd-mcp-server.svg)](https://www.npmjs.com/package/gsd-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for GSD Task Manager. Provides read-only access to your synced tasks through Claude Desktop and other MCP-compatible AI assistants.

## Quick Start

**First time? Run the interactive setup wizard:**

```bash
npx gsd-mcp-server --setup
```

The wizard will guide you through configuration and test your connection. Once complete, add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "npx",
      "args": ["-y", "gsd-mcp-server"],
      "env": {
        "GSD_API_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-passphrase-here"
      }
    }
  }
}
```

See [Installation](#installation) section below for detailed setup instructions.

## Features

**Write Operations** (v0.4.0) 🆕 🔥
- ✅ **Create Tasks** - Add new tasks with natural language
- ✅ **Update Tasks** - Modify any task property (title, description, quadrant, tags, etc.)
- ✅ **Complete Tasks** - Mark tasks as done or incomplete
- ✅ **Delete Tasks** - Permanently remove tasks
- ✅ **Bulk Operations** - Update up to 50 tasks at once (complete, move quadrants, add/remove tags, etc.)
- 🔒 **Safety Features** - Bulk limits (50 tasks max), validation, clear error messages
- 🔐 **Encrypted Sync** - All changes encrypted before sending to server

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

**Analytics & Insights** (v0.3.0) 🆕
- ✅ Comprehensive productivity metrics
- ✅ Quadrant distribution analysis
- ✅ Tag-based analytics with completion rates
- ✅ Upcoming deadline tracking (overdue, today, this week)
- ✅ AI-friendly task insights summaries
- ✅ Streak tracking (current and longest)

**Metadata Access** (v0.1.0)
- ✅ Sync status monitoring
- ✅ Device management overview
- ✅ Task statistics (metadata only)

**Decrypted Task Access** (v0.2.0)
- ✅ List all tasks with full content (opt-in)
- ✅ Search tasks by title, description, tags, subtasks
- ✅ Filter by quadrant, completion status, tags
- ✅ Get individual task details
- 🔒 Privacy-first: Requires user-provided encryption passphrase
- 🔒 Read-only: Cannot modify or create tasks

**Planned** (Future v0.4.0+)
- Write operations (create, update, delete tasks)
- AI-powered task suggestions
- Bulk operations support

## Prerequisites

1. **GSD Task Manager** with sync enabled
2. **OAuth Authentication** completed (Google or Apple)
3. **Node.js** 18+ installed
4. **Claude Desktop** or another MCP-compatible client

## CLI Usage

The MCP server includes interactive tools for easy setup and troubleshooting:

```bash
# Interactive setup wizard (recommended for first-time users)
npx gsd-mcp-server --setup

# Validate existing configuration
npx gsd-mcp-server --validate

# Show help and usage information
npx gsd-mcp-server --help

# Run as MCP server (normal mode - used by Claude Desktop)
npx gsd-mcp-server
```

**Setup Wizard Features:**
- ✅ Tests API connectivity before configuration
- ✅ Validates authentication token
- ✅ Tests encryption passphrase (if provided)
- ✅ Generates ready-to-use Claude Desktop config
- ✅ Provides platform-specific config file paths

**Validation Tool Features:**
- ✅ Checks environment variables
- ✅ Tests API connectivity and authentication
- ✅ Verifies encryption setup
- ✅ Validates device registration
- ✅ Provides actionable error messages

## Installation

**Two installation options:**

### Option A: Use Published Package (Recommended)

No installation needed! Use `npx` to run the package directly from npm.

### Option B: Build from Source

For development or if you want to modify the code:

1. Clone the repository
2. Navigate to `packages/mcp-server`
3. Install dependencies: `npm install`
4. Build the server: `npm run build`

## Setup

### 1. Get Your Auth Token

You'll need a JWT token from your GSD sync setup. Two options:

**Option A: From Browser DevTools**
1. Open GSD Task Manager in your browser
2. Complete OAuth sign-in
3. Open DevTools → Application → Local Storage
4. Find `gsd_auth_token` and copy the value

**Option B: From OAuth Callback** (Advanced)
1. Trigger OAuth flow
2. Intercept the callback response
3. Extract the `token` field from the JSON response

### 2. Configure Claude Desktop

Add the MCP server to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Using published package (recommended):**

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "npx",
      "args": ["-y", "gsd-mcp-server"],
      "env": {
        "GSD_API_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-passphrase-here"
      }
    }
  }
}
```

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
        "GSD_API_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-passphrase-here"
      }
    }
  }
}
```

**Configuration Notes**:
- Replace `your-jwt-token-here` with your actual token from Step 1
- Replace `your-passphrase-here` with your sync encryption passphrase
- `GSD_API_URL`: Use `https://gsd.vinny.dev` for production (or your custom Worker URL)
- Token expires every 7 days - you'll need to update it periodically
- **Optional**: Add `GSD_ENCRYPTION_PASSPHRASE` to enable decrypted task access (v0.2.0)
  - Without it: Only metadata tools work (sync status, devices, stats)
  - With it: Full task content access (list, search, read tasks)

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
- "When was my last sync?"
- "Do I have any sync conflicts?"

**Device Management** (v0.1.0)
- "What devices are connected to my GSD account?"
- "Show me all my registered devices"
- "When was each device last active?"

**Task Overview** (v0.1.0)
- "How many tasks do I have in GSD?"
- "Give me task statistics"
- "What's my storage usage?"

**Decrypted Task Access** (v0.2.0 - requires passphrase)
- "List all my tasks"
- "Show me tasks in the Do First quadrant"
- "What tasks are due this week?"
- "Search for tasks about [keyword]"
- "Show me all tasks tagged #work"
- "What are my urgent tasks?"
- "Find tasks mentioning [name or topic]"

**Analytics & Insights** (v0.3.0 - requires passphrase)
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

**Write Operations** (v0.4.0) 🆕
- "Create a task: Finish quarterly report, urgent and important, due Friday"
- "Mark task #abc123 as complete"
- "Move all #work tasks to the Schedule quadrant"
- "Update task #xyz789 to add tags #project-alpha and #high-priority"
- "Delete completed tasks from last month"
- "Complete all tasks tagged #quick-wins"
- "Change due date of task #def456 to next Monday"

Claude will use the MCP tools to fetch real-time data from your Worker API and can now modify your tasks!

## Available Tools

### `get_sync_status`
Get sync health information.

**Returns**:
```json
{
  "lastSyncAt": 1735171200000,
  "pendingPushCount": 0,
  "pendingPullCount": 0,
  "conflictCount": 0,
  "deviceCount": 3,
  "storageUsed": 45678,
  "storageQuota": 10485760
}
```

### `list_devices`
List all registered devices.

**Returns**:
```json
[
  {
    "id": "device-abc123",
    "name": "MacBook Pro",
    "lastSeenAt": 1735171200000,
    "isActive": true,
    "isCurrent": true
  },
  {
    "id": "device-def456",
    "name": "iPhone 15",
    "lastSeenAt": 1735084800000,
    "isActive": true,
    "isCurrent": false
  }
]
```

### `get_task_stats`
Get task statistics (metadata only).

**Returns**:
```json
{
  "totalTasks": 42,
  "activeTasks": 38,
  "deletedTasks": 4,
  "lastUpdated": 1735171200000,
  "oldestTask": 1730000000000,
  "newestTask": 1735171200000
}
```

---

### `list_tasks` (v0.2.0)
List all decrypted tasks with optional filtering. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `quadrant` (optional): Filter by quadrant ID
  - `urgent-important` (Q1 - Do First)
  - `not-urgent-important` (Q2 - Schedule)
  - `urgent-not-important` (Q3 - Delegate)
  - `not-urgent-not-important` (Q4 - Eliminate)
- `completed` (optional): Filter by completion status (true/false)
- `tags` (optional): Array of tags to filter by (matches any)

**Returns**:
```json
[
  {
    "id": "task-abc123",
    "title": "Finish quarterly report",
    "description": "Complete Q4 financial analysis",
    "urgent": true,
    "important": true,
    "quadrantId": "urgent-important",
    "completed": false,
    "dueDate": 1735948800000,
    "tags": ["#work", "#finance"],
    "subtasks": [
      { "id": "sub-1", "text": "Gather data", "completed": true },
      { "id": "sub-2", "text": "Write analysis", "completed": false }
    ],
    "recurrence": "none",
    "dependencies": [],
    "createdAt": 1735171200000,
    "updatedAt": 1735257600000
  }
]
```

### `get_task` (v0.2.0)
Get a single task by ID. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `taskId` (required): The unique ID of the task

**Returns**: Single task object (same structure as `list_tasks`)

### `search_tasks` (v0.2.0)
Search tasks by text query across titles, descriptions, tags, and subtasks. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `query` (required): Search text to match

**Returns**: Array of matching tasks (same structure as `list_tasks`)

---

### `get_productivity_metrics` (v0.3.0)
Get comprehensive productivity metrics. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

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
Analyze task distribution and performance across quadrants. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

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
Get statistics for all tags with usage and completion rates. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `limit` (optional): Maximum number of tags to return

**Returns**:
```json
[
  {
    "tag": "#work",
    "count": 35,
    "completedCount": 28,
    "completionRate": 80
  },
  ...
]
```

### `get_upcoming_deadlines` (v0.3.0)
Get tasks grouped by deadline urgency. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Returns**:
```json
{
  "overdue": [...],
  "dueToday": [...],
  "dueThisWeek": [...]
}
```

### `get_task_insights` (v0.3.0)
Generate AI-friendly summary of task insights. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Returns**: Plain text summary with key metrics, streaks, deadlines, and recommendations.

### `validate_config` (v0.3.0)
Validate MCP server configuration and diagnose issues.

**Returns**:
```json
{
  "checks": [
    {
      "name": "API Connectivity",
      "status": "success",
      "details": "Connected to https://gsd.vinny.dev"
    },
    {
      "name": "Authentication",
      "status": "success",
      "details": "Token valid (3 devices registered)"
    },
    {
      "name": "Encryption",
      "status": "success",
      "details": "Successfully decrypted 42 tasks"
    }
  ]
}
```

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

---

## Write Operation Tools (v0.4.0)

###`create_task`
Create a new task with natural language input. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `title` (required): Task title
- `urgent` (required): Is this task urgent? (time-sensitive)
- `important` (required): Is this task important? (high-value, strategic)
- `description` (optional): Task description
- `dueDate` (optional): Due date as Unix timestamp (milliseconds)
- `tags` (optional): Array of tags (e.g., `["#work", "#project-alpha"]`)
- `subtasks` (optional): Array of subtask objects `{text, completed}`
- `recurrence` (optional): `'none'` | `'daily'` | `'weekly'` | `'monthly'`
- `dependencies` (optional): Array of task IDs that must be completed first

**Returns**: The newly created task object with generated ID

**Example:**
```
Create a task:
- Title: "Finish quarterly report"
- Urgent: true
- Important: true
- Due date: Friday at 5pm
- Tags: #work, #finance
```

### `update_task`
Update an existing task. All fields except ID are optional. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `id` (required): Task ID to update
- `title` (optional): New task title
- `description` (optional): New description
- `urgent` (optional): Change urgency (moves between quadrants)
- `important` (optional): Change importance (moves between quadrants)
- `dueDate` (optional): New due date (null to clear)
- `tags` (optional): Replace all tags
- `subtasks` (optional): Replace all subtasks
- `recurrence` (optional): Change recurrence pattern
- `dependencies` (optional): Replace all dependencies
- `completed` (optional): Mark as complete/incomplete

**Returns**: The updated task object

**Example:**
```
Update task abc123:
- Move to "Schedule" quadrant (urgent=false, important=true)
- Add tags: #project-alpha, #q1-goals
```

### `complete_task`
Mark a task as complete or incomplete. Quick shortcut for updating completion status. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `id` (required): Task ID
- `completed` (required): `true` to mark complete, `false` to mark incomplete

**Returns**: The updated task object

**Example:**
```
Mark task xyz789 as complete
```

### `delete_task`
Permanently delete a task. **This action cannot be undone.** **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `id` (required): Task ID to delete

**Returns**: Confirmation message

**Example:**
```
Delete task def456
```

**⚠️ Warning**: Deleted tasks cannot be recovered!

### `bulk_update_tasks`
Update multiple tasks at once. Limited to 50 tasks per operation for safety. **Requires `GSD_ENCRYPTION_PASSPHRASE`**.

**Parameters**:
- `taskIds` (required): Array of task IDs to update (max 50)
- `operation` (required): Operation object with `type` field
  - `type: 'complete'` - Mark all as complete/incomplete
    - `completed`: boolean
  - `type: 'move_quadrant'` - Move all to a quadrant
    - `urgent`: boolean
    - `important`: boolean
  - `type: 'add_tags'` - Add tags to all tasks
    - `tags`: string[]
  - `type: 'remove_tags'` - Remove tags from all tasks
    - `tags`: string[]
  - `type: 'set_due_date'` - Set due date for all tasks
    - `dueDate`: number | null
  - `type: 'delete'` - Delete all tasks
- `maxTasks` (optional): Safety limit (default: 50)

**Returns**: Result object with `updated` count and `errors` array

**Examples:**
```
Complete all tasks tagged #quick-wins

Move all #work tasks to the Schedule quadrant

Add #priority tag to all overdue tasks

Delete all completed tasks from last year
```

**🔒 Safety Features**:
- Maximum 50 tasks per operation
- Clear error messages for each failed task
- Transactional (all-or-nothing for the API push)

## Privacy & Security

**What This Server Can Access** (varies by configuration):

**Without `GSD_ENCRYPTION_PASSPHRASE` (v0.1.0 metadata-only)**:
- ✅ Sync metadata (timestamps, counts, status)
- ✅ Device information (names, last seen)
- ✅ Storage statistics
- ❌ Task content (titles, descriptions, etc.)
- ❌ Task details (quadrants, tags, due dates)

**With `GSD_ENCRYPTION_PASSPHRASE` (v0.2.0+ full access)**:
- ✅ All metadata (same as above)
- ✅ Task titles and descriptions
- ✅ Quadrant classifications, tags, due dates
- ✅ Subtasks and checklists
- ✅ Task dependencies
- ✅ All decrypted task content
- ✅ **Can create, update, and delete tasks** (v0.4.0+)

**Security Model**:
- 🔒 **End-to-end encryption maintained**: Tasks encrypted in database, decrypted locally
- 🔒 **Zero-knowledge server**: Worker cannot decrypt your tasks
- 🔒 **Passphrase stays local**: Never sent to server, stored only in Claude Desktop config
- 🔒 **Opt-in decryption**: Decryption disabled by default, requires explicit passphrase
- ✍️ **Write operations** (v0.4.0): Full task management with encryption
- 🔐 **JWT authentication**: Uses existing OAuth tokens with 7-day expiry
- 🛡️ **Safety limits**: Bulk operations limited to 50 tasks, clear validation

**See `DECRYPTION.md` for detailed security documentation.**

## Troubleshooting

### "Configuration error: Required environment variables"
- Check that `GSD_API_URL` and `GSD_AUTH_TOKEN` are set in your Claude Desktop config
- Ensure there are no typos in the environment variable names

### "API request failed: 401 Unauthorized"
- Your JWT token has expired - get a new token from the OAuth flow
- Update the `GSD_AUTH_TOKEN` in your config
- Restart Claude Desktop

### "API request failed: 404 Not Found"
- Check that `GSD_API_URL` is correct
- Ensure your Worker is deployed and accessible
- Try accessing the URL in your browser: `{GSD_API_URL}/health`

### "Cannot find module" error
- **If using npx**: Ensure you have internet connection (npx needs to download the package)
- **If using local build**:
  - Run `npm run build` to compile TypeScript
  - Check that the path in Claude config is absolute and correct
  - Verify that `dist/index.js` exists after building

### "Encryption passphrase not provided" (v0.2.0)
- This error appears when using decryption tools without the passphrase
- Add `GSD_ENCRYPTION_PASSPHRASE` to your Claude Desktop config
- Restart Claude Desktop after adding the passphrase

### "Failed to fetch encryption salt" (v0.2.0)
- The Worker endpoint for encryption salt is not accessible
- Ensure Worker is deployed with v0.2.0+ (includes GET `/api/auth/encryption-salt`)
- Check your JWT token is valid and not expired

### "Decryption failed - passphrase is incorrect" (v0.2.0)
- The provided passphrase doesn't match the one used to encrypt tasks
- Double-check your passphrase (case-sensitive!)
- You can view/reset your passphrase in GSD app Settings → Sync

**See `TESTING_V0.2.md` for comprehensive testing and troubleshooting guide.**

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
export GSD_API_URL="https://gsd.vinny.dev"
export GSD_AUTH_TOKEN="your-jwt-token"
export GSD_ENCRYPTION_PASSPHRASE="your-passphrase"
npm start
```

Then send MCP protocol JSON over stdin (advanced).

**Publishing to npm**:
```bash
# Update version (patch/minor/major)
npm version patch

# Publish (requires 2FA code)
npm publish --access public --otp=YOUR_CODE
```

## Future Enhancements

**Write Operations** (v0.4.0)
- Create new tasks via natural language
- Update existing tasks (title, description, quadrant, etc.)
- Complete/uncomplete tasks
- Delete tasks
- Conflict resolution for concurrent edits
- Batch operations support

**Advanced Features** (v0.5.0+)
- AI-powered task suggestions based on patterns
- Priority recommendations using AI
- Deadline predictions
- Historical trend analysis (7/30/90 day views)
- Cross-integration with calendar/email (MCP chaining)
- Custom analytics queries

## Architecture

```
packages/mcp-server/
├── src/
│   ├── index.ts      # MCP server setup, tool routing
│   ├── tools.ts      # Tool implementations, API calls
│   └── crypto.ts     # Encryption/decryption (v0.2.0)
├── dist/             # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── README.md         # This file
├── QUICKSTART.md     # Quick setup guide
├── DECRYPTION.md     # Security documentation (v0.2.0)
├── TESTING.md        # Testing procedures
└── TESTING_V0.2.md   # v0.2.0 testing guide
```

**Tech Stack**:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Runtime schema validation
- `typescript` - Type safety
- `node:crypto` (webcrypto) - AES-256-GCM encryption (v0.2.0)

**Communication Flow**:
```
Claude Desktop
    ↓ MCP Protocol (stdio)
GSD MCP Server
    ├─ Metadata queries (v0.1.0)
    │   ↓ HTTPS + JWT
    │  GSD Worker API
    │   ↓ D1 Queries
    │  Metadata (counts, status)
    │
    └─ Decryption queries (v0.2.0)
        ↓ HTTPS + JWT
       GSD Worker API
        ↓ D1 Queries
       Encrypted Task Blobs
        ↓ Local decryption (AES-256-GCM)
       Decrypted Tasks → Claude
```

## Contributing

This is an experimental feature. Feedback and contributions welcome!

1. Test the PoC and report issues
2. Suggest additional tools/features
3. Submit PRs for enhancements

## License

MIT - Same as GSD Task Manager

---

**Status**: v0.4.0 (Write Operations) 🔥
**New in v0.4.0**:
- ✍️ **Full task management** - Create, update, delete tasks
- 🔄 **Bulk operations** - Update up to 50 tasks at once
- 🔐 **Encrypted writes** - All changes encrypted before sync
- 🛡️ **Safety features** - Bulk limits, validation, clear errors
- 📊 **18 total MCP tools** (13 read + 5 write)

**Previous Releases**:
- v0.3.2 - Built-in prompts, help tool
- v0.3.0 - Interactive setup, analytics, validation
- v0.2.0 - Decrypted task access
- v0.1.0 - Metadata-only access

**Privacy**: Opt-in decryption with local passphrase
**Security**: E2E encryption maintained, zero-knowledge server
**Capabilities**: Full task management (create, read, update, delete)
**Deployment**: Published to npm ✅ | Ready for production ✅
