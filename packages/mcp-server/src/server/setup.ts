import { McpServer } from '@modelcontextprotocol/server';
import type { SkillsExtension } from '@modelcontextprotocol/server/ext/skills';
import { allTools } from '../tools/schemas/index.js';
import { allPrompts, getPromptMessage } from '../tools/prompts.js';
import { handleToolCall } from '../tools/handlers/index.js';
import { DELETE_CONFIRMATION_STATE, deleteConfirmationFor } from '../tools/handlers/delete-confirmation.js';
import { VERSION } from '../version.js';
import type { GsdConfig } from '../tools.js';
import { SERVER_INSTRUCTIONS } from './instructions.js';

// The lists and the server's identity change only with a release, so any
// cache may keep them for ten minutes. The SDK sends these on 2026-07-28 only.
const PUBLIC_CACHE_HINT = { ttlMs: 600_000, cacheScope: 'public' } as const;

// An McpServer, because SkillsExtension.attach() needs one (ADR 0024).
export function createServer(): McpServer {
  const mcp = new McpServer(
    {
      name: 'gsd-task-manager',
      version: VERSION,
      title: 'GSD Task Manager',
      description: 'Eisenhower-matrix tasks from your GSD account',
      websiteUrl: 'https://gsd.vinny.dev',
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      requestState: DELETE_CONFIRMATION_STATE,
      cacheHints: {
        'tools/list': PUBLIC_CACHE_HINT,
        'prompts/list': PUBLIC_CACHE_HINT,
        'server/discover': PUBLIC_CACHE_HINT,
      },
    }
  );
  // Declared on the low-level server, not in the constructor, so McpServer
  // installs no tools or prompts handlers of its own and GSD's below keep the
  // v1.5.0 schemas.
  mcp.server.registerCapabilities({ tools: {}, prompts: {} });
  return mcp;
}

export function registerHandlers(mcp: McpServer, config: GsdConfig): void {
  const { server } = mcp;
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

  server.setRequestHandler('tools/call', async (request, ctx) => {
    const { name, arguments: args } = request.params;
    // A 2025 connection declared its capabilities at initialize, and the SDK
    // documents this accessor as their source there.
    const confirmation = deleteConfirmationFor(ctx, () => server.getClientCapabilities());
    return handleToolCall(name, args || {}, config, confirmation);
  });
}

/** The server each connection gets: GSD's capabilities, every handler, and the skills when they loaded. */
export function createGsdServer(config: GsdConfig, skills?: SkillsExtension): McpServer {
  const mcp = createServer();
  registerHandlers(mcp, config);
  skills?.attach(mcp);
  return mcp;
}
