import { getSyncStatus, listTasks, type GsdConfig } from '../../tools.js';

/**
 * System tool handlers for configuration validation and help
 */

export async function handleValidateConfig(config: GsdConfig) {
  const checks: Array<{
    name: string;
    status: 'success' | 'warning' | 'error';
    details: string;
  }> = [];

  // Check API connectivity
  try {
    const response = await fetch(`${config.apiBaseUrl}/health`);
    if (response.ok) {
      checks.push({
        name: 'API Connectivity',
        status: 'success',
        details: `Connected to ${config.apiBaseUrl}`,
      });
    } else {
      checks.push({
        name: 'API Connectivity',
        status: 'warning',
        details: `Connected but got status ${response.status}`,
      });
    }
  } catch (error) {
    checks.push({
      name: 'API Connectivity',
      status: 'error',
      details: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Check authentication
  try {
    const status = await getSyncStatus(config);
    checks.push({
      name: 'Authentication',
      status: 'success',
      details: `Token valid (${status.deviceCount} devices registered)`,
    });
  } catch (error) {
    checks.push({
      name: 'Authentication',
      status: 'error',
      details: error instanceof Error ? error.message : 'Token validation failed',
    });
  }

  // Check encryption (if passphrase provided)
  if (config.encryptionPassphrase) {
    try {
      const tasks = await listTasks(config);
      checks.push({
        name: 'Encryption',
        status: 'success',
        details: `Successfully decrypted ${tasks.length} tasks`,
      });
    } catch (error) {
      checks.push({
        name: 'Encryption',
        status: 'error',
        details: error instanceof Error ? error.message : 'Decryption failed',
      });
    }
  } else {
    checks.push({
      name: 'Encryption',
      status: 'warning',
      details: 'Passphrase not provided (task content not accessible)',
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ checks }, null, 2),
      },
    ],
  };
}

export async function handleGetHelp(args: { topic?: string }) {
  const { topic } = args;
  let helpText = '';

  if (!topic || topic === 'tools') {
    helpText += `# GSD Task Manager MCP Server - Help

## Available Tools (18 total)

### Metadata & Status Tools
- **get_sync_status** - Check sync health, device count, storage usage
- **list_devices** - View all registered devices and their status
- **get_task_stats** - Get high-level task statistics (metadata only)

### Task Access Tools (require encryption passphrase)
- **list_tasks** - List all tasks with optional filtering (quadrant, status, tags)
- **get_task** - Get a single task by ID
- **search_tasks** - Search across titles, descriptions, tags, subtasks

### Analytics Tools (require encryption passphrase)
- **get_productivity_metrics** - Comprehensive metrics (completions, streaks, rates)
- **get_quadrant_analysis** - Performance breakdown across all 4 quadrants
- **get_tag_analytics** - Tag usage statistics and completion rates
- **get_upcoming_deadlines** - Overdue, due today, and due this week tasks
- **get_task_insights** - AI-friendly summary of key metrics

### Write Tools (require encryption passphrase)
- **create_task** - Create a new task with full properties
- **update_task** - Update an existing task (partial updates supported)
- **complete_task** - Quick toggle for task completion status
- **delete_task** - Permanently delete a task
- **bulk_update_tasks** - Update multiple tasks at once (max 50)

### Configuration Tools
- **validate_config** - Diagnose configuration issues
- **get_help** - This help message (supports topic filtering)

`;
  }

  if (!topic || topic === 'analytics') {
    helpText += `## Analytics Capabilities

The MCP server provides rich productivity analytics:

**Productivity Metrics:**
- Completion counts (today, this week, this month)
- Active and longest completion streaks
- Overall completion rate percentage
- Quadrant distribution of active tasks
- Tag-based statistics
- Due date tracking (overdue, today, this week, no due date)

**Quadrant Analysis:**
- Completion rates per quadrant
- Task counts (total, completed, active) per quadrant
- Performance ranking to identify top quadrants

**Tag Analytics:**
- Usage counts per tag
- Completion rates per tag
- Identification of high/low performing tags

**Deadline Management:**
- Overdue tasks grouped and sorted
- Tasks due today
- Tasks due within the next week
- Dependency tracking for blocked tasks

`;
  }

  if (!topic || topic === 'setup') {
    helpText += `## Setup & Configuration

**First-time Setup:**
\`\`\`bash
npx gsd-mcp-server --setup
\`\`\`

The interactive wizard will:
1. Test API connectivity
2. Validate your auth token
3. Test encryption passphrase (optional)
4. Generate Claude Desktop config

**Validate Existing Config:**
\`\`\`bash
npx gsd-mcp-server --validate
\`\`\`

**Configuration Requirements:**
- GSD_API_URL - Worker API endpoint
- GSD_AUTH_TOKEN - JWT from OAuth login (7-day expiration)
- GSD_ENCRYPTION_PASSPHRASE - (Optional) For decrypted task access

**Claude Desktop Config Location:**
- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
- Windows: %APPDATA%\\Claude\\claude_desktop_config.json

`;
  }

  if (!topic || topic === 'examples') {
    helpText += `## Usage Examples

**Daily Workflow:**
- "What tasks are due today?"
- "Show me overdue tasks"
- "What's my completion streak?"
- "Give me a daily standup report"

**Analytics:**
- "What's my productivity this week?"
- "Which quadrant has the most tasks?"
- "Show me tag completion rates"
- "Analyze my task distribution"

**Task Management:**
- "List all urgent and important tasks"
- "Search for tasks about quarterly report"
- "Show me tasks tagged #work"
- "Find tasks with dependencies"

**Write Operations:**
- "Create a task: Review quarterly budget"
- "Mark task abc123 as complete"
- "Delete task xyz789"
- "Update task abc123 to be urgent"

**Configuration:**
- "Validate my MCP configuration"
- "Check if my setup is working"
- "Diagnose any issues"

**Pro Tip:** Use the built-in prompts for common workflows:
- daily-standup
- weekly-review
- focus-mode
- upcoming-deadlines
- productivity-report
- tag-analysis

`;
  }

  if (!topic || topic === 'troubleshooting') {
    helpText += `## Troubleshooting

**"Configuration error" on startup:**
- Run: \`npx gsd-mcp-server --setup\`
- Ensure GSD_API_URL and GSD_AUTH_TOKEN are set

**"Authentication failed (401)":**
- Your token has expired (7-day lifetime)
- Get new token: Visit GSD app → DevTools → Local Storage → gsd_auth_token
- Update Claude Desktop config → Restart Claude

**"Encryption passphrase not provided":**
- Add GSD_ENCRYPTION_PASSPHRASE to Claude Desktop config
- Must match passphrase set in GSD app
- Restart Claude Desktop

**"Failed to connect":**
- Check internet connection
- Verify GSD_API_URL is correct
- Ensure Worker is deployed and accessible

**Decryption failures:**
- Verify passphrase is correct (case-sensitive)
- Ensure encryption is set up in GSD app (Settings → Sync)
- Try fetching new encryption salt

**For more help:**
- Run: \`npx gsd-mcp-server --validate\`
- Check logs in Claude Desktop
- GitHub: https://github.com/vscarpenter/gsd-taskmanager/issues

`;
  }

  if (!topic) {
    helpText += `## Additional Resources

- **Full Documentation:** https://github.com/vscarpenter/gsd-taskmanager/tree/main/packages/mcp-server
- **Setup Guide:** Run \`npx gsd-mcp-server --setup\`
- **Validation:** Run \`npx gsd-mcp-server --validate\`
- **Issues/Support:** https://github.com/vscarpenter/gsd-taskmanager/issues

**Version:** 0.5.0
**Status:** Production-ready
**Privacy:** End-to-end encrypted, zero-knowledge server
**Capabilities:** Full task management (create, read, update, delete)
`;
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: helpText.trim(),
      },
    ],
  };
}
