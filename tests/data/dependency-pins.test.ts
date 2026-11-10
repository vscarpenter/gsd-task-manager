import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Dependabot reads the versions each package.json declares; bun.lock records
// what `bun install --frozen-lockfile` installs. When they drift, alerts name
// code that never runs and `bun audit` misses what the manifest claims. In
// November 2026 a devDependency pin of vite 8.3.1 raised six alerts while a
// `>=8.3.1` override quietly installed the patched 8.3.6.

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

type LockEntry = [spec: string, ...rest: unknown[]];

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const WORKSPACE_MANIFESTS = ['package.json', 'packages/mcp-server/package.json'];

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest;
}

function readLockPackages(): Record<string, LockEntry> {
  // bun.lock is JSON plus trailing commas.
  const text = readFileSync('bun.lock', 'utf8').replace(/,(\s*[}\]])/g, '$1');
  return (JSON.parse(text) as { packages: Record<string, LockEntry> }).packages;
}

function splitSpec(spec: string): { name: string; version: string } {
  const at = spec.lastIndexOf('@');
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

describe('dependency pins and overrides', () => {
  it('pins every direct dependency to the exact version bun.lock installs', () => {
    const packages = readLockPackages();
    const drift: string[] = [];

    for (const path of WORKSPACE_MANIFESTS) {
      const manifest = readManifest(path);
      const scope = path === 'package.json' ? '' : `${manifest.name}/`;
      const declared = { ...manifest.dependencies, ...manifest.devDependencies };
      for (const [name, range] of Object.entries(declared)) {
        // An alias such as "npm:typescript@7.0.2" installs the aliased package.
        const expected = range.startsWith('npm:') ? range.slice(4) : `${name}@${range}`;
        const installed = (packages[`${scope}${name}`] ?? packages[name])?.[0];
        if (!EXACT_VERSION.test(splitSpec(expected).version) || installed !== expected) {
          drift.push(`${path}: ${name} declares ${range}, bun.lock installs ${installed ?? 'nothing'}`);
        }
      }
    }

    expect(drift).toEqual([]);
  });
});
