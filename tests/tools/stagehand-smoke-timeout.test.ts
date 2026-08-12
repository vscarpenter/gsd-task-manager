import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('smoke timeout cleanup', () => {
  it('lets a green timed operation terminate without waiting for its deadline', () => {
    const smokeModule = resolve('tools/stagehand/timeout.ts');
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `import { withTimeout } from ${JSON.stringify(smokeModule)}; await withTimeout(Promise.resolve(), 90_000);`,
      ],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 1_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});
