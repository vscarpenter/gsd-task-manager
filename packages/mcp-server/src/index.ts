#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
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
];

async function main() {
  // Load configuration from environment
  let config: GsdConfig;
  try {
    config = configSchema.parse({
      apiBaseUrl: process.env.GSD_API_URL,
      authToken: process.env.GSD_AUTH_TOKEN,
      encryptionPassphrase: process.env.GSD_ENCRYPTION_PASSPHRASE,
    });
  } catch (error) {
    console.error('Configuration error:', error);
    console.error('\nRequired environment variables:');
    console.error('  GSD_API_URL - Base URL of your GSD Worker API (e.g., https://sync.gsd.vinny.dev)');
    console.error('  GSD_AUTH_TOKEN - JWT token from OAuth authentication');
    console.error('\nOptional environment variables:');
    console.error('  GSD_ENCRYPTION_PASSPHRASE - Your encryption passphrase (enables decrypted task access)');
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'gsd-task-manager',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool list requests
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
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
