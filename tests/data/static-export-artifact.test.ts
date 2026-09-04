import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';

const validator = resolve(process.cwd(), 'scripts/verify-static-export-artifact.py');
const workspaces: string[] = [];

function workspace(): string {
  const path = mkdtempSync(join(tmpdir(), 'gsd-static-export-'));
  workspaces.push(path);
  return path;
}

function createArchive(root: string, source: string, archive: string) {
  const result = spawnSync('tar', ['-czf', archive, '-C', source, '.'], {
    cwd: root,
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

function validate(archive: string, output: string) {
  return spawnSync('python3', [validator, archive, output], {
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const path of workspaces.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe('static-export artifact validator', () => {
  it('extracts a bounded regular-file-only static export', () => {
    const root = workspace();
    const source = join(root, 'source');
    const archive = join(root, 'static-export.tgz');
    const output = join(root, 'out');
    mkdirSync(join(source, 'assets'), { recursive: true });
    writeFileSync(join(source, 'index.html'), '<!doctype html>');
    writeFileSync(join(source, 'assets', 'app.js'), 'console.log("ok")');
    createArchive(root, source, archive);

    const result = validate(archive, output);

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(output, 'index.html'), 'utf8')).toBe('<!doctype html>');
    expect(readFileSync(join(output, 'assets', 'app.js'), 'utf8')).toBe('console.log("ok")');
  });

  it('rejects archive links before creating the deployment tree', () => {
    const root = workspace();
    const source = join(root, 'source');
    const archive = join(root, 'static-export.tgz');
    const output = join(root, 'out');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'index.html'), '<!doctype html>');
    symlinkSync('/proc/self/environ', join(source, 'credential-leak'));
    createArchive(root, source, archive);

    const result = validate(archive, output);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not a regular file or directory');
    expect(() => readFileSync(join(output, 'index.html'))).toThrow();
  });

  it('refuses to merge an artifact into a pre-existing output directory', () => {
    const root = workspace();
    const source = join(root, 'source');
    const archive = join(root, 'static-export.tgz');
    const output = join(root, 'out');
    mkdirSync(source, { recursive: true });
    mkdirSync(output);
    writeFileSync(join(source, 'index.html'), '<!doctype html>');
    writeFileSync(join(output, 'keep.txt'), 'trusted');
    createArchive(root, source, archive);

    const result = validate(archive, output);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must not already exist');
    expect(readFileSync(join(output, 'keep.txt'), 'utf8')).toBe('trusted');
  });
});
