/**
 * Shared types for MCP tool handlers
 */

/** Standard return type for all MCP tool handler functions */
export type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};
