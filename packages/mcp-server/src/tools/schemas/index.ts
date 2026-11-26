import type { Tool } from '@modelcontextprotocol/server';
import { readTools } from './read-tools.js';
import { writeTools } from './write-tools.js';
import { analyticsTools } from './analytics-tools.js';
import { systemTools } from './system-tools.js';

export * from './read-tools.js';
export * from './write-tools.js';
export * from './analytics-tools.js';
export * from './system-tools.js';

export const allTools: Tool[] = [
  ...readTools,
  ...analyticsTools,
  ...writeTools,
  ...systemTools,
];
