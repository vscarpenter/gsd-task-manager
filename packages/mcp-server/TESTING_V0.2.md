# Testing v0.2.0 - Decrypted Task Access

**Status**: Worker deployed ✅ | MCP server built ✅ | Ready for testing

## Prerequisites Checklist

Before testing decryption, you need:

- [ ] Fresh JWT token (current one expired)
- [ ] Your encryption passphrase from GSD app
- [ ] At least 1 synced task in your account

## Step 1: Get Fresh JWT Token

### Option A: From Browser DevTools (Fastest)

1. Open https://gsd.vinny.dev in Chrome/Edge
2. Open DevTools (F12) → Application tab → Local Storage
3. Find `gsd_auth_token` key
4. Copy the value (starts with `eyJ...`)

### Option B: Re-authenticate via OAuth

1. Open GSD app: https://gsd.vinny.dev
2. Go to Settings → Sync
3. Sign out and sign in again
4. Extract token from local storage (see Option A)

## Step 2: Find Your Encryption Passphrase

Your encryption passphrase is what you entered when you first set up sync.

**If you don't remember it**:
- You can view it in the GSD app under Settings → Sync → Show Passphrase
- Or reset it (requires re-syncing all devices)

**Security Note**: This is the passphrase that decrypts your tasks locally. It's never sent to the server.

## Step 3: Update Claude Desktop Config

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

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
        "GSD_AUTH_TOKEN": "your-fresh-jwt-token-here",
        "GSD_ENCRYPTION_PASSPHRASE": "your-encryption-passphrase-here"
      }
    }
  }
}
```

**Replace**:
- `your-fresh-jwt-token-here` → Fresh JWT from Step 1
- `your-encryption-passphrase-here` → Your passphrase from Step 2

## Step 4: Restart Claude Desktop

1. **Quit** Claude Desktop completely (Cmd+Q on Mac)
2. **Reopen** Claude Desktop
3. Wait for it to fully load

## Step 5: Test Decryption

Ask Claude these test queries:

### Test 1: List All Tasks
```
List all my tasks
```

**Expected Output**: JSON array with decrypted tasks showing:
- Task titles
- Descriptions
- Quadrants (urgent-important, etc.)
- Tags
- Subtasks
- Due dates
- All metadata

### Test 2: Filter by Quadrant
```
Show me tasks in the Do First quadrant
```

**Expected Output**: Only Q1 (urgent-important) tasks

### Test 3: Search Tasks
```
Search for tasks about [some keyword in your tasks]
```

**Expected Output**: Tasks matching the search query

### Test 4: Get Specific Task
```
Get task details for [task-id-from-previous-query]
```

**Expected Output**: Full task details for that specific task

## Troubleshooting

### Error: "Encryption passphrase not provided"

**Cause**: `GSD_ENCRYPTION_PASSPHRASE` not set in config

**Fix**: Add the passphrase to your Claude Desktop config (Step 3)

### Error: "Failed to fetch encryption salt"

**Cause**: Worker endpoint not responding or token invalid

**Fix**:
1. Verify Worker is deployed: `curl https://gsd-sync-worker-production.vscarpenter.workers.dev/health`
2. Check token is valid (not expired)
3. Get fresh token from GSD app

### Error: "Encryption not set up for this account"

**Cause**: You haven't completed encryption setup in GSD app

**Fix**:
1. Open https://gsd.vinny.dev
2. Go to Settings → Sync
3. Complete encryption setup with a passphrase
4. Try again

### Error: "Decryption failed - passphrase is incorrect"

**Cause**: Wrong passphrase provided

**Fix**:
1. Double-check passphrase (case-sensitive!)
2. View passphrase in GSD app Settings → Sync
3. Update config with correct passphrase
4. Restart Claude Desktop

### No tasks returned but no errors

**Possible causes**:
- No tasks synced yet (create and sync some tasks in GSD app)
- All tasks filtered out (try without filters)
- Tasks exist but decryption is failing silently

**Fix**:
1. Open GSD app and verify you have tasks
2. Go to Settings → Sync and trigger a manual sync
3. Wait 30 seconds and try again

## Verification Script

Run this to verify the endpoint is accessible:

```bash
# Test health endpoint (no auth needed)
curl https://gsd-sync-worker-production.vscarpenter.workers.dev/health

# Test encryption salt endpoint (requires fresh token)
curl -H "Authorization: Bearer YOUR_FRESH_TOKEN" \
  https://gsd-sync-worker-production.vscarpenter.workers.dev/api/auth/encryption-salt
```

Expected response: `{"encryptionSalt":"base64-encoded-salt"}`

## Success Criteria

✅ **v0.2.0 is working if**:
- Claude can list your tasks with full content
- Search returns matching tasks
- Filtering by quadrant works
- No decryption errors in responses

## Security Reminder

⚠️ **What you've enabled**:
- Claude can now read ALL your task content
- Passphrase stored in local config only (not in cloud)
- Read-only access (Claude cannot modify tasks)

**Best practices**:
1. Use strong, unique passphrase
2. Rotate JWT tokens regularly (every 7 days)
3. Don't share sensitive task details in Claude conversations
4. Disable when not needed (remove passphrase from config)

## Next Steps After Successful Testing

Once decryption is confirmed working:

1. **Try real queries**:
   - "What are my urgent tasks this week?"
   - "How many tasks are overdue?"
   - "Show me all tasks tagged #work"

2. **Explore use cases**:
   - Weekly planning with Claude
   - Task search and discovery
   - Productivity analysis

3. **Consider future features** (v0.3.0):
   - Write operations (create/update tasks)
   - AI-powered task suggestions
   - Cross-integration with calendar/email

---

**Deployment Status**:
- ✅ Worker deployed with encryption salt endpoint
- ✅ MCP server built with decryption support
- ⏳ Awaiting user testing with fresh token + passphrase

**Files Modified**:
- `worker/src/index.ts` - Added GET `/api/auth/encryption-salt`
- `packages/mcp-server/src/crypto.ts` - Encryption implementation
- `packages/mcp-server/src/tools.ts` - Decryption tools
- `packages/mcp-server/src/index.ts` - Tool registration

**Documentation**:
- `MCP_V0.2_SUMMARY.md` - Feature summary
- `DECRYPTION.md` - Security documentation
- `TESTING_V0.2.md` - This testing guide
