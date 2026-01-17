/**
 * Retry utilities with exponential backoff
 * Handles transient network failures and 5xx server errors
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [500, 502, 503, 504, 429],
};

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param attempt - Current attempt number (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Add jitter (0-25% of delay) to prevent thundering herd
  const jitter = exponentialDelay * Math.random() * 0.25;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if an error is retryable (network error)
 */
export function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up')
  );
}

/**
 * Check if HTTP status code is retryable
 */
export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status);
}

/**
 * Execute a fetch request with retry logic
 * @param fetchFn - Function that performs the fetch
 * @param config - Retry configuration (optional)
 * @returns Response from successful fetch
 * @throws Error after all retries exhausted
 */
export async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchFn();

      // Check if response status is retryable
      if (isRetryableStatus(response.status, config) && attempt < config.maxRetries) {
        lastResponse = response;
        const delay = calculateBackoffDelay(attempt, config);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry network errors
      if (!isRetryableNetworkError(lastError) || attempt >= config.maxRetries) {
        throw lastError;
      }

      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }

  // Should not reach here, but handle edge case
  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Format retry information for error messages
 */
export function formatRetryInfo(attempts: number, config: RetryConfig): string {
  // config is available for future use (e.g., including max retries in message)
  void config;
  if (attempts === 0) return '';
  return `\n\nRetried ${attempts} time${attempts > 1 ? 's' : ''} before failing.`;
}
