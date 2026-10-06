import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCHEMA_LIMITS } from '../../constants.js';

/**
 * Pins the MCP copy of the field limits to a fixture the root suite also reads
 * (tests/data/pinned-copies/field-limits.test.ts). The two copies are kept by
 * hand, so a limit changed in one copy alone must turn one suite red. To change
 * a shared limit, change both copies and the fixture together.
 */

interface FieldLimitsFixture {
  shared: Record<string, number>;
  webOnly: Record<string, number>;
  mcpOnly: Record<string, number>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

const fixture: FieldLimitsFixture = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'tests/fixtures/pinned-copies/field-limits.json'), 'utf8')
);

const mcpLimits: Record<string, number> = SCHEMA_LIMITS;

describe('pinned copy: field limits (mcp)', () => {
  it.each(Object.entries(fixture.shared))('shared limit %s is %d', (key, value) => {
    expect(mcpLimits[key]).toBe(value);
  });

  it.each(Object.entries(fixture.mcpOnly))('mcp-only limit %s is %d', (key, value) => {
    expect(mcpLimits[key]).toBe(value);
  });

  it('defines exactly the shared and mcp-only limits', () => {
    const expectedKeys = [...Object.keys(fixture.shared), ...Object.keys(fixture.mcpOnly)];
    expect(Object.keys(mcpLimits).sort()).toEqual(expectedKeys.sort());
  });
});
