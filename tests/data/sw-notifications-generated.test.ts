import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(resolve('package.json'));
const { generateSwNotifications } = require('./scripts/generate-sw-notifications.cjs');

describe('generated reminder worker', () => {
  it('matches its sources and loads as a classic worker script', () => {
    const directory = mkdtempSync(join(tmpdir(), 'gsd-worker-build-'));
    try {
      const target = join(directory, 'sw-notifications.js');
      generateSwNotifications(target);
      const generated = readFileSync(target, 'utf8');
      expect(generated).toBe(readFileSync('public/sw-notifications.js', 'utf8'));
      const context: { checkBackgroundNotifications?: unknown } = {};
      vm.runInNewContext(generated, context);
      expect(context.checkBackgroundNotifications).toBeTypeOf('function');
      expect(generated).not.toMatch(/^import |^export /m);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
