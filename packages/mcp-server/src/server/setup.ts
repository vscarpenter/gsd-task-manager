import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { allTools } from '../tools/schemas/index.js';
import { allPrompts, getPromptMessage } from '../tools/prompts.js';
import { handleToolCall } from '../tools/handlers/index.js';
import type { GsdConfig } from '../tools.js';

/**
 * Create and configure the MCP server instance
 */
export function createServer(): Server {
  return new Server(
    {
      name: 'gsd-task-manager',
      version: '0.5.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );
}

/**
 * Register all request handlers with the MCP server
 */
export function registerHandlers(server: Server, config: GsdConfig): void {
  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  // Register prompt list handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: allPrompts };
  });

  // Register prompt execution handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const message = getPromptMessage(name);
    return {
      messages: [message],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args || {}, config);
  });
}
