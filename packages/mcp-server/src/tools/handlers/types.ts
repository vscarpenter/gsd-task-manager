import type { InputRequiredResult } from '@modelcontextprotocol/server';

export type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** A tool's reply, or a request for the user's input that has to come first. */
export type ToolCallResult = McpToolResponse | InputRequiredResult;
