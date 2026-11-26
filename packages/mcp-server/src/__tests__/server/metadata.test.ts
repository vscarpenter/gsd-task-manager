import { readFileSync } from 'node:fs';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VERSION } from '../../version.js';
import { PROTOCOLS, connectClient, type ConnectedClient } from '../helpers/protocol-clients.js';

/**
 * What the server tells a client about itself and its tools before the model
 * calls one, on both protocol revisions (tasks/spec.md, "Move the MCP server to
 * SDK v2", AC7 and AC8). wire-contract.test.ts pins everything else the lists
 * carry.
 */
const SERVER_INFO = {
  name: 'gsd-task-manager',
  version: VERSION,
  title: 'GSD Task Manager',
  description: 'Eisenhower-matrix tasks from your GSD account',
  websiteUrl: 'https://gsd.vinny.dev',
};

// Claude Code cuts server instructions at 4,096 characters; the spec allows 1,500.
const INSTRUCTIONS_LIMIT = 1500;

// The rules AC7 says the instructions must state, each with the words that show it.
const REQUIRED_RULES: Record<string, RegExp[]> = {
  quadrants: [/\burgent\b/i, /\bimportant\b/i],
  duplicateSearch: [/search before creating/i],
  tagFormat: [/lowercase/i, /leading #/],
  savedItems: [/saved items/i],
  topThreeOwnership: [/get_top_three/, /only the user/i],
  deletePermanence: [/permanent/i, /trash/i],
  bulkLimits: [/\b50 tasks\b/, /\b10 deletes\b/],
  conflicts: [/conflict/i],
  // A confirmed delete answers "Not deleted:" when the user declines or the task changed.
  deleteReplies: [/Not deleted:/],
};

// No client is sure to ask: one without form elicitation deletes at once (D4),
// so the model must not be told to leave the confirmation to the client.
const PROMISES_A_CLIENT_DIALOG = /expect the client|client will ask|always ask/i;

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const NON_DESTRUCTIVE_WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE_WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

// The spec's annotation table. Every tool reaches only the user's own GSD
// account, so none is open-world.
const EXPECTED_ANNOTATIONS: Record<string, ToolAnnotations> = {
  list_tasks: READ_ONLY,
  get_task: READ_ONLY,
  search_tasks: READ_ONLY,
  get_sync_status: READ_ONLY,
  get_task_stats: READ_ONLY,
  get_token_status: READ_ONLY,
  get_top_three: READ_ONLY,
  get_productivity_metrics: READ_ONLY,
  get_quadrant_analysis: READ_ONLY,
  get_tag_analytics: READ_ONLY,
  get_upcoming_deadlines: READ_ONLY,
  get_task_insights: READ_ONLY,
  validate_config: READ_ONLY,
  get_help: READ_ONLY,
  // reset changes the cache counters, so get_cache_stats isn't read-only.
  get_cache_stats: NON_DESTRUCTIVE_WRITE,
  create_task: NON_DESTRUCTIVE_WRITE,
  update_task: DESTRUCTIVE_WRITE,
  complete_task: DESTRUCTIVE_WRITE,
  delete_task: DESTRUCTIVE_WRITE,
  bulk_update_tasks: DESTRUCTIVE_WRITE,
};

// A capital first letter and no other capitals.
const SENTENCE_CASE = /^[A-Z][^A-Z]*$/;

const PROMPT_TITLES: Record<string, string> = {
  'daily-standup': 'Daily standup',
  'weekly-review': 'Weekly review',
  'focus-mode': 'Focus mode',
  'upcoming-deadlines': 'Upcoming deadlines',
  'productivity-report': 'Productivity report',
  'tag-analysis': 'Tag analysis',
};

// The tool and prompt lists change only with a release, so any cache may keep
// them for ten minutes (AC9).
const PUBLIC_CACHE_HINT = { ttlMs: 600_000, cacheScope: 'public' };
const NO_CACHE_FIELDS = { ttlMs: undefined, cacheScope: undefined };

// The client's result types carry these fields only through an index signature.
function cacheFieldsOf(result: Record<string, unknown>): Record<string, unknown> {
  return { ttlMs: result.ttlMs, cacheScope: result.cacheScope };
}

// What prompts/get returns for each prompt in v1.5.0. The prompt text hasn't
// changed since, so the capture came from main on 2026-11-26 and was checked
// against the v1.5.0 source of src/tools/prompts.ts.
const PINNED_MESSAGES: Record<string, unknown> = JSON.parse(
  readFileSync(new URL('../fixtures/prompt-messages-v1.5.0.json', import.meta.url), 'utf8')
);

describe.each(PROTOCOLS)('server metadata on %s', (protocol) => {
  let connected: ConnectedClient;

  beforeEach(async () => {
    connected = await connectClient(protocol);
  });

  afterEach(async () => {
    await connected.close();
  });

  it('should_advertise_title_description_and_website_url', () => {
    const serverInfo = connected.client.getServerVersion();

    expect(serverInfo).toEqual(SERVER_INFO);
  });

  it('should_keep_instructions_within_1500_chars_and_cover_required_rules', () => {
    const instructions = connected.client.getInstructions() ?? '';

    const uncovered = Object.keys(REQUIRED_RULES).filter(
      (rule) => !REQUIRED_RULES[rule].every((pattern) => pattern.test(instructions))
    );

    expect({
      withinLimit: instructions.length <= INSTRUCTIONS_LIMIT,
      uncovered,
      promisesClientDialog: PROMISES_A_CLIENT_DIALOG.test(instructions),
    }).toEqual({ withinLimit: true, uncovered: [], promisesClientDialog: false });
  });

  it('should_annotate_every_tool_per_the_spec_table', async () => {
    const { tools } = await connected.client.listTools();

    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations] as const));
    const withoutSentenceCaseTitle = tools
      .filter((tool) => !SENTENCE_CASE.test(tool.title ?? ''))
      .map((tool) => tool.name);

    expect({ annotations, withoutSentenceCaseTitle }).toEqual({
      annotations: EXPECTED_ANNOTATIONS,
      withoutSentenceCaseTitle: [],
    });
  });

  it('should_title_every_prompt_without_changing_its_text', async () => {
    const { client } = connected;
    const { prompts } = await client.listPrompts();

    const titles = Object.fromEntries(prompts.map((prompt) => [prompt.name, prompt.title] as const));
    const messages = Object.fromEntries(
      await Promise.all(prompts.map(async ({ name }) => [name, (await client.getPrompt({ name })).messages] as const))
    );

    expect({ titles, messages }).toEqual({ titles: PROMPT_TITLES, messages: PINNED_MESSAGES });
  });
});

describe('cache hints', () => {
  it('should_send_public_cache_hints_only_on_2026_07_28', async () => {
    const modern = await connectClient('2026-07-28');
    const legacy = await connectClient('2025-11-25');
    try {
      const sent = {
        modern: {
          toolsList: cacheFieldsOf(await modern.client.listTools()),
          promptsList: cacheFieldsOf(await modern.client.listPrompts()),
          serverDiscover: cacheFieldsOf(await modern.client.discover()),
        },
        legacy: {
          toolsList: cacheFieldsOf(await legacy.client.listTools()),
          promptsList: cacheFieldsOf(await legacy.client.listPrompts()),
        },
      };

      expect(sent).toEqual({
        modern: { toolsList: PUBLIC_CACHE_HINT, promptsList: PUBLIC_CACHE_HINT, serverDiscover: PUBLIC_CACHE_HINT },
        legacy: { toolsList: NO_CACHE_FIELDS, promptsList: NO_CACHE_FIELDS },
      });
    } finally {
      await Promise.all([modern.close(), legacy.close()]);
    }
  });
});
