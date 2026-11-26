import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The SDK line and the Node floor are part of the published package's contract
 * (tasks/spec.md, "Move the MCP server to SDK v2", AC1). The README states the
 * floor in words, so the two must not drift apart.
 */
type Manifest = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines: { node: string };
};

const manifest: Manifest = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
);
const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');

describe('package manifest', () => {
  it('should_pin_v2_server_and_client_and_drop_v1_sdk', () => {
    const sdkPins = {
      v1Sdk: manifest.dependencies['@modelcontextprotocol/sdk'],
      server: manifest.dependencies['@modelcontextprotocol/server'],
      client: manifest.devDependencies['@modelcontextprotocol/client'],
    };

    expect(sdkPins).toEqual({ v1Sdk: undefined, server: '2.4.0', client: '2.4.0' });
  });

  it('should_state_the_same_node_floor_in_readme_and_engines', () => {
    const readmeFloor = readme.match(/The package needs Node (\d+) or later/)?.[1];

    expect({ engines: manifest.engines.node, readme: readmeFloor }).toEqual({
      engines: '>=22',
      readme: '22',
    });
  });
});
