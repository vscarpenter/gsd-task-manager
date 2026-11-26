import { Server } from '@modelcontextprotocol/server';
import { allTools } from '../tools/schemas/index.js';
import { allPrompts, getPromptMessage } from '../tools/prompts.js';
import { handleToolCall } from '../tools/handlers/index.js';
import { VERSION } from '../version.js';
import type { GsdConfig } from '../tools.js';

export function createServer(): Server {
  return new Server(
    {
      name: 'gsd-task-manager',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );
}

export function registerHandlers(server: Server, config: GsdConfig): void {
  server.setRequestHandler('tools/list', async () => {
    return { tools: allTools };
  });

  server.setRequestHandler('prompts/list', async () => {
    return { prompts: allPrompts };
  });

  server.setRequestHandler('prompts/get', async (request) => {
    const { name } = request.params;
    const message = getPromptMessage(name);
    return {
      messages: [message],
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args || {}, config);
  });
}
