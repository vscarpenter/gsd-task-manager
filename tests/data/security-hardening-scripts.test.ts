import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('security hardening scripts and workflows', () => {
  it('keeps PocketBase task ownership immutable in setup and schema updates', () => {
    const setupScript = readRepoFile('scripts/setup-pocketbase-collections.sh');
    const updateScript = readRepoFile('scripts/update-pocketbase-tasks-schema.sh');

    expect(setupScript).toContain('@request.body.owner:isset = false');
    expect(setupScript).toContain('@request.body.owner = owner');
    expect(updateScript).toContain('@request.body.owner:isset = false');
    expect(updateScript).toContain('@request.body.owner = owner');
    expect(updateScript).toContain('Owner immutability rule was not applied');
  });

  it('does not pass PocketBase superuser secrets or tokens directly in curl argv', () => {
    const scripts = [
      readRepoFile('scripts/setup-pocketbase-collections.sh'),
      readRepoFile('scripts/update-pocketbase-tasks-schema.sh'),
    ];

    for (const script of scripts) {
      expect(script).not.toMatch(/-d\s+["'][^"']*\$PB_ADMIN_PASSWORD/s);
      expect(script).not.toMatch(/-H\s+["']Authorization:\s*\$TOKEN["']/);
      expect(script).toContain('--data-binary @"$AUTH_PAYLOAD_FILE"');
      expect(script).toContain('--config');
    }
  });

  it('requires production deploy commits to be reachable from main before AWS access', () => {
    const workflow = readRepoFile('.github/workflows/deploy-prod.yml');
    const ancestryCheckIndex = workflow.indexOf('Verify deployment ref is on main');
    const awsCredentialsIndex = workflow.indexOf('Configure AWS credentials');

    expect(ancestryCheckIndex).toBeGreaterThan(-1);
    expect(awsCredentialsIndex).toBeGreaterThan(ancestryCheckIndex);
    expect(workflow).toContain('git merge-base --is-ancestor "$DEPLOY_COMMIT" origin/main');
    expect(workflow).toContain('fetch-depth: 0');
  });

  it('requires MCP publishes to use the reviewed release environment and main ancestry', () => {
    const workflow = readRepoFile('.github/workflows/publish-mcp-server.yml');
    const verifyIndex = workflow.indexOf('Verify publish ref is reviewed');
    const publishIndex = workflow.indexOf('Publish to npm');

    expect(workflow).toContain('name: mcp-release');
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(verifyIndex);
    expect(workflow).toContain('Manual publish must run from the main branch.');
    expect(workflow).toContain('git merge-base --is-ancestor "$RELEASE_COMMIT" origin/main');
    expect(workflow).toContain('fetch-depth: 0');
  });
});
