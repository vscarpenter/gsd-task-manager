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
