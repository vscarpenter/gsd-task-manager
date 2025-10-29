import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * System tool schemas for configuration validation and help
 */

export const validateConfigTool: Tool = {
  name: 'validate_config',
  description:
    'Validate MCP server configuration and diagnose issues. Checks environment variables, API connectivity, authentication, encryption, and sync status. Returns detailed diagnostics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getHelpTool: Tool = {
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
};

export const systemTools: Tool[] = [
  validateConfigTool,
  getHelpTool,
];
