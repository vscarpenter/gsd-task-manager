import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(path, 'utf8');
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
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

  it('deletes stale HTML and service-worker objects during production deploy sync', () => {
    const deployScript = readRepoFile('scripts/deploy-app.sh');
    const htmlSyncStart = deployScript.indexOf('Syncing HTML files and service worker');
    const cacheHeaderStart = deployScript.indexOf('Forcing no-cache on index.html');
    const htmlSyncBlock = deployScript.slice(htmlSyncStart, cacheHeaderStart);

    expect(htmlSyncStart).toBeGreaterThan(-1);
    expect(cacheHeaderStart).toBeGreaterThan(htmlSyncStart);
    expect(htmlSyncBlock).toContain('--delete');
    expect(htmlSyncBlock).toContain('--include "*.html"');
    expect(htmlSyncBlock).toContain('--include "sw.js"');
  });

  it('fails CloudFront header deployment unless the response headers policy is attached', () => {
    const policyScript = readRepoFile('scripts/deploy-cloudfront-response-headers-policy.sh');
    const workflow = readRepoFile('.github/workflows/deploy-cloudfront-infra.yml');

    expect(policyScript).toContain('CLOUDFRONT_DISTRIBUTION_ID');
    expect(policyScript).toContain('POLICY_ID=');
    expect(policyScript).toContain('get-distribution-config');
    expect(policyScript).toContain('ResponseHeadersPolicyId');
    expect(policyScript).toContain('exit 1');
    expect(workflow).toContain('CLOUDFRONT_DISTRIBUTION_ID');
  });

  it('restricts Claude OAuth workflow invocations to trusted GitHub actors', () => {
    const workflow = readRepoFile('.github/workflows/claude.yml');
    const jobStart = workflow.indexOf('claude:');
    const runsOnStart = workflow.indexOf('runs-on:', jobStart);
    const jobCondition = workflow.slice(jobStart, runsOnStart);
    const allowlist = 'contains(fromJSON(\'["OWNER", "MEMBER", "COLLABORATOR"]\'), ';

    expect(jobStart).toBeGreaterThan(-1);
    expect(runsOnStart).toBeGreaterThan(jobStart);
    expect(countOccurrences(jobCondition, allowlist)).toBe(4);
    expect(countOccurrences(jobCondition, `${allowlist}github.event.comment.author_association)`)).toBe(2);
    expect(jobCondition).toContain(`${allowlist}github.event.review.author_association)`);
    expect(jobCondition).toContain(`${allowlist}github.event.issue.author_association)`);
    expect(jobCondition).not.toMatch(/\b(FIRST_TIME_CONTRIBUTOR|CONTRIBUTOR|NONE)\b/);
  });

  it('blocks PocketBase admin API routes before the public API reverse proxy', () => {
    const caddyfile = readRepoFile('docker/Caddyfile');
    const superusersBlockIndex = caddyfile.indexOf('handle /api/collections/_superusers/*');
    const legacyAdminsBlockIndex = caddyfile.indexOf('handle /api/admins/*');
    const publicApiProxyIndex = caddyfile.indexOf('handle /api/*');

    expect(superusersBlockIndex).toBeGreaterThan(-1);
    expect(legacyAdminsBlockIndex).toBeGreaterThan(superusersBlockIndex);
    expect(publicApiProxyIndex).toBeGreaterThan(legacyAdminsBlockIndex);
    expect(caddyfile).toContain('respond "PocketBase admin API is not exposed through this origin." 404');
    expect(caddyfile).toContain('reverse_proxy localhost:8090');
  });

  it('verifies PocketBase release archives before extracting them into Docker images', () => {
    const dockerfile = readRepoFile('docker/Dockerfile');

    expect(dockerfile).toContain('POCKETBASE_SHA256_AMD64');
    expect(dockerfile).toContain('POCKETBASE_SHA256_ARM64');
    expect(dockerfile).toContain('sha256sum -c');
  });

  it('pins dependency overrides and MCP dev tools to audited patched versions', () => {
    const rootPackage = JSON.parse(readRepoFile('package.json'));
    const mcpPackage = JSON.parse(readRepoFile('packages/mcp-server/package.json'));

    expect(rootPackage.overrides['brace-expansion']).toBe('>=5.0.6');
    expect(rootPackage.overrides.hono).toBe('>=4.12.29');
    expect(rootPackage.overrides.undici).toBe('>=7.28.0');
    expect(rootPackage.overrides.vite).toBe('>=8.1.4');
    expect(rootPackage.overrides['@babel/core']).toBe('>=8.0.1');
    expect(rootPackage.overrides['@opentelemetry/core']).toBe('>=2.9.0');
    expect(rootPackage.overrides.qs).toBe('>=6.15.2');
    expect(mcpPackage.dependencies['@sentry/node']).toBe('10.65.0');
    expect(mcpPackage.devDependencies.vitest).toBe('4.1.10');
    expect(mcpPackage.devDependencies['@vitest/ui']).toBe('4.1.10');
  });
});
