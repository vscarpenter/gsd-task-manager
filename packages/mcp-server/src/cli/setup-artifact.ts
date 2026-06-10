/**
 * Setup-wizard artifact lifecycle.
 *
 * The wizard writes the generated Claude Desktop config snippet — including
 * the plaintext auth token — to a chmod-600 file in the user's home
 * directory. Deleting it was originally a manual step the user could skip,
 * leaving the token at rest indefinitely. This module centralizes the path
 * and best-effort removal so both the wizard (stale artifact from a prior
 * run) and the server startup (artifact has served its purpose once env
 * config loads) can clean it up automatically.
 */

import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where the wizard writes the generated config snippet (mode 0600). */
export function getSetupArtifactPath(): string {
  return join(homedir(), '.gsd-mcp-setup.json');
}

/**
 * Best-effort removal of the wizard artifact.
 * Returns true if a file was removed, false if none existed (or removal
 * failed) — callers treat cleanup as advisory and never throw on it.
 */
export function removeSetupArtifact(): boolean {
  try {
    unlinkSync(getSetupArtifactPath());
    return true;
  } catch {
    return false;
  }
}
