import { z } from 'zod';
import type { GsdConfig } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('CONFIG');

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Human-readable explanation of the PocketBase URL policy, shared by the zod
 * schema and the setup/validation CLIs so every entry point reports the same
 * rule.
 */
export const UNSAFE_POCKETBASE_URL_MESSAGE =
  'PocketBase URL must use HTTPS (or http://localhost / http://127.0.0.1 / http://[::1] for local development)';

/**
 * Validate that a URL either uses HTTPS, or uses HTTP only when targeting a
 * loopback hostname. Uses exact hostname matching after parsing so that
 * `http://localhost.attacker.com` and `http://localhost@attacker.com` are
 * correctly rejected (a `startsWith` check is bypassable).
 *
 * Exported so the CLIs (setup wizard, validator) gate the same way before
 * attaching `GSD_AUTH_TOKEN` to any request — they build configs from raw
 * prompts/env and never reach `configSchema.parse`.
 */
export function isSafePocketBaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Base URLs are configuration, not credential or request containers. Keeping
  // userinfo, query strings, and fragments out prevents accidental disclosure
  // in diagnostics and avoids ambiguous endpoint composition.
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return false;
  }

  if (parsed.protocol === 'https:') {
    return true;
  }
  if (parsed.protocol !== 'http:') {
    return false;
  }
  // URL.hostname for `[::1]` is `[::1]` (with brackets); strip them.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  return LOOPBACK_HOSTNAMES.has(hostname);
}

/**
 * Configuration schema for GSD MCP Server (PocketBase)
 */
export const configSchema = z.object({
  pocketBaseUrl: z.url().refine(isSafePocketBaseUrl, {
    message: UNSAFE_POCKETBASE_URL_MESSAGE,
  }),
  authToken: z.string().min(1),
});

export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): GsdConfig {
  try {
    return configSchema.parse({
      pocketBaseUrl: process.env.GSD_POCKETBASE_URL,
      authToken: process.env.GSD_AUTH_TOKEN,
    });
  } catch (error) {
    logger.error('Configuration error', error instanceof Error ? error : new Error(String(error)));
    logger.info('Required environment variables: GSD_POCKETBASE_URL, GSD_AUTH_TOKEN');
    logger.info('Run setup wizard with: npx gsd-mcp-server --setup');
    throw error;
  }
}
