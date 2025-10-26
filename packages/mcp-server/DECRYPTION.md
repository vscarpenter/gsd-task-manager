# Decrypted Task Access - v0.2.0

**⚠️ SECURITY WARNING**: This feature gives AI assistants full access to decrypt your task content. Only enable if you understand the security implications.

## What This Enables

With decryption enabled, you can ask Claude:
- "List all my active tasks"
- "What tasks are due this week?"
- "Search for tasks about the quarterly report"
- "Show me all tasks tagged #work"
- "What are my Do First (Q1) tasks?"

## Requirements

1. **Worker Deployment**: The Worker must have the GET endpoint for encryption salt (added in this version)
2. **Encryption Passphrase**: You need the passphrase you set up during OAuth onboarding
3. **Environment Variable**: Set `GSD_ENCRYPTION_PASSPHRASE` in Claude Desktop config

## Setup Steps

### Step 1: Deploy Updated Worker

The Worker needs a new endpoint to retrieve your encryption salt:

```bash
cd /Users/vinnycarpenter/Projects/gsd-taskmanager/worker
pnpm deploy:production
```

This adds `GET /api/auth/encryption-salt` to retrieve your salt.

### Step 2: Find Your Encryption Passphrase

Your encryption passphrase is what you entered when you first set up sync in the GSD app.

**If you don't remember it**:
- You can reset it in the GSD app Settings → Sync → Reset Encryption
- WARNING: This will require re-syncing all devices

**If you remember it**:
- Keep it handy for the next step

### Step 3: Update Claude Desktop Config

Add the `GSD_ENCRYPTION_PASSPHRASE` environment variable:

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gsd-tasks": {
      "command": "node",
      "args": [
        "/Users/vinnycarpenter/Projects/gsd-taskmanager/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "GSD_API_URL": "https://gsd-sync-worker-production.vscarpenter.workers.dev",
        "GSD_AUTH_TOKEN": "your-jwt-token",
        "GSD_ENCRYPTION_PASSPHRASE": "your-encryption-passphrase-here"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop

### Step 5: Test It!

Ask Claude:

```
List my active tasks
```

If it works, you'll see:
- Task titles
- Descriptions
- Quadrants
- Tags
- Due dates
- Subtasks
- Everything decrypted!

## Available Tools

### `list_tasks`

List all decrypted tasks with optional filtering.

**Examples**:
- "List all my tasks"
- "Show me tasks in the Do First quadrant"
- "What tasks are tagged #work?"
- "Show me only completed tasks"

**Filters**:
- `quadrant`: Filter by quadrant ID
  - `urgent-important` (Q1 - Do First)
  - `not-urgent-important` (Q2 - Schedule)
  - `urgent-not-important` (Q3 - Delegate)
  - `not-urgent-not-important` (Q4 - Eliminate)
- `completed`: Filter by completion status (true/false)
- `tags`: Filter by tags (array)

### `get_task`

Get a single task by ID.

**Example**:
- "Show me details for task ABC123"

### `search_tasks`

Search tasks by text query across titles, descriptions, tags, and subtasks.

**Examples**:
- "Search for tasks about the quarterly report"
- "Find tasks mentioning Sarah"
- "Search for #meeting tasks"

## Security Considerations

### What You're Giving Claude Access To

✅ **Full Task Content**:
- All task titles and descriptions
- All tags and subtasks
- All due dates and metadata
- Dependencies and relationships

❌ **What Claude Cannot Do** (read-only):
- Create new tasks
- Update existing tasks
- Delete tasks
- Modify any data

### Security Best Practices

1. **Passphrase Storage**:
   - Stored only in your local Claude Desktop config
   - Never sent to Anthropic's servers
   - Only used locally to decrypt tasks

2. **Token Rotation**:
   - JWT tokens expire (7 days by default)
   - Update `GSD_AUTH_TOKEN` when it expires

3. **Passphrase Rotation**:
   - Change your passphrase regularly
   - Update `GSD_ENCRYPTION_PASSPHRASE` in config

4. **Audit Claude's Responses**:
   - Review what Claude does with your data
   - Don't share sensitive task info in Claude conversations

### Disable Decryption

To disable decrypted task access:

1. Remove `GSD_ENCRYPTION_PASSPHRASE` from Claude Desktop config
2. Restart Claude Desktop

The metadata-only tools (sync status, devices, stats) will still work.

## Troubleshooting

### "Encryption passphrase not provided"

**Solution**: Add `GSD_ENCRYPTION_PASSPHRASE` to your Claude Desktop config

### "Failed to fetch encryption salt"

**Cause**: Worker doesn't have the GET endpoint yet

**Solution**: Deploy the updated Worker:
```bash
cd worker && pnpm deploy:production
```

### "Encryption not set up for this account"

**Cause**: You haven't set up encryption in the GSD app yet

**Solution**:
1. Open GSD app (https://gsd.vinny.dev)
2. Go to Settings → Sync
3. Complete encryption setup
4. Try again

### "Decryption failed - passphrase is incorrect"

**Cause**: Wrong passphrase provided

**Solution**:
1. Double-check your passphrase (case-sensitive!)
2. If forgotten, reset encryption in GSD app
3. Update config with new passphrase

### No tasks returned

**Possible causes**:
- No tasks synced yet (create some tasks in GSD app)
- Filter too restrictive (try without filters)
- All tasks deleted (check in app)

## How It Works

### Encryption Architecture

1. **Key Derivation**:
   - Your passphrase + salt → encryption key (PBKDF2, 600,000 iterations)
   - Salt is stored on server (not secret)
   - Passphrase never leaves your machine

2. **Decryption Flow**:
   ```
   Claude asks for tasks
     ↓
   MCP server fetches encrypted blobs from Worker
     ↓
   MCP server gets your salt from Worker
     ↓
   MCP server derives key from passphrase + salt
     ↓
   MCP server decrypts each task (AES-256-GCM)
     ↓
   Claude receives decrypted tasks
   ```

3. **Privacy**:
   - Tasks encrypted end-to-end
   - Server stores encrypted blobs only
   - Decryption happens locally in MCP server
   - Zero-knowledge architecture maintained

## Examples

### Example 1: Weekly Planning

```
Q: What are my active tasks for this week?

A: Based on your tasks, here are your active tasks:

**Do First (Q1)**:
- "Finish quarterly report" (due in 2 days)
- "Review team performance" (due tomorrow)

**Schedule (Q2)**:
- "Plan next sprint" (due Friday)
- "Update documentation"

You have 2 urgent tasks that need immediate attention.
```

### Example 2: Task Search

```
Q: Search for tasks about the quarterly report

A: I found 3 tasks related to the quarterly report:

1. "Finish quarterly report" (Q1 - Do First)
   - Due: Jan 15
   - Tags: #work, #finance
   - Subtasks: 2/5 completed

2. "Review Q4 numbers for report"
   - Completed ✓

3. "Schedule quarterly report presentation"
   - Due: Jan 20
```

### Example 3: Quadrant Analysis

```
Q: How are my tasks distributed across quadrants?

A: Your task distribution:

- **Q1 (Do First)**: 5 tasks
- **Q2 (Schedule)**: 12 tasks
- **Q3 (Delegate)**: 3 tasks
- **Q4 (Eliminate)**: 2 tasks

You're doing well! Most tasks (12) are in Q2 (important but not urgent),
which shows good planning. Consider delegating or eliminating the 5 Q3/Q4 tasks.
```

## Version History

- **v0.2.0** (Current): Added decrypted task access with security safeguards
- **v0.1.0**: Read-only metadata access (sync status, devices, task counts)

---

**Remember**: This is powerful but requires trust. Only enable if you're comfortable with Claude having full read access to your tasks.
