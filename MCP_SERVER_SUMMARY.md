# GSD Task Manager - MCP Server Summary

**Version:** 5.0.0
**Feature:** AI-Powered Task Management with Claude Desktop Integration
**Status:** ✅ Fully Implemented

## Overview

The GSD Task Manager MCP (Model Context Protocol) Server enables AI assistants like Claude Desktop to access and analyze your tasks through natural language queries while maintaining end-to-end encryption. This document provides a comprehensive technical overview of the MCP server implementation.

## What is MCP?

**Model Context Protocol (MCP)** is Anthropic's open protocol for connecting AI assistants to external data sources and services. It provides a standardized way for AI models to:
- Access structured data from external systems
- Execute queries and operations securely
- Maintain context across conversations
- Integrate with user workflows

For GSD Task Manager, MCP enables Claude Desktop to:
- Read and analyze your encrypted tasks
- Search across all task content (titles, descriptions, tags, subtasks)
- Provide insights on productivity patterns
- Answer natural language questions about your tasks
- Help with weekly planning and task prioritization

**Key Principle:** The MCP server is **read-only** — Claude cannot modify, create, or delete tasks. This ensures safe exploration of your task data.

## Architecture

### High-Level Components

```
┌─────────────────────┐
│  Claude Desktop     │
│  (AI Assistant)     │
└──────────┬──────────┘
           │ stdio (JSON-RPC 2.0)
           │
┌──────────▼──────────┐
│   MCP Server        │
│  (Node.js/TS)       │
│  - Decryption       │
│  - API Client       │
│  - Tool Handlers    │
└──────────┬──────────┘
           │ HTTPS (Bearer Token)
           │
┌──────────▼──────────┐
│  Cloudflare Worker  │
│  (Sync API)         │
│  - Encrypted Tasks  │
│  - Authentication   │
│  - Device Mgmt      │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   D1 Database       │
│  (SQLite)           │
│  - Encrypted Blobs  │
│  - User Records     │
│  - Vector Clocks    │
└─────────────────────┘
```

### Component Details

#### 1. MCP Server (`packages/mcp-server/`)
- **Runtime:** Node.js 18+ with TypeScript
- **Communication:** stdio transport (JSON-RPC 2.0)
- **Location:** Runs locally on user's machine
- **Purpose:** Bridge between Claude Desktop and GSD Worker API

**Key Modules:**
- `index.ts` — MCP server entry point, tool registration, stdio communication
- `crypto.ts` — Encryption/decryption utilities using Node.js Web Crypto API
- `tools.ts` — API client and tool implementation (6 tools)

#### 2. Decryption Module (`crypto.ts`)
Ports the client-side encryption logic to Node.js for local task decryption.

**Encryption Specifications:**
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Derivation:** PBKDF2 with SHA-256
- **Iterations:** 600,000 (OWASP 2023 recommendation)
- **Key Length:** 256 bits
- **Nonce Length:** 96 bits (12 bytes)
- **Tag Length:** 128 bits (16 bytes)

**Flow:**
1. Fetch user's encryption salt from Worker (`/api/auth/encryption-salt`)
2. Derive encryption key from passphrase + salt using PBKDF2
3. Decrypt task blobs using AES-GCM with nonce
4. Parse decrypted JSON to TaskRecord objects

**Code Example:**
```typescript
// Initialize crypto manager with passphrase and salt
await cryptoManager.deriveKey(passphrase, salt);

// Decrypt task blob
const decryptedJson = await cryptoManager.decrypt(
  encryptedBlob,
  nonce
);

const task = JSON.parse(decryptedJson) as DecryptedTask;
```

#### 3. API Client (`tools.ts`)
Makes authenticated HTTPS requests to the Cloudflare Worker sync API.

**Configuration:**
```typescript
interface GsdConfig {
  apiBaseUrl: string;           // e.g., https://gsd.vinny.dev
  authToken: string;             // JWT token from OAuth flow
  encryptionPassphrase?: string; // User's passphrase (optional)
}
```

**API Endpoints Used:**
- `GET /api/auth/encryption-salt` — Fetch user's encryption salt
- `POST /api/sync/pull` — Fetch encrypted task blobs
- `GET /api/sync/status` — Check sync health
- `GET /api/devices` — List registered devices

**Authentication:**
```typescript
Authorization: Bearer <JWT_TOKEN>
```

## Available MCP Tools

The MCP server exposes 6 tools that Claude Desktop can use:

### 1. `list_tasks`
**Purpose:** List all decrypted tasks with optional filtering

**Input Schema:**
```typescript
{
  quadrant?: 'urgent-important' | 'not-urgent-important' |
             'urgent-not-important' | 'not-urgent-not-important';
  completed?: boolean;
  tags?: string[];
}
```

**Output:** Array of DecryptedTask objects

**Use Cases:**
- "Show me all urgent tasks"
- "List tasks in Q2 (Schedule quadrant)"
- "What tasks are tagged with #work?"

### 2. `get_task`
**Purpose:** Get detailed information about a specific task by ID

**Input Schema:**
```typescript
{
  taskId: string;  // nanoid
}
```

**Output:** Single DecryptedTask object with full details

**Use Cases:**
- "Tell me more about task ABC123"
- "What are the subtasks for this project?"

### 3. `search_tasks`
**Purpose:** Search across titles, descriptions, tags, and subtasks

**Input Schema:**
```typescript
{
  query: string;  // Search term
}
```

**Output:** Array of matching DecryptedTask objects

**Use Cases:**
- "Find all tasks mentioning the quarterly report"
- "Search for tasks about the client meeting"

### 4. `get_sync_status`
**Purpose:** Check sync health and storage usage

**Input Schema:** None (uses authenticated user from config)

**Output:**
```typescript
{
  lastSyncAt: number | null;      // Unix timestamp
  pendingPushCount: number;        // Tasks to upload
  pendingPullCount: number;        // Tasks to download
  conflictCount: number;           // Unresolved conflicts
  deviceCount: number;             // Registered devices
  storageUsed: number;             // Bytes used in D1
  storageQuota: number;            // Total quota
}
```

**Use Cases:**
- "Check my sync status"
- "How many devices do I have?"

### 5. `list_devices`
**Purpose:** View all registered devices for the authenticated user

**Input Schema:** None

**Output:**
```typescript
Array<{
  id: string;              // Device ID
  name: string | null;     // Device name (browser/OS)
  lastSeenAt: number;      // Unix timestamp
  isActive: boolean;       // Active in last 7 days
  isCurrent: boolean;      // This device
}>
```

**Use Cases:**
- "Show me all my devices"
- "Which devices have access to my tasks?"

### 6. `get_task_stats`
**Purpose:** Get task statistics and metadata

**Input Schema:** None

**Output:**
```typescript
{
  totalTasks: number;
  activeTasks: number;
  deletedTasks: number;
  lastUpdated: number | null;     // Most recent task update
  oldestTask: number | null;      // Earliest task creation
  newestTask: number | null;      // Latest task creation
}
```

**Use Cases:**
- "How many tasks do I have?"
- "What's my task breakdown?"

## DecryptedTask Schema

All MCP tools return tasks in this format:

```typescript
interface DecryptedTask {
  id: string;                    // nanoid
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrantId: string;            // Derived from urgent/important
  completed: boolean;
  dueDate: number | null;        // Unix timestamp
  tags: string[];                // e.g., ['#work', '#urgent']
  subtasks: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dependencies: string[];        // Array of task IDs
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
}
```

## Security Model

### End-to-End Encryption Maintained

**Key Principle:** The MCP server maintains the zero-knowledge architecture of GSD's cloud sync.

**Security Flow:**
1. **Worker Storage** — Cloudflare Worker stores only encrypted task blobs + metadata
2. **MCP Decryption** — MCP server decrypts tasks locally on user's machine
3. **Passphrase Storage** — Encryption passphrase stored only in Claude Desktop config (never in cloud)
4. **Read-Only Access** — MCP server cannot modify, create, or delete tasks

**What the Worker Knows:**
- ✅ Encrypted task blobs (AES-256-GCM ciphertext)
- ✅ Task metadata (IDs, timestamps, vector clocks)
- ✅ User's encryption salt (for key derivation, but useless without passphrase)
- ❌ Task plaintext content (titles, descriptions, tags, etc.)
- ❌ User's encryption passphrase

**What the MCP Server Knows:**
- ✅ User's encryption passphrase (from local config)
- ✅ Decrypted task content (ephemeral, in memory only)
- ✅ JWT token for API authentication
- ❌ Nothing persisted to disk (stateless tool calls)

**What Claude Desktop Knows:**
- ✅ Decrypted task content (provided by MCP tools)
- ✅ Context from conversation (ephemeral)
- ❌ Encryption passphrase (not exposed in tool responses)

### Threat Model

**Protected Against:**
- ✅ Worker compromise (cannot decrypt tasks without passphrase)
- ✅ Database breach (encrypted blobs useless without passphrase)
- ✅ MCP server compromise (read-only, no write operations)
- ✅ Accidental task deletion (MCP has no delete capability)

**Requires Trust In:**
- ⚠️ Claude Desktop client (has access to decrypted tasks during session)
- ⚠️ User's local machine (where passphrase and decryption happen)
- ⚠️ Anthropic's MCP implementation (stdio communication)

### Best Practices

1. **Strong Passphrase** — Use a unique, strong passphrase for encryption (not your account password)
2. **Secure Storage** — Claude Desktop config is protected by OS-level file permissions
3. **Token Rotation** — JWT tokens expire regularly (7 days default)
4. **Device Management** — Revoke access for lost/compromised devices via Worker API
5. **Read-Only** — MCP server cannot write, so no risk of data corruption

## Setup and Configuration

### Prerequisites

1. **GSD Task Manager** with cloud sync enabled
   - Active OAuth account (Google or Apple)
   - Encryption passphrase set up in the app
   - At least one device synced with encrypted tasks

2. **Claude Desktop** installed
   - Download from claude.ai
   - macOS, Windows, or Linux supported

3. **Node.js 18+** for running the MCP server
   - Check: `node --version`

### Installation Steps

#### 1. Install MCP Server Package

**Option A: Global npm install** (recommended for end users)
```bash
npm install -g @gsd/mcp-server
```

**Option B: Local development** (for contributors)
```bash
cd packages/mcp-server
npm install
npm run build
npm link
```

#### 2. Configure Claude Desktop

Edit Claude Desktop config file:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%/Claude/claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

**Add MCP Server Configuration:**
```json
{
  "mcpServers": {
    "gsd-taskmanager": {
      "command": "npx",
      "args": [
        "-y",
        "@gsd/mcp-server"
      ],
      "env": {
        "GSD_API_BASE_URL": "https://gsd.vinny.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-encryption-passphrase"
      }
    }
  }
}
```

#### 3. Get Your Authentication Token

**Option A: From Browser DevTools**
1. Open GSD Task Manager in browser
2. Open DevTools → Application → Local Storage
3. Find `gsd_auth_token` key
4. Copy the JWT value

**Option B: From Network Tab**
1. Perform a sync operation in GSD app
2. Open DevTools → Network tab
3. Find `/api/sync/pull` request
4. Copy `Authorization: Bearer <token>` header value

**Token Format:**
```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwianRpIjoidG9rZW4taWQiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDYwNDgwMH0.signature
```

**Important:** Tokens expire after 7 days. You'll need to update the config with a fresh token when it expires.

#### 4. Restart Claude Desktop

After saving the config, restart Claude Desktop for changes to take effect.

### Verification

Test the MCP server connection in Claude Desktop:

**Example prompts:**
- "List my GSD tasks"
- "What tasks do I have in the urgent-important quadrant?"
- "Show me my sync status"

If working correctly, Claude will use the MCP tools to fetch and display your decrypted tasks.

## Usage Examples

### Weekly Planning

**Prompt:**
```
What are my urgent tasks for this week?
```

**Claude Response:**
```
I'll check your urgent tasks using the GSD MCP server.

[Uses list_tasks with completed=false filter]

You have 5 urgent tasks due this week:

Q1 (Urgent + Important):
1. "Complete quarterly report" - Due tomorrow
   - Tags: #work #deadline
   - Subtasks: 2/5 completed

2. "Client presentation prep" - Due in 3 days
   - Tags: #work #client
   - Blocking: "Review slides" task

[... more tasks ...]
```

### Task Discovery

**Prompt:**
```
Find all tasks mentioning "budget review"
```

**Claude Response:**
```
I'll search your tasks for "budget review".

[Uses search_tasks with query="budget review"]

Found 3 tasks:

1. "Q4 Budget Review" (Q2 - Schedule)
   - Description: "Review department budgets and prepare recommendations"
   - Tags: #finance #quarterly
   - Created: 2 weeks ago

2. "Follow up on budget review comments" (Q1 - Do First)
   - Dependencies: "Q4 Budget Review"
   - Due: Next Monday

[... more results ...]
```

### Productivity Analysis

**Prompt:**
```
How many tasks do I have in each quadrant?
```

**Claude Response:**
```
Let me check your task distribution.

[Uses list_tasks to get all tasks, then analyzes by quadrant]

Your task breakdown:
- Q1 (Urgent + Important): 8 tasks (32%)
- Q2 (Not Urgent + Important): 12 tasks (48%)
- Q3 (Urgent + Not Important): 3 tasks (12%)
- Q4 (Not Urgent + Not Important): 2 tasks (8%)

Insight: You're spending 48% of your energy in Q2 (Schedule), which is ideal!
Consider delegating or eliminating the Q3/Q4 tasks to focus more on strategic work.
```

### Dependency Analysis

**Prompt:**
```
Which tasks are blocked by uncompleted dependencies?
```

**Claude Response:**
```
I'll analyze your task dependencies.

[Uses list_tasks and checks dependency chains]

You have 4 tasks currently blocked:

1. "Deploy to production" (Q1)
   - Blocked by: "Run integration tests" (incomplete)
   - Blocked by: "Security review" (incomplete)

2. "Write API documentation" (Q2)
   - Blocked by: "Finalize API endpoints" (incomplete)

[... more blocked tasks ...]

Recommendation: Focus on completing the 2 "blocker" tasks to unblock 4 downstream tasks.
```

## Development Notes

### Project Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── crypto.ts         # Encryption/decryption
│   └── tools.ts          # API client and tools
├── package.json
├── tsconfig.json
├── README.md             # Setup instructions
└── test-limit-100.sh     # API testing script
```

### Building from Source

```bash
cd packages/mcp-server
npm install
npm run build        # Outputs to dist/
npm run dev          # Watch mode for development
```

### Testing

**Test Script:** `test-limit-100.sh`
- Tests `/api/sync/pull` endpoint with limit parameter
- Validates encrypted task retrieval
- Useful for debugging API connectivity

**Example:**
```bash
./test-limit-100.sh

Testing with limit: 100 (valid)
✅ Success! Retrieved 42 tasks
```

### Debugging

**Enable Debug Logging:**
```json
{
  "mcpServers": {
    "gsd-taskmanager": {
      "command": "node",
      "args": [
        "--inspect",
        "dist/index.js"
      ],
      "env": {
        "DEBUG": "mcp:*",
        "NODE_ENV": "development",
        ...
      }
    }
  }
}
```

**Check Claude Desktop Logs:**
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%/Claude/logs/`
- Linux: `~/.config/Claude/logs/`

**Common Issues:**

1. **"Encryption key not initialized"**
   - Cause: Missing `GSD_ENCRYPTION_PASSPHRASE` in config
   - Fix: Add passphrase to environment variables

2. **"Failed to fetch encryption salt: 401"**
   - Cause: Expired or invalid JWT token
   - Fix: Get fresh token from browser and update config

3. **"Decryption failed - data may be corrupted or passphrase is incorrect"**
   - Cause: Wrong passphrase or salt mismatch
   - Fix: Verify passphrase matches what was used in the GSD app

4. **"Task not found"**
   - Cause: Task ID doesn't exist or task not synced yet
   - Fix: Trigger sync in GSD app, then retry

### Contributing

The MCP server is open source under MIT license. Contributions welcome!

**Contribution Areas:**
- Additional MCP tools (e.g., task statistics, trend analysis)
- Performance optimizations (caching, batch decryption)
- Enhanced error messages and debugging
- Cross-platform testing (Windows, Linux)
- Documentation improvements

**Guidelines:**
- Follow TypeScript strict mode
- Add tests for new tools
- Update README.md with new features
- Maintain zero-knowledge security model

## Troubleshooting

### Authentication Issues

**Symptom:** "401 Unauthorized" errors

**Solutions:**
1. Verify JWT token is valid (not expired)
2. Check token format (should start with `eyJ`)
3. Ensure token is from correct environment (dev/staging/prod)
4. Try getting fresh token from browser

### Decryption Issues

**Symptom:** "Decryption failed" errors

**Solutions:**
1. Verify passphrase matches GSD app
2. Check encryption salt was fetched successfully
3. Ensure PBKDF2 iterations match (600,000)
4. Test with a newly created task to rule out corruption

### Connection Issues

**Symptom:** MCP server not responding in Claude Desktop

**Solutions:**
1. Restart Claude Desktop after config changes
2. Check `claude_desktop_config.json` syntax (valid JSON)
3. Verify Node.js 18+ installed: `node --version`
4. Check Claude Desktop logs for error messages
5. Test API connectivity: `curl https://gsd.vinny.dev/api/sync/status`

### Performance Issues

**Symptom:** Slow tool responses

**Solutions:**
1. Reduce number of tasks synced (archive old tasks)
2. Use filters to limit result sets
3. Check network connectivity to Worker API
4. Monitor Worker performance (CloudFlare dashboard)

## Future Enhancements

**Planned Features:**
- [ ] **Task Modification Tools** — Allow Claude to create, update, delete tasks (opt-in)
- [ ] **Advanced Analytics Tools** — Productivity insights, trend forecasting
- [ ] **Natural Language Queries** — "Add a task to my work list" → auto-parse and create
- [ ] **Batch Operations** — "Complete all overdue tasks" → bulk updates
- [ ] **Caching Layer** — Cache decrypted tasks for faster repeated queries
- [ ] **Conflict Resolution** — AI-assisted merge conflict resolution
- [ ] **Integration Tools** — Export to calendar, email summaries, Slack notifications

**Community Requests:**
- Support for other AI assistants (OpenAI, Anthropic API)
- Multi-user shared task lists with MCP access
- Voice-to-task creation via MCP
- Task templates and recurring patterns via AI

## Conclusion

The GSD Task Manager MCP Server represents a significant advancement in AI-powered productivity tools:

✅ **Privacy-Preserving** — End-to-end encryption maintained throughout
✅ **Secure** — Read-only access, no risk of data loss
✅ **Powerful** — Natural language access to all task content
✅ **Extensible** — 6 tools with room for future expansion
✅ **User-Friendly** — Simple setup, intuitive usage

By integrating with Claude Desktop via MCP, users can leverage AI to:
- Plan their week with natural language queries
- Discover forgotten or blocked tasks
- Analyze productivity patterns
- Prioritize work more effectively

**Get Started:** [Setup Instructions](#setup-and-configuration)
**Report Issues:** [GitHub Issues](https://github.com/vscarpenter/gsd-taskmanager/issues)
**Contribute:** [Contributing Guidelines](#contributing)

---

Built with ❤️ using Model Context Protocol by Anthropic
**Version:** 5.0.0 | **License:** MIT
