/**
 * Tool schema definitions for the GSD MCP Server
 * Organized by functionality: read, write, analytics, and system tools
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { readTools } from './read-tools.js';
import { writeTools } from './write-tools.js';
import { analyticsTools } from './analytics-tools.js';
import { systemTools } from './system-tools.js';

// Re-export individual tool categories
export * from './read-tools.js';
export * from './write-tools.js';
export * from './analytics-tools.js';
export * from './system-tools.js';

/**
 * All MCP tool schemas (16 total)
 */
export const allTools: Tool[] = [
  ...readTools,      // 6 tools
  ...analyticsTools, // 5 tools
  ...writeTools,     // 5 tools
  ...systemTools,    // 2 tools
];
