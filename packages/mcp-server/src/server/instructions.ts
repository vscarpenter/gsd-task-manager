/**
 * The guidance a client hands its model before the first tool call
 * (tasks/spec.md, "Move the MCP server to SDK v2", AC7). Claude Code cuts
 * server instructions at 4,096 characters, and the spec caps them at 1,500.
 * Each sentence restates how the tools behave, so a change to one should
 * update the other.
 */
export const SERVER_INSTRUCTIONS = [
  "GSD Task Manager is the user's Eisenhower-matrix task list.",
  'Use these tools when the user asks about tasks, priorities, deadlines, or productivity.',
  "A task's quadrant comes from two booleans, urgent and important.",
  "Search before creating so you don't add duplicates.",
  'Tags are lowercase without a leading #.',
  'Saved items are left out of task lists, searches, and stats.',
  'get_top_three reports picks the user made in the app; only the user chooses them.',
  'Deletes are permanent and skip the 30-day Trash: preview with dryRun first.',
  'Bulk changes cover up to 50 tasks, or 10 deletes.',
  'A conflict means the task changed elsewhere; read it again before retrying.',
].join(' ');
