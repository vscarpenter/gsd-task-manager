import { Server } from '@modelcontextprotocol/server';
import { allTools } from '../tools/schemas/index.js';
import { allPrompts, getPromptMessage } from '../tools/prompts.js';
import { handleToolCall } from '../tools/handlers/index.js';
import { VERSION } from '../version.js';
import type { GsdConfig } from '../tools.js';
import { SERVER_INSTRUCTIONS } from './instructions.js';

// The lists and the server's identity change only with a release, so any
// cache may keep them for ten minutes. The SDK sends these on 2026-07-28 only.
const PUBLIC_CACHE_HINT = { ttlMs: 600_000, cacheScope: 'public' } as const;

export function createServer(): Server {
  return new Server(
    {
      name: 'gsd-task-manager',
      version: VERSION,
      title: 'GSD Task Manager',
      description: 'Eisenhower-matrix tasks from your GSD account',
      websiteUrl: 'https://gsd.vinny.dev',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
      instructions: SERVER_INSTRUCTIONS,
      cacheHints: {
        'tools/list': PUBLIC_CACHE_HINT,
        'prompts/list': PUBLIC_CACHE_HINT,
        'server/discover': PUBLIC_CACHE_HINT,
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

/** The server each connection gets: GSD's capabilities with every handler registered. */
export function createGsdServer(config: GsdConfig): Server {
  const server = createServer();
  registerHandlers(server, config);
  return server;
}
