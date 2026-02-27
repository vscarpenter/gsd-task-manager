import { getSyncStatus, listTasks, type GsdConfig } from '../../tools.js';
import { getTaskCache } from '../../cache.js';
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

  // Check Supabase connectivity
  try {
    const status = await getSyncStatus(config);
    checks.push({
      name: 'Supabase Connectivity',
      status: 'success',
      details: `Connected to ${config.supabaseUrl} (${status.deviceCount} devices)`,
    });
  } catch (error) {
    checks.push({
      name: 'Supabase Connectivity',
      status: 'error',
      details: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // Check user resolution
  try {
    const { resolveUserId } = await import('../../api/client.js');
    const userId = await resolveUserId(config);
    checks.push({
      name: 'User Resolution',
      status: 'success',
      details: `User found: ${config.userEmail} (${userId.slice(0, 8)}...)`,
    });
  } catch (error) {
    checks.push({
      name: 'User Resolution',
      status: 'error',
      details: error instanceof Error ? error.message : 'User lookup failed',
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

// ---------------------------------------------------------------------------
// Help section builders — each returns a Markdown string for its topic.
// Extracted to keep handleGetHelp() within the 30-line function guideline.
// ---------------------------------------------------------------------------

function buildToolsHelpSection(): string {
  return `# GSD Task Manager MCP Server - Help

## Available Tools (19 total)

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

### Configuration & System Tools
- **validate_config** - Diagnose configuration issues
- **get_help** - This help message (supports topic filtering)
- **get_cache_stats** - View cache performance statistics

`;
}

function buildAnalyticsHelpSection(): string {
  return `## Analytics Capabilities

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

function buildSetupHelpSection(): string {
  return `## Setup & Configuration

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
- GSD_SUPABASE_URL - Supabase project URL
- GSD_SUPABASE_SERVICE_KEY - Service role key
- GSD_USER_EMAIL - Your GSD account email
- GSD_ENCRYPTION_PASSPHRASE - (Optional) For decrypted task access

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

function buildTroubleshootingHelpSection(): string {
  return `## Troubleshooting

**"Configuration error" on startup:**
- Run: \`npx gsd-mcp-server --setup\`
- Ensure GSD_SUPABASE_URL, GSD_SUPABASE_SERVICE_KEY, and GSD_USER_EMAIL are set

**"User not found":**
- Verify GSD_USER_EMAIL matches your GSD app login email
- Ensure you've signed into the GSD app at least once

**"Encryption passphrase not provided":**
- Add GSD_ENCRYPTION_PASSPHRASE to Claude Desktop config
- Must match passphrase set in GSD app
- Restart Claude Desktop

**"Failed to connect":**
- Check internet connection
- Verify GSD_SUPABASE_URL points to your Supabase project
- Verify GSD_SUPABASE_SERVICE_KEY is the service role key (not anon key)

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

function buildAdditionalResourcesSection(): string {
  return `## Additional Resources

- **Full Documentation:** https://github.com/vscarpenter/gsd-taskmanager/tree/main/packages/mcp-server
- **Setup Guide:** Run \`npx gsd-mcp-server --setup\`
- **Validation:** Run \`npx gsd-mcp-server --validate\`
- **Issues/Support:** https://github.com/vscarpenter/gsd-taskmanager/issues

**Version:** 0.6.0
**Status:** Production-ready
**Privacy:** End-to-end encrypted, zero-knowledge server
**Capabilities:** Full task management (create, read, update, delete)
`;
}

/** Topic → section builder map for O(1) lookup */
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

  // No topic (or unknown topic) — return all sections
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
 * Returns task cache statistics for performance monitoring
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
      'Hit rate improves with repeated read operations',
    ],
  };

  // Reset stats if requested
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
