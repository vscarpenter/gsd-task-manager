#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  getSyncStatus,
  listDevices,
  getTaskStats,
  listTasks,
  getTask,
  searchTasks,
  type GsdConfig,
} from './tools.js';
import {
  calculateMetrics,
  getQuadrantPerformance,
  getUpcomingDeadlines,
  generateInsightsSummary,
} from './analytics.js';
import { parseCLIArgs, showHelp, runSetupWizard, runValidation } from './cli.js';
import {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  bulkUpdateTasks,
  type CreateTaskInput,
  type UpdateTaskInput,
  type BulkOperation,
} from './write-ops.js';

// Configuration schema
const configSchema = z.object({
  apiBaseUrl: z.string().url(),
  authToken: z.string().min(1),
  encryptionPassphrase: z.string().optional(), // Optional: for decrypting tasks
});

// Tool definitions
const tools: Tool[] = [
  {
    name: 'get_sync_status',
    description:
      'Get sync status for GSD tasks including last sync time, device count, storage usage, and conflict count. Useful for checking overall sync health.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_devices',
    description:
      'List all registered devices for the authenticated user. Shows device names, last seen timestamps, and active status. Useful for managing connected devices.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_task_stats',
    description:
      'Get statistics about tasks including total count, active count, deleted count, and last update timestamp. Provides high-level overview without accessing encrypted task content.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_tasks',
    description:
      'List all decrypted tasks. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Returns full task details including titles, descriptions, quadrants, tags, subtasks, and dependencies. Optionally filter by quadrant, completion status, or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        quadrant: {
          type: 'string',
          description:
            'Filter by quadrant ID (urgent-important, not-urgent-important, urgent-not-important, not-urgent-not-important)',
          enum: [
            'urgent-important',
            'not-urgent-important',
            'urgent-not-important',
            'not-urgent-not-important',
          ],
        },
        completed: {
          type: 'boolean',
          description: 'Filter by completion status (true for completed, false for active)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (tasks matching any of these tags will be returned)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_task',
    description:
      'Get a single decrypted task by ID. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Returns full task details.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The unique ID of the task to retrieve',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'search_tasks',
    description:
      'Search decrypted tasks by text query. Requires GSD_ENCRYPTION_PASSPHRASE to be set. Searches across task titles, descriptions, tags, and subtask text. Returns matching tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against task content',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_productivity_metrics',
    description:
      'Get comprehensive productivity metrics including completion counts, streaks, rates, quadrant distribution, tag statistics, and due date tracking. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_quadrant_analysis',
    description:
      'Analyze task distribution and performance across all four Eisenhower matrix quadrants. Shows completion rates, task counts, and identifies top-performing quadrants. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_tag_analytics',
    description:
      'Get detailed statistics for all tags including usage counts, completion rates, and tag-based insights. Useful for understanding project/category performance. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of tags to return (default: all)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_upcoming_deadlines',
    description:
      'Get tasks grouped by deadline urgency: overdue, due today, and due this week. Useful for prioritizing time-sensitive work. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_task_insights',
    description:
      'Generate an AI-friendly summary of task insights including key metrics, streaks, deadlines, quadrant distribution, and top tags. Perfect for quick status overview. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'validate_config',
    description:
      'Validate MCP server configuration and diagnose issues. Checks environment variables, API connectivity, authentication, encryption, and sync status. Returns detailed diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_help',
    description:
      'Get comprehensive help documentation including available tools, usage examples, common queries, and troubleshooting tips. Perfect for discovering what the GSD MCP server can do.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Optional help topic: "tools", "analytics", "setup", "examples", or "troubleshooting"',
          enum: ['tools', 'analytics', 'setup', 'examples', 'troubleshooting'],
        },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description:
      'Create a new task with natural language input. Supports all task properties including title, description, urgency, importance, due dates, tags, subtasks, recurrence, and dependencies. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title (required)',
        },
        description: {
          type: 'string',
          description: 'Task description',
        },
        urgent: {
          type: 'boolean',
          description: 'Is this task urgent? (time-sensitive)',
        },
        important: {
          type: 'boolean',
          description: 'Is this task important? (high-value, strategic)',
        },
        dueDate: {
          type: 'number',
          description: 'Due date as Unix timestamp (milliseconds)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization (e.g., ["#work", "#project-alpha"])',
        },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              completed: { type: 'boolean' },
            },
            required: ['text', 'completed'],
          },
          description: 'Subtasks/checklist items',
        },
        recurrence: {
          type: 'string',
          enum: ['none', 'daily', 'weekly', 'monthly'],
          description: 'Recurrence pattern',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs that must be completed before this task',
        },
      },
      required: ['title', 'urgent', 'important'],
    },
  },
  {
    name: 'update_task',
    description:
      'Update an existing task. All fields except ID are optional - only provide fields you want to change. Supports moving between quadrants, updating content, changing due dates, and more. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID (required)',
        },
        title: {
          type: 'string',
          description: 'New task title',
        },
        description: {
          type: 'string',
          description: 'New task description',
        },
        urgent: {
          type: 'boolean',
          description: 'Change urgency (moves between quadrants)',
        },
        important: {
          type: 'boolean',
          description: 'Change importance (moves between quadrants)',
        },
        dueDate: {
          type: 'number',
          description: 'New due date as Unix timestamp (null to clear)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace tags entirely',
        },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              completed: { type: 'boolean' },
            },
            required: ['id', 'text', 'completed'],
          },
          description: 'Replace subtasks entirely',
        },
        recurrence: {
          type: 'string',
          enum: ['none', 'daily', 'weekly', 'monthly'],
          description: 'Change recurrence pattern',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace dependencies entirely',
        },
        completed: {
          type: 'boolean',
          description: 'Mark as complete/incomplete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_task',
    description:
      'Mark a task as complete or incomplete. Quick shortcut for updating completion status. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID',
        },
        completed: {
          type: 'boolean',
          description: 'True to mark complete, false to mark incomplete',
        },
      },
      required: ['id', 'completed'],
    },
  },
  {
    name: 'delete_task',
    description:
      'Permanently delete a task. This action cannot be undone. Use with caution. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'bulk_update_tasks',
    description:
      'Update multiple tasks at once. Supports completing, moving quadrants, adding/removing tags, setting due dates, and deleting. Limited to 50 tasks per operation for safety. Requires GSD_ENCRYPTION_PASSPHRASE.',
    inputSchema: {
      type: 'object',
      properties: {
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of task IDs to update (max 50)',
        },
        operation: {
          type: 'object',
          description: 'Operation to perform on all tasks',
          properties: {
            type: {
              type: 'string',
              enum: ['complete', 'move_quadrant', 'add_tags', 'remove_tags', 'set_due_date', 'delete'],
              description: 'Type of bulk operation',
            },
            // Conditional properties based on type
            completed: {
              type: 'boolean',
              description: 'For type=complete: true/false',
            },
            urgent: {
              type: 'boolean',
              description: 'For type=move_quadrant: urgency',
            },
            important: {
              type: 'boolean',
              description: 'For type=move_quadrant: importance',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'For type=add_tags or remove_tags: array of tags',
            },
            dueDate: {
              type: 'number',
              description: 'For type=set_due_date: Unix timestamp (null to clear)',
            },
          },
          required: ['type'],
        },
        maxTasks: {
          type: 'number',
          description: 'Safety limit (default: 50)',
        },
      },
      required: ['taskIds', 'operation'],
    },
  },
];

// Prompt definitions for common workflows
const prompts: Prompt[] = [
  {
    name: 'daily-standup',
    description: 'Daily task review: today\'s tasks, overdue items, and productivity summary',
    arguments: [],
  },
  {
    name: 'weekly-review',
    description: 'Weekly productivity analysis: completion stats, trends, and top quadrants',
    arguments: [],
  },
  {
    name: 'focus-mode',
    description: 'Get urgent and important tasks (Q1: Do First) to focus on right now',
    arguments: [],
  },
  {
    name: 'upcoming-deadlines',
    description: 'Show all overdue tasks, tasks due today, and tasks due this week',
    arguments: [],
  },
  {
    name: 'productivity-report',
    description: 'Comprehensive productivity report with metrics, streaks, and insights',
    arguments: [],
  },
  {
    name: 'tag-analysis',
    description: 'Analyze task distribution and completion rates by tags/projects',
    arguments: [],
  },
];

async function main() {
  // Parse CLI arguments
  const options = parseCLIArgs(process.argv);

  // Handle CLI modes
  if (options.mode === 'help') {
    showHelp();
    process.exit(0);
  }

  if (options.mode === 'setup') {
    await runSetupWizard();
    process.exit(0);
  }

  if (options.mode === 'validate') {
    await runValidation();
    process.exit(0);
  }

  // MCP mode: Load configuration from environment
  let config: GsdConfig;
  try {
    config = configSchema.parse({
      apiBaseUrl: process.env.GSD_API_URL,
      authToken: process.env.GSD_AUTH_TOKEN,
      encryptionPassphrase: process.env.GSD_ENCRYPTION_PASSPHRASE,
    });
  } catch (error) {
    console.error('❌ Configuration error:', error);
    console.error('\nRequired environment variables:');
    console.error('  GSD_API_URL - Base URL of your GSD Worker API (e.g., https://gsd.vinny.dev)');
    console.error('  GSD_AUTH_TOKEN - JWT token from OAuth authentication');
    console.error('\nOptional environment variables:');
    console.error('  GSD_ENCRYPTION_PASSPHRASE - Your encryption passphrase (enables decrypted task access)');
    console.error('\n💡 Tip: Run setup wizard with: npx gsd-mcp-server --setup');
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'gsd-task-manager',
      version: '0.4.3',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // Handle tool list requests
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle prompt list requests
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts };
  });

  // Handle prompt execution
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
      case 'daily-standup':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Give me a daily standup report:\n\n1. Show tasks due today\n2. Show overdue tasks\n3. Show tasks I completed today\n4. Give me a quick productivity summary\n\nMake it concise and actionable.',
              },
            },
          ],
        };

      case 'weekly-review':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Give me a weekly productivity review:\n\n1. Tasks completed this week vs last week\n2. Current streak status\n3. Quadrant distribution analysis\n4. Top tags and their completion rates\n5. Key insights and recommendations\n\nFormat as a professional status report.',
              },
            },
          ],
        };

      case 'focus-mode':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Help me focus right now:\n\n1. List all urgent AND important tasks (Q1: Do First quadrant)\n2. Prioritize by due date (overdue first, then soonest)\n3. Highlight any blocking dependencies\n4. Suggest which task to start with\n\nKeep it brief - I need to get to work!',
              },
            },
          ],
        };

      case 'upcoming-deadlines':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Show me all upcoming deadlines:\n\n1. Overdue tasks (most urgent)\n2. Tasks due today\n3. Tasks due this week\n\nFor each group, show task titles and how overdue/soon they are. Flag any that have dependencies.',
              },
            },
          ],
        };

      case 'productivity-report':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Generate a comprehensive productivity report:\n\n1. Overall task statistics (active, completed, total)\n2. Completion metrics (today, this week, this month)\n3. Streak analysis (current and longest)\n4. Quadrant performance breakdown\n5. Tag-based insights\n6. Upcoming deadlines summary\n7. Key recommendations for improvement\n\nFormat as an executive summary with key takeaways.',
              },
            },
          ],
        };

      case 'tag-analysis':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Analyze my tasks by tags:\n\n1. List all tags with task counts\n2. Show completion rates for each tag\n3. Identify high-performing and low-performing tags\n4. Suggest which projects/areas need attention\n5. Highlight any patterns (e.g., work tags vs personal tags)\n\nHelp me understand where my time is going.',
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_sync_status': {
          const status = await getSyncStatus(config);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        }

        case 'list_devices': {
          const devices = await listDevices(config);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(devices, null, 2),
              },
            ],
          };
        }

        case 'get_task_stats': {
          const stats = await getTaskStats(config);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        }

        case 'list_tasks': {
          const filters = args as {
            quadrant?: string;
            completed?: boolean;
            tags?: string[];
          };
          const tasks = await listTasks(config, filters);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        case 'get_task': {
          const { taskId } = args as { taskId: string };
          const task = await getTask(config, taskId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(task, null, 2),
              },
            ],
          };
        }

        case 'search_tasks': {
          const { query } = args as { query: string };
          const tasks = await searchTasks(config, query);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        case 'get_productivity_metrics': {
          const tasks = await listTasks(config);
          const metrics = calculateMetrics(tasks);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(metrics, null, 2),
              },
            ],
          };
        }

        case 'get_quadrant_analysis': {
          const tasks = await listTasks(config);
          const quadrants = getQuadrantPerformance(tasks);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(quadrants, null, 2),
              },
            ],
          };
        }

        case 'get_tag_analytics': {
          const { limit } = (args as { limit?: number }) || {};
          const tasks = await listTasks(config);
          const metrics = calculateMetrics(tasks);
          const tagStats = limit ? metrics.tagStats.slice(0, limit) : metrics.tagStats;
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tagStats, null, 2),
              },
            ],
          };
        }

        case 'get_upcoming_deadlines': {
          const tasks = await listTasks(config);
          const deadlines = getUpcomingDeadlines(tasks);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deadlines, null, 2),
              },
            ],
          };
        }

        case 'get_task_insights': {
          const tasks = await listTasks(config);
          const insights = generateInsightsSummary(tasks);
          return {
            content: [
              {
                type: 'text',
                text: insights,
              },
            ],
          };
        }

        case 'validate_config': {
          // Run validation and return results as JSON
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
                type: 'text',
                text: JSON.stringify({ checks }, null, 2),
              },
            ],
          };
        }

        case 'get_help': {
          const { topic } = (args as { topic?: string }) || {};
          let helpText = '';

          if (!topic || topic === 'tools') {
            helpText += `# GSD Task Manager MCP Server - Help

## Available Tools (13 total)

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

**Version:** 0.4.0
**Status:** Production-ready
**Privacy:** End-to-end encrypted, zero-knowledge server
**Capabilities:** Full task management (create, read, update, delete)
`;
          }

          return {
            content: [
              {
                type: 'text',
                text: helpText.trim(),
              },
            ],
          };
        }

        case 'create_task': {
          const input = args as unknown as CreateTaskInput;
          const newTask = await createTask(config, input);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Task created successfully!\n\n${JSON.stringify(newTask, null, 2)}`,
              },
            ],
          };
        }

        case 'update_task': {
          const input = args as unknown as UpdateTaskInput;
          const updatedTask = await updateTask(config, input);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Task updated successfully!\n\n${JSON.stringify(updatedTask, null, 2)}`,
              },
            ],
          };
        }

        case 'complete_task': {
          const { id, completed } = args as { id: string; completed: boolean };
          const updatedTask = await completeTask(config, id, completed);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Task marked as ${completed ? 'complete' : 'incomplete'}!\n\n${JSON.stringify(updatedTask, null, 2)}`,
              },
            ],
          };
        }

        case 'delete_task': {
          const { id } = args as { id: string };
          await deleteTask(config, id);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Task deleted successfully!\n\nTask ID: ${id}`,
              },
            ],
          };
        }

        case 'bulk_update_tasks': {
          const { taskIds, operation, maxTasks } = args as {
            taskIds: string[];
            operation: BulkOperation;
            maxTasks?: number;
          };
          const result = await bulkUpdateTasks(config, taskIds, operation, { maxTasks });

          let message = `✅ Bulk operation completed!\n\n`;
          message += `Updated: ${result.updated} task(s)\n`;
          if (result.errors.length > 0) {
            message += `\nErrors (${result.errors.length}):\n`;
            result.errors.forEach((err, idx) => {
              message += `${idx + 1}. ${err}\n`;
            });
          }

          return {
            content: [
              {
                type: 'text',
                text: message,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('GSD MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
