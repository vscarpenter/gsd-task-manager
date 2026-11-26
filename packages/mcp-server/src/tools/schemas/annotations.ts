import type { ToolAnnotations } from '@modelcontextprotocol/server';

/**
 * Hints a client can show the user or act on, such as asking before a
 * destructive call (tasks/spec.md, "Move the MCP server to SDK v2", AC8).
 * Every GSD tool reaches only the user's own account, so none is open-world.
 */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

export const NON_DESTRUCTIVE_WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

export const DESTRUCTIVE_WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
};
