/**
 * Single source of truth for the MCP server version.
 *
 * Read from package.json at runtime so the version can't drift across
 * setup.ts, handleGetHelp, showHelp, and the published package.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/version.ts → ../package.json; dist/version.js → ../package.json
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION = readVersion();
