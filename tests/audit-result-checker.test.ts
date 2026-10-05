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

const BRACES_ADVISORY = { id: 1240992, severity: 'high', title: 'Stack exhaustion' };
const BEFORE_EXPIRY = { now: new Date('2026-10-05T12:00:00Z') };
const AT_EXPIRY = { now: new Date('2027-01-05T00:00:00Z') };

describe('analyzeAuditResults', () => {
  it('accepts an empty audit result', () => {
    expect(analyzeAuditResults('{}')).toEqual({ advisoryCount: 0, blocking: [], accepted: [] });
  });

  it('accepts advisories below the high threshold', () => {
    const result = analyzeAuditResults(JSON.stringify({
      package: [{ id: 1, severity: 'moderate', title: 'Moderate issue' }],
    }));

    expect(result).toEqual({ advisoryCount: 1, blocking: [], accepted: [] });
  });

  it('accepts the reviewed braces advisory before its expiry date', () => {
    const result = analyzeAuditResults(JSON.stringify({ braces: [BRACES_ADVISORY] }), BEFORE_EXPIRY);

    expect(result.blocking).toEqual([]);
    expect(result.accepted).toEqual([
      expect.objectContaining({ packageName: 'braces', id: 1240992, expires: '2027-01-05' }),
    ]);
  });

  it('blocks the braces advisory again once its acceptance expires', () => {
    const result = analyzeAuditResults(JSON.stringify({ braces: [BRACES_ADVISORY] }), AT_EXPIRY);

    expect(result.accepted).toEqual([]);
    expect(result.blocking).toEqual([{ packageName: 'braces', ...BRACES_ADVISORY }]);
  });

  it('keeps an acceptance scoped to its package', () => {
    const result = analyzeAuditResults(JSON.stringify({ micromatch: [BRACES_ADVISORY] }), BEFORE_EXPIRY);

    expect(result.blocking).toEqual([{ packageName: 'micromatch', ...BRACES_ADVISORY }]);
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

  it('reports an accepted advisory and still succeeds', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const path = auditFile(JSON.stringify({ braces: [BRACES_ADVISORY] }));

    expect(runCli(path, BEFORE_EXPIRY)).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Accepted until 2027-01-05: high: braces (1240992) Stack exhaustion'),
    );
  });

  it('rejects a missing result path', () => {
    expect(() => runCli()).toThrow('Usage:');
  });
});
