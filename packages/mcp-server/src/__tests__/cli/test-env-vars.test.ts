import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('test-env-vars', () => {
  it('reports only whether configured values are present', () => {
    const output = execFileSync(process.execPath, ['test-env-vars.js'], {
      cwd: new URL('../../../', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        GSD_POCKETBASE_URL: 'https://private.internal:8443',
        GSD_AUTH_TOKEN: 'secret-token',
      },
    });

    expect(output).toContain('GSD_POCKETBASE_URL: ✅ Set');
    expect(output).not.toContain('private.internal');
    expect(output).not.toContain('secret-token');
  });
});
