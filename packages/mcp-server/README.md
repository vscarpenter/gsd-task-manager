# GSD Task Manager MCP Server

Model Context Protocol (MCP) server for GSD Task Manager. Provides read-only access to your synced tasks through Claude Desktop and other MCP-compatible AI assistants.

## Features

**Metadata Access** (v0.1.0)
- ✅ Sync status monitoring
- ✅ Device management overview
- ✅ Task statistics (metadata only)

**Decrypted Task Access** (v0.2.0) 🆕
- ✅ List all tasks with full content (opt-in)
- ✅ Search tasks by title, description, tags, subtasks
- ✅ Filter by quadrant, completion status, tags
- ✅ Get individual task details
- 🔒 Privacy-first: Requires user-provided encryption passphrase
- 🔒 Read-only: Cannot modify or create tasks

**Planned** (Future v0.3.0+)
- Write operations (create, update, delete tasks)
- Advanced analytics queries
- AI-powered task suggestions

## Prerequisites

1. **GSD Task Manager** with sync enabled
2. **OAuth Authentication** completed (Google or Apple)
3. **Node.js** 18+ installed
4. **Claude Desktop** or another MCP-compatible client

## Installation

### 1. Install Dependencies

From the `packages/mcp-server` directory:

```bash
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Get Your Auth Token

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

### 4. Configure Claude Desktop

Add the MCP server to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "node",
      "args": [
        "/absolute/path/to/gsd-taskmanager/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "GSD_API_URL": "https://gsd-sync-worker-production.vscarpenter.workers.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-passphrase-here"
      }
    }
  }
}
```

**Important Notes**:
- Replace `/absolute/path/to/gsd-taskmanager` with your actual project path
- Use your Worker API URL (development, staging, or production)
- Token will expire - you'll need to update it periodically (every 7 days)
- **Optional**: Add `GSD_ENCRYPTION_PASSPHRASE` to enable decrypted task access (v0.2.0)
  - Without it: Only metadata tools work (sync status, devices, stats)
  - With it: Full task content access (list, search, read tasks)

### 5. Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Usage

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

Claude will use the MCP tools to fetch real-time data from your Worker API.

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

## Privacy & Security

**What This Server Can Access** (varies by configuration):

**Without `GSD_ENCRYPTION_PASSPHRASE` (v0.1.0 metadata-only)**:
- ✅ Sync metadata (timestamps, counts, status)
- ✅ Device information (names, last seen)
- ✅ Storage statistics
- ❌ Task content (titles, descriptions, etc.)
- ❌ Task details (quadrants, tags, due dates)

**With `GSD_ENCRYPTION_PASSPHRASE` (v0.2.0 full access)**:
- ✅ All metadata (same as above)
- ✅ Task titles and descriptions
- ✅ Quadrant classifications, tags, due dates
- ✅ Subtasks and checklists
- ✅ Task dependencies
- ✅ All decrypted task content
- ❌ Cannot create or modify tasks (read-only)

**Security Model**:
- 🔒 **End-to-end encryption maintained**: Tasks encrypted in database, decrypted locally
- 🔒 **Zero-knowledge server**: Worker cannot decrypt your tasks
- 🔒 **Passphrase stays local**: Never sent to server, stored only in Claude Desktop config
- 🔒 **Opt-in decryption**: Decryption disabled by default, requires explicit passphrase
- 🔒 **Read-only access**: MCP server cannot modify, create, or delete tasks
- 🔐 **JWT authentication**: Uses existing OAuth tokens with 7-day expiry

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
export GSD_API_URL="https://sync.gsd.vinny.dev"
export GSD_AUTH_TOKEN="your-jwt-token"
npm start
```

Then send MCP protocol JSON over stdin (advanced).

## Future Enhancements

**Write Operations** (v0.3.0)
- Create new tasks via natural language
- Update existing tasks (title, description, quadrant, etc.)
- Complete/uncomplete tasks
- Delete tasks
- Conflict resolution for concurrent edits

**Advanced Analytics** (v0.4.0)
- Productivity trends over time
- Quadrant distribution analysis
- Tag-based insights
- Completion rate tracking
- Workload balancing recommendations

**AI-Powered Features** (v0.5.0)
- Smart task suggestions based on patterns
- Priority recommendations using AI
- Deadline predictions
- Cross-integration with calendar/email (MCP chaining)

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

**Status**: v0.2.0 (Decrypted Task Access)
**Privacy**: Opt-in decryption with local passphrase
**Security**: E2E encryption maintained, zero-knowledge server, read-only access
**Deployment**: Worker deployed ✅ | MCP server built ✅ | Ready for testing
