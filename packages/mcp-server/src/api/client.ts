import { z } from 'zod';
import type { GsdConfig } from '../types.js';
import { fetchWithRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from './retry.js';

/**
 * Replace the hostname (and port) in a PocketBase URL with a stable
 * `[pocketbase-host]` placeholder so error messages can be safely shared
 * (chat logs, screenshots, bug reports) without leaking a private
 * self-hosted endpoint. The user's local config still has the real URL.
 */
export function redactPocketBaseHost(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//[pocketbase-host]`;
  } catch {
    return '[pocketbase-host]';
  }
}

/**
 * Make authenticated API request to PocketBase
 */
export async function apiRequest<T>(
  config: GsdConfig,
  endpoint: string,
  schema: z.ZodType<T>,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const url = `${config.pocketBaseUrl}${endpoint}`;

  const response = await fetchWithErrorHandling(url, config, retryConfig);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed (${response.status}): ${errorText}\n` +
        `Endpoint: ${endpoint}\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  const data = await response.json();
  return schema.parse(data);
}

/**
 * Fetch URL with network error handling and automatic retry
 */
async function fetchWithErrorHandling(
  url: string,
  config: GsdConfig,
  retryConfig: RetryConfig
): Promise<Response> {
  try {
    return await fetchWithRetry(
      () =>
        fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.authToken}`,
            'Content-Type': 'application/json',
          },
        }),
      retryConfig
    );
  } catch (error) {
    const redactedHost = redactPocketBaseHost(config.pocketBaseUrl);
    throw new Error(
      `Failed to connect to ${redactedHost}\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please check:\n` +
        `  1. Your internet connection\n` +
        `  2. GSD_POCKETBASE_URL is correct\n` +
        `  3. PocketBase server is running\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }
}
