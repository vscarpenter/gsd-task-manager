import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeAuditResults, runCli } from '../scripts/check-audit-results.cjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('analyzeAuditResults', () => {
  it('accepts an empty audit result', () => {
    expect(analyzeAuditResults('{}')).toEqual({ advisoryCount: 0, blocking: [] });
  });

  it('accepts advisories below the high threshold', () => {
    const result = analyzeAuditResults(JSON.stringify({
      package: [{ id: 1, severity: 'moderate', title: 'Moderate issue' }],
    }));

    expect(result).toEqual({ advisoryCount: 1, blocking: [] });
  });

  it.each(['high', 'critical'])('blocks a %s advisory', (severity) => {
    const result = analyzeAuditResults(JSON.stringify({
      package: [{ id: 7, severity, title: 'Unsafe package' }],
    }));

    expect(result.blocking).toEqual([
      { packageName: 'package', id: 7, severity, title: 'Unsafe package' },
    ]);
  });

  it.each([
    ['', 'empty'],
    ['not-json', 'valid JSON'],
    ['[]', 'JSON object'],
    ['{"package": {}}', 'advisory arrays'],
    ['{"package": [{"severity": 2}]}', 'string severity'],
  ])('rejects invalid audit evidence: %s', (input, expectedMessage) => {
    expect(() => analyzeAuditResults(input)).toThrow(expectedMessage);
  });
});

describe('runCli', () => {
  function auditFile(contents: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'audit-result-checker-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'audit-results.json');
    writeFileSync(path, contents);
    return path;
  }

  it('returns success for valid non-blocking evidence', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(runCli(auditFile('{}'))).toBe(0);
  });

  it('returns failure and reports each blocking advisory', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const path = auditFile(JSON.stringify({
      package: [{ id: 7, severity: 'high', title: 'Unsafe package' }],
    }));

    expect(runCli(path)).toBe(1);
    expect(error).toHaveBeenCalledWith('high: package (7) Unsafe package');
  });

  it('rejects a missing result path', () => {
    expect(() => runCli()).toThrow('Usage:');
  });
});
