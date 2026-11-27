/**
 * The GSD workflows the package ships as MCP skills (tasks/spec.md, "Move the
 * MCP server to SDK v2", D6). They load once at startup, and one catalog
 * serves every connection.
 */

import { fileURLToPath } from 'node:url';
import type { SkillCatalog } from '@modelcontextprotocol/server/ext/skills';
import { loadSkills } from '@modelcontextprotocol/server/ext/skills/node';

// skills/ sits at the package root, two levels above this module in both src/ and dist/.
const SKILLS_ROOT = fileURLToPath(new URL('../../skills/', import.meta.url));

export function loadGsdSkills(): Promise<SkillCatalog> {
  return loadSkills(SKILLS_ROOT);
}
