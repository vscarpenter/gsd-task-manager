import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toolArgSchemas } from '../../tools/handlers/input-schemas.js';
import { allTools } from '../../tools/schemas/index.js';

describe('typed tool dispatcher', () => {
  it('defines arguments for exactly the tools exposed by the MCP schema list', () => {
    expect(Object.keys(toolArgSchemas).sort()).toEqual(allTools.map((tool) => tool.name).sort());
  });

  it('uses a schema-bound registry without an any cast or name switch', () => {
    const source = readFileSync('src/tools/handlers/index.ts', 'utf8');

    expect(source).not.toMatch(/switch\s*\(name\)/);
    expect(source).not.toMatch(/\bas any\b/);
    expect(source).toContain('createToolRunner');
    expect(source).toContain('satisfies Record<ToolName, ToolRunner>');
  });

  it('preserves the established error for an unknown tool', () => {
    const source = readFileSync('src/tools/handlers/index.ts', 'utf8');

    expect(source).toContain('Unknown tool: ${name}');
  });
});
