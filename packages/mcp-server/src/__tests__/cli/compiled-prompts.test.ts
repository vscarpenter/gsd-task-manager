import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Vitest hands every module it loads a `require` shim, so a bare `require` in
// this ESM package passes in the suite and throws for users. These tests
// compile the package the way `npm run build` does and run it under plain Node.
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('compiled CLI prompts under plain Node', () => {
  let outDir: string;

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'gsd-mcp-cli-'));
    // Without this marker Node guesses the module format from syntax, and the
    // output would fail for a different reason than it does once published.
    writeFileSync(join(outDir, 'package.json'), '{"type":"module"}');
    execFileSync(
      join(PACKAGE_ROOT, 'node_modules/.bin/tsc'),
      ['-p', 'tsconfig.json', '--outDir', join(outDir, 'dist')],
      { cwd: PACKAGE_ROOT, stdio: 'pipe' }
    );
  });

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  function runCompiled(call: string, input: string): string {
    const moduleUrl = pathToFileURL(join(outDir, 'dist/cli/index.js')).href;
    const script = [
      `import { prompt, promptPassword } from ${JSON.stringify(moduleUrl)};`,
      `${call}.then((answer) => console.log('ANSWER=' + answer));`,
    ].join('\n');
    return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      input,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }

  it('prompt() returns the piped answer', () => {
    const output = runCompiled("prompt('Enter your PocketBase URL')", 'https://pb.example\n');

    expect(output).toContain('ANSWER=https://pb.example');
  });

  it('promptPassword() reads a piped line when stdin is not a TTY', () => {
    const output = runCompiled("promptPassword('Paste token')", 'piped-token\n');

    expect(output).toContain('ANSWER=piped-token');
  });
});
