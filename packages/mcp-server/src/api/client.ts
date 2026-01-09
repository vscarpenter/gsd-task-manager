import { z } from 'zod';
import type { GsdConfig } from '../types.js';
import { fetchWithRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from './retry.js';

/**
 * Make authenticated API request to GSD Worker
 * Handles all HTTP errors with detailed user-friendly messages
 * Includes automatic retry with exponential backoff for transient failures
 */
export async function apiRequest<T>(
  config: GsdConfig,
  endpoint: string,
  schema: z.ZodType<T>,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`;

  const response = await fetchWithErrorHandling(url, config, retryConfig);
  await validateResponseStatus(response, endpoint, config);

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
    throw new Error(
      `❌ Failed to connect to ${config.apiBaseUrl}\n\n` +
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please check:\n` +
        `  1. Your internet connection\n` +
        `  2. GSD_API_URL is correct (${config.apiBaseUrl})\n` +
        `  3. The Worker is deployed and accessible\n\n` +
        `Retried ${retryConfig.maxRetries} times before giving up.\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }
}

/**
 * Validate HTTP response status and throw detailed errors
 */
async function validateResponseStatus(
  response: Response,
  endpoint: string,
  config: GsdConfig
): Promise<void> {
  if (response.ok) return;

  const errorText = await response.text();

  if (response.status === 401) {
    throw createAuthError(config);
  }

  if (response.status === 404) {
    throw createNotFoundError(endpoint, config);
  }

  if (response.status === 403) {
    throw createForbiddenError();
  }

  if (response.status >= 500) {
    throw createServerError(response, errorText);
  }

  throw createGenericError(response, errorText);
}

/**
 * Create 401 Unauthorized error message
 */
function createAuthError(config: GsdConfig): Error {
  return new Error(
    `❌ Authentication failed (401 Unauthorized)\n\n` +
      `Your auth token has expired or is invalid.\n\n` +
      `To fix:\n` +
      `  1. Visit ${config.apiBaseUrl}\n` +
      `  2. Complete OAuth login\n` +
      `  3. Copy new token from DevTools → Application → Local Storage → gsd_auth_token\n` +
      `  4. Update GSD_AUTH_TOKEN in Claude Desktop config\n` +
      `  5. Restart Claude Desktop\n\n` +
      `Run: npx gsd-mcp-server --setup`
  );
}

/**
 * Create 404 Not Found error message
 */
function createNotFoundError(endpoint: string, config: GsdConfig): Error {
  return new Error(
    `❌ Endpoint not found (404 Not Found)\n\n` +
      `The API endpoint ${endpoint} does not exist.\n\n` +
      `Please check:\n` +
      `  1. GSD_API_URL is correct (${config.apiBaseUrl})\n` +
      `  2. Your Worker is deployed with the latest version\n` +
      `  3. You're using a compatible MCP server version\n\n` +
      `Run: npx gsd-mcp-server --validate`
  );
}

/**
 * Create 403 Forbidden error message
 */
function createForbiddenError(): Error {
  return new Error(
    `❌ Access forbidden (403 Forbidden)\n\n` +
      `You don't have permission to access this resource.\n\n` +
      `This could mean:\n` +
      `  1. Your token is for a different user/account\n` +
      `  2. The resource has been revoked\n` +
      `  3. CORS or access policy restrictions\n\n` +
      `Try logging in again: npx gsd-mcp-server --setup`
  );
}

/**
 * Create 5xx Server Error message
 */
function createServerError(response: Response, errorText: string): Error {
  return new Error(
    `❌ Server error (${response.status} ${response.statusText})\n\n` +
      `The GSD Worker encountered an internal error.\n\n` +
      `Error details: ${errorText}\n\n` +
      `Please try again in a few moments. If the issue persists, check:\n` +
      `  - Worker logs in Cloudflare dashboard\n` +
      `  - GitHub issues: https://github.com/vscarpenter/gsd-taskmanager/issues`
  );
}

/**
 * Create generic API error message
 */
function createGenericError(response: Response, errorText: string): Error {
  return new Error(
    `❌ API request failed (${response.status} ${response.statusText})\n\n` +
      `Error details: ${errorText}\n\n` +
      `Run: npx gsd-mcp-server --validate`
  );
}
