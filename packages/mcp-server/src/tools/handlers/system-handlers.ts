import { getSyncStatus, listTasks, type GsdConfig } from '../../tools.js';
import { getTaskCache } from '../../cache.js';
import { getPocketBase } from '../../pocketbase-client.js';
import type { McpToolResponse } from './types.js';

/**
 * System tool handlers for configuration validation and help
 */

export async function handleValidateConfig(config: GsdConfig): Promise<McpToolResponse> {
  const checks: Array<{
    name: string;
    status: 'success' | 'warning' | 'error';
    details: string;
  }> = [];

  // Check PocketBase connectivity
  try {
    const pb = getPocketBase(config);
    await pb.health.check();
    checks.push({
      name: 'PocketBase Connectivity',
      status: 'success',
      details: `Connected to ${config.pocketBaseUrl}`,
    });
  } catch (error) {
    checks.push({
      name: 'PocketBase Connectivity',
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
      details: `Authenticated (${status.taskCount} tasks accessible)`,
    });
  } catch (error) {
    checks.push({
      name: 'Authentication',
      status: 'error',
      details: error instanceof Error ? error.message : 'Token validation failed',
    });
  }

  // Check task access
  try {
    const tasks = await listTasks(config);
    checks.push({
      name: 'Task Access',
      status: 'success',
      details: `Successfully fetched ${tasks.length} tasks`,
    });
  } catch (error) {
    checks.push({
      name: 'Task Access',
      status: 'error',
      details: error instanceof Error ? error.message : 'Failed to fetch tasks',
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

// ---------------------------------------------------------------------------
// Help section builders
// ---------------------------------------------------------------------------

function buildToolsHelpSection(): string {
  return `# GSD Task Manager MCP Server - Help

## Available Tools (20 total)

### Metadata & Status Tools
- **get_sync_status** - Check PocketBase health and task count
- **list_devices** - View all registered devices and their status
- **get_task_stats** - Get high-level task statistics

### Task Access Tools
- **list_tasks** - List all tasks with optional filtering (quadrant, status, tags)
- **get_task** - Get a single task by ID
- **search_tasks** - Search across titles, descriptions, tags, subtasks

### Analytics Tools
- **get_productivity_metrics** - Comprehensive metrics (completions, streaks, rates)
- **get_quadrant_analysis** - Performance breakdown across all 4 quadrants
- **get_tag_analytics** - Tag usage statistics and completion rates
- **get_upcoming_deadlines** - Overdue, due today, and due this week tasks
- **get_task_insights** - AI-friendly summary of key metrics

### Write Tools
- **create_task** - Create a new task with full properties
- **update_task** - Update an existing task (partial updates supported)
- **complete_task** - Quick toggle for task completion status
- **delete_task** - Permanently delete a task
- **bulk_update_tasks** - Update multiple tasks at once (max 50)

### Configuration & System Tools
- **validate_config** - Diagnose configuration issues
- **get_help** - This help message (supports topic filtering)
- **get_cache_stats** - View cache performance statistics
- **get_token_status** - Check auth token expiration status

`;
}

function buildSetupHelpSection(): string {
  return `## Setup & Configuration

**First-time Setup:**
\`\`\`bash
npx gsd-mcp-server --setup
\`\`\`

**Configuration Requirements:**
- GSD_POCKETBASE_URL - PocketBase server URL (e.g., https://api.vinny.io)
- GSD_AUTH_TOKEN - PocketBase auth token from browser session

**Claude Desktop Config Location:**
- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
- Windows: %APPDATA%\\Claude\\claude_desktop_config.json

`;
}

function buildExamplesHelpSection(): string {
  return `## Usage Examples

**Daily Workflow:**
- "What tasks are due today?"
- "Show me overdue tasks"
- "What's my completion streak?"
- "Give me a daily standup report"

**Task Management:**
- "List all urgent and important tasks"
- "Search for tasks about quarterly report"
- "Show me tasks tagged #work"

**Write Operations:**
- "Create a task: Review quarterly budget"
- "Mark task abc123 as complete"
- "Delete task xyz789"

`;
}

function buildTroubleshootingHelpSection(): string {
  return `## Troubleshooting

**"Configuration error" on startup:**
- Run: \`npx gsd-mcp-server --setup\`
- Ensure GSD_POCKETBASE_URL and GSD_AUTH_TOKEN are set

**"Authentication failed":**
- Your token may have expired
- Get a new token from the GSD app's sync settings
- Update Claude Desktop config → Restart Claude

**"Failed to connect":**
- Check internet connection
- Verify GSD_POCKETBASE_URL is correct
- Ensure PocketBase server is running

**For more help:**
- Run: \`npx gsd-mcp-server --validate\`
- GitHub: https://github.com/vscarpenter/gsd-taskmanager/issues

`;
}

function buildAnalyticsHelpSection(): string {
  return `## Analytics Capabilities

**Productivity Metrics:**
- Completion counts (today, this week, this month)
- Active and longest completion streaks
- Overall completion rate percentage
- Quadrant distribution of active tasks

**Tag Analytics:**
- Usage counts per tag
- Completion rates per tag

`;
}

function buildAdditionalResourcesSection(): string {
  return `## Additional Resources

- **Full Documentation:** https://github.com/vscarpenter/gsd-taskmanager/tree/main/packages/mcp-server
- **Setup Guide:** Run \`npx gsd-mcp-server --setup\`
- **Issues/Support:** https://github.com/vscarpenter/gsd-taskmanager/issues

**Version:** 1.0.0
**Backend:** PocketBase (self-hosted)
`;
}

const HELP_SECTIONS: Record<string, () => string> = {
  tools: buildToolsHelpSection,
  analytics: buildAnalyticsHelpSection,
  setup: buildSetupHelpSection,
  examples: buildExamplesHelpSection,
  troubleshooting: buildTroubleshootingHelpSection,
};

export async function handleGetHelp(args: { topic?: string }): Promise<McpToolResponse> {
  const { topic } = args;

  if (topic && HELP_SECTIONS[topic]) {
    return { content: [{ type: 'text' as const, text: HELP_SECTIONS[topic]().trim() }] };
  }

  const helpText = [
    buildToolsHelpSection(),
    buildAnalyticsHelpSection(),
    buildSetupHelpSection(),
    buildExamplesHelpSection(),
    buildTroubleshootingHelpSection(),
    buildAdditionalResourcesSection(),
  ].join('\n');

  return { content: [{ type: 'text' as const, text: helpText.trim() }] };
}

/**
 * Handle get_cache_stats tool
 */
export async function handleGetCacheStats(args: { reset?: boolean }): Promise<McpToolResponse> {
  const cache = getTaskCache();
  const stats = cache.getStats();

  const result: {
    performance: { hitRate: string; hits: number; misses: number };
    taskListCache: { currentSize: number; maxEntries: number; ttlSeconds: number };
    singleTaskCache: { currentSize: number; maxEntries: number; ttlSeconds: number };
    notes: string[];
    statsReset?: boolean;
  } = {
    performance: {
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      hits: stats.hits,
      misses: stats.misses,
    },
    taskListCache: {
      currentSize: stats.taskListCache.size,
      maxEntries: stats.taskListCache.maxEntries,
      ttlSeconds: stats.taskListCache.ttlMs / 1000,
    },
    singleTaskCache: {
      currentSize: stats.singleTaskCache.size,
      maxEntries: stats.singleTaskCache.maxEntries,
      ttlSeconds: stats.singleTaskCache.ttlMs / 1000,
    },
    notes: [
      'Cache is invalidated after every write operation',
      'TTL-based expiration ensures data freshness',
    ],
  };

  if (args.reset) {
    cache.resetStats();
    result.statsReset = true;
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
