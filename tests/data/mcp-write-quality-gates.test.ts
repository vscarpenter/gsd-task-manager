import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoFile = (path: string) => readFileSync(path, 'utf8');

describe('MCP write-path quality gates', () => {
  it('keeps a path-specific fail-closed coverage floor for mutation code', () => {
    const config = repoFile('packages/mcp-server/vitest.config.ts');

    expect(config).toContain("'src/write-ops/**'");
    expect(config).toMatch(/statements:\s*98/);
    expect(config).toMatch(/branches:\s*95/);
    expect(config).toMatch(/functions:\s*100/);
    expect(config).toMatch(/lines:\s*98/);
  });

  it('uses an explicit bounded worker pool and emits latency/rate-limit metrics', () => {
    const bulk = repoFile('packages/mcp-server/src/write-ops/bulk-operations.ts');

    expect(bulk).toContain('BULK_WRITE_CONCURRENCY = 4');
    expect(bulk).toContain('mapWithConcurrency');
    expect(bulk).toContain("logger.info('Bulk write completed'");
    expect(bulk).toContain('durationMs:');
    expect(bulk).toContain('rateLimitCount:');
    expect(bulk).not.toContain('PB_BULK_WRITE_DELAY_MS');
  });
});
