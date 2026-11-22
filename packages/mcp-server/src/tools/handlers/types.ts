export type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};
