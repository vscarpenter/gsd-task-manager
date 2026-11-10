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
  overrides?: Record<string, string>;
}

interface LockMeta {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

type LockEntry = [spec: string, ...rest: unknown[]];

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const WORKSPACE_MANIFESTS = ['package.json', 'packages/mcp-server/package.json'];

// bun applies overrides by package name only (it ignores npm's nested form),
// so one minimatch serves every consumer. minimatch 10 has no release clear of
// GHSA-g3hv-75wg-m249, and 11 keeps the named exports ESLint 10 and
// typescript-estree call. The three plugins call minimatch 3's default export,
// which 11 removed, but only from rules this repo's ESLint config leaves off:
// react/jsx-pascal-case, react/forbid-component-props,
// react/no-unstable-nested-components, import/no-unassigned-import,
// import/order, and the jsx-a11y label rules. Enabling one crashes lint.
const ACCEPTED_LINE_CROSSINGS: Record<string, string[]> = {
  minimatch: [
    '@eslint/config-array',
    '@typescript-eslint/typescript-estree',
    'eslint',
    'eslint-plugin-import',
    'eslint-plugin-jsx-a11y',
    'eslint-plugin-react',
  ],
};

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

function declaredRanges(entry: LockEntry): Record<string, string> {
  const meta = entry
    .slice(1)
    .find((part): part is LockMeta => typeof part === 'object' && part !== null);
  return { ...meta?.dependencies, ...meta?.optionalDependencies, ...meta?.peerDependencies };
}

// A release line is a major version, or 0.minor below 1.0.0.
function releaseLine(version: string): [number, number] {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  return major === 0 ? [0, minor] : [major, 0];
}

// Whether a declared range admits any version on the release line of
// `version`. The ranges in bun.lock are exact versions, ^ and ~ ranges, open
// >= floors, and || unions of those.
function rangeAllowsLine(range: string, version: string): boolean {
  const [major, minor] = releaseLine(version);
  return range.split('||').some((alternative) => {
    const match = alternative.trim().match(/^(>=?|\^|~|=)?\s*v?(\d+)(?:\.(\d+))?/);
    if (!match) return true;
    const [, operator = '', floorMajor, floorMinor = '0'] = match;
    const [lineMajor, lineMinor] = releaseLine(`${floorMajor}.${floorMinor}`);
    if (operator.startsWith('>')) {
      return major > lineMajor || (major === lineMajor && minor >= lineMinor);
    }
    return major === lineMajor && minor === lineMinor;
  });
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

  it('names an exact version for every override', () => {
    const { overrides = {} } = readManifest('package.json');
    const ranged = Object.entries(overrides).filter(([, version]) => !EXACT_VERSION.test(version));

    expect(ranged).toEqual([]);
  });

  it('overrides only packages that bun.lock installs', () => {
    const { overrides = {} } = readManifest('package.json');
    const installed = new Set(Object.values(readLockPackages()).map(([spec]) => splitSpec(spec).name));

    expect(Object.keys(overrides).filter((name) => !installed.has(name))).toEqual([]);
  });

  it('resolves every copy of an overridden package to the override version', () => {
    const { overrides = {} } = readManifest('package.json');
    const stray = Object.values(readLockPackages())
      .map(([spec]) => splitSpec(spec))
      .filter(({ name, version }) => Object.hasOwn(overrides, name) && overrides[name] !== version)
      .map(({ name, version }) => `${name}@${version} (override ${overrides[name]})`);

    expect(stray).toEqual([]);
  });

  it('keeps each dependent of an overridden package on the release line it declares', () => {
    const { overrides = {} } = readManifest('package.json');
    const packages = readLockPackages();
    const crossings: string[] = [];
    const accepted: string[] = [];

    for (const entry of Object.values(packages)) {
      const dependent = splitSpec(entry[0]).name;
      for (const [name, range] of Object.entries(declaredRanges(entry))) {
        const installed = Object.hasOwn(overrides, name) ? packages[name]?.[0] : undefined;
        if (!installed || rangeAllowsLine(range, splitSpec(installed).version)) continue;
        const crossing = `${name}: ${entry[0]} declares ${range}, gets ${installed}`;
        (ACCEPTED_LINE_CROSSINGS[name]?.includes(dependent) ? accepted : crossings).push(crossing);
      }
    }

    expect(crossings).toEqual([]);
    // An accepted crossing that no longer happens should leave the list.
    const acceptedDependents = new Set(accepted.map((line) => splitSpec(line.split(' ')[1]).name));
    expect([...acceptedDependents].sort()).toEqual(
      Object.values(ACCEPTED_LINE_CROSSINGS).flat().sort()
    );
  });
});
