import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const mockHomeDir = `${process.cwd()}/.tmp-setup-artifact-home`;

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => mockHomeDir };
});

import { getSetupArtifactPath, removeSetupArtifact } from '../../cli/setup-artifact.js';

describe('setup-artifact', () => {
  beforeEach(() => {
    mkdirSync(mockHomeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(mockHomeDir, { recursive: true, force: true });
  });

  it('should_resolve_artifact_path_inside_home_directory', () => {
    expect(getSetupArtifactPath()).toBe(join(mockHomeDir, '.gsd-mcp-setup.json'));
  });

  it('should_remove_existing_artifact_and_return_true', () => {
    // The wizard artifact holds a plaintext auth token; once the server
    // starts with valid env config the artifact has served its purpose
    // and must not linger at rest.
    const artifactPath = getSetupArtifactPath();
    writeFileSync(artifactPath, '{"mcpServers":{}}');

    const removed = removeSetupArtifact();

    expect(removed).toBe(true);
    expect(existsSync(artifactPath)).toBe(false);
  });

  it('should_return_false_without_throwing_when_artifact_absent', () => {
    expect(existsSync(getSetupArtifactPath())).toBe(false);

    expect(removeSetupArtifact()).toBe(false);
  });
});
