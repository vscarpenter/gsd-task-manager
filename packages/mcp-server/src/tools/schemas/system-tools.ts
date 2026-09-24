import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * System tool schemas for configuration validation and help
 */

export const validateConfigTool: Tool = {
  name: 'validate_config',
  description:
    'Validate MCP server configuration and diagnose issues. Checks environment variables, PocketBase connectivity, authentication, and sync status. Returns detailed diagnostics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getHelpTool: Tool = {
  name: 'get_help',
  description:
    'Get help documentation for this server: the tool list, analytics capabilities, setup, example queries, and troubleshooting. Pass topic to return one section; omit it for all sections.',
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
};

export const getCacheStatsTool: Tool = {
  name: 'get_cache_stats',
  description:
    'Get task cache statistics including hit rate, cache size, and TTL configuration. Useful for monitoring MCP server performance and debugging caching behavior.',
  inputSchema: {
    type: 'object',
    properties: {
      reset: {
        type: 'boolean',
        description: 'If true, reset cache statistics after retrieving them',
      },
    },
    required: [],
  },
};

export const systemTools: Tool[] = [
  validateConfigTool,
  getHelpTool,
  getCacheStatsTool,
];
