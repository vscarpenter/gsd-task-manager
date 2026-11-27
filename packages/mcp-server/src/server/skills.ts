/**
 * The GSD workflows the package ships as MCP skills (tasks/spec.md, "Move the
 * MCP server to SDK v2", D6). They load once at startup, and one catalog
 * serves every connection. A skill problem never stops the tools (AC22).
 */

import { fileURLToPath } from 'node:url';
import type { SkillCatalog } from '@modelcontextprotocol/server/ext/skills';
import { loadSkills } from '@modelcontextprotocol/server/ext/skills/node';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('SKILLS');

// skills/ sits at the package root, two levels above this module in both src/ and dist/.
const SKILLS_ROOT = fileURLToPath(new URL('../../skills/', import.meta.url));

/** The catalog, or undefined when it can't load, so the server starts without skills. */
export async function loadGsdSkills(): Promise<SkillCatalog | undefined> {
  try {
    // The SDK skips an invalid skill and keeps the rest; its default report is a bare console.warn line.
    return await loadSkills(SKILLS_ROOT, {
      onWarning: (warning) => logger.warn('Skill skipped', { path: warning.path, problem: warning.message }),
    });
  } catch (error) {
    logger.warn('Skills not loaded; tools and prompts are still served', {
      root: SKILLS_ROOT,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
