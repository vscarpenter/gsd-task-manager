import { readFileSync } from 'node:fs';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROTOCOLS, connectClient, type ConnectedClient } from '../helpers/protocol-clients.js';

/**
 * GSD's workflow guidance, served as MCP skills beside the tools and prompts
 * (tasks/spec.md, "Move the MCP server to SDK v2", D6 and AC18 to AC22).
 */
const SKILLS_EXTENSION = 'io.modelcontextprotocol/skills';

// The spec's Skills table, in the URI order the catalog lists them.
const SKILL_NAMES = ['daily-plan', 'safe-cleanup', 'triage', 'weekly-review'];

// What each skill must teach, from the sources the spec's Skills table names:
// the tool descriptions, get_help, the six prompts, and the server instructions.
const REQUIRED_RULES: Record<string, Record<string, RegExp[]>> = {
  'daily-plan': {
    topThreeOwnership: [/get_top_three/, /only the user/i],
    picksBeforeSuggestions: [/picks/, /suggestions/],
    deadlines: [/get_upcoming_deadlines/, /overdue/i, /due today/i],
    focus: [/Do First/, /depend/i],
  },
  'safe-cleanup': {
    previewFirst: [/dryRun/, /preview/i],
    deleteOnlyWhatWasAsked: [/only what the user asked/i],
    permanence: [/permanent/i, /Trash/],
    // A client with form elicitation asks; one without it deletes at once (D4).
    someClientsConfirm: [/some clients/i, /confirm/i],
    notDeletedReplies: [/Not deleted:/, /declined/i, /changed/i],
    bulkLimits: [/\b50 tasks\b/, /\b10 deletes\b/],
    conflicts: [/conflict/i],
    dependencyCleanup: [/depend/i],
    tools: [/delete_task/, /bulk_update_tasks/],
  },
  triage: {
    quadrants: [/\burgent\b/, /\bimportant\b/, /Do First/, /Schedule/, /Delegate/, /Eliminate/],
    searchBeforeCreating: [/search_tasks/, /duplicate/i],
    tagFormat: [/lowercase/i, /leading #/],
    urls: [/URL/, /description/],
    dueDates: [/ISO 8601/],
    reminders: [/notifyBefore/, /notificationEnabled/],
    dependencies: [/dependencies/, /cycle/i],
  },
  'weekly-review': {
    metrics: [/get_productivity_metrics/, /streak/i],
    quadrants: [/get_quadrant_analysis/],
    tags: [/get_tag_analytics/, /completion rate/i],
    deadlines: [/get_upcoming_deadlines/],
    savedItems: [/Saved/],
  },
};

// No client is sure to ask before a delete (D4), as metadata.test.ts also checks
// of the server instructions.
const PROMISES_A_CLIENT_DIALOG = /expect the client|client will ask|always ask/i;

function skillBody(name: string): string {
  const file = readFileSync(new URL(`../../../skills/${name}/SKILL.md`, import.meta.url), 'utf8');
  return file.replace(/^---\n[\s\S]*?\n---\n/, '');
}

describe.each(PROTOCOLS)('skills on %s', (protocol) => {
  let connected: ConnectedClient;

  beforeEach(async () => {
    connected = await connectClient(protocol);
  });

  afterEach(async () => {
    await connected.close();
  });

  it('should_list_exactly_four_skills_with_matching_frontmatter', async () => {
    const { skills } = await new SkillsClient(connected.client).list();

    const listed = skills.map(({ uri, frontmatter }) => ({
      uri,
      name: frontmatter.name,
      hasDescription: frontmatter.description.trim().length > 0,
    }));

    expect({
      declared: SKILLS_EXTENSION in (connected.client.getServerCapabilities()?.extensions ?? {}),
      listed,
    }).toEqual({
      declared: true,
      listed: SKILL_NAMES.map((name) => ({ uri: `skill://${name}/SKILL.md`, name, hasDescription: true })),
    });
  });
});

describe('skill guidance', () => {
  it('should_teach_each_skill_its_workflow_rules', () => {
    const uncovered = Object.fromEntries(
      SKILL_NAMES.map((name) => {
        const body = skillBody(name);
        const rules = REQUIRED_RULES[name];
        return [name, Object.keys(rules).filter((rule) => !rules[rule].every((pattern) => pattern.test(body)))];
      })
    );
    const promisingClientDialog = SKILL_NAMES.filter((name) => PROMISES_A_CLIENT_DIALOG.test(skillBody(name)));

    expect({ uncovered, promisingClientDialog }).toEqual({
      uncovered: Object.fromEntries(SKILL_NAMES.map((name) => [name, []])),
      promisingClientDialog: [],
    });
  });
});
