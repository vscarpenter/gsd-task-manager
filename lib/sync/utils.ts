/**
 * Sync utility functions
 */

/**
 * Normalize token expiration timestamp to milliseconds
 *
 * JWT and OIDC tokens typically use Unix timestamps in seconds,
 * but JavaScript Date uses milliseconds. This function handles both formats.
 *
 * The threshold (10 billion) represents ~November 2286 when interpreted as seconds,
 * or ~April 1970 when interpreted as milliseconds. Since all valid token expiration
 * dates are well after 1970, any value below this threshold must be in seconds.
 *
 * @param expiresAt - Token expiration timestamp (seconds or milliseconds)
 * @returns Normalized timestamp in milliseconds
 * @throws Error if expiresAt is not a positive number
 *
 * @example
 * // JWT token expiration (seconds since epoch)
 * normalizeTokenExpiration(1735689600) // Returns 1735689600000
 *
 * // Already in milliseconds
 * normalizeTokenExpiration(1735689600000) // Returns 1735689600000
 */
export function normalizeTokenExpiration(expiresAt: number): number {
  // Threshold: 10 billion milliseconds ≈ Sep 2286 in seconds
  const SECONDS_TO_MS_THRESHOLD = 10_000_000_000;

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error(`Invalid token expiration: ${expiresAt}. Must be a positive number.`);
  }

  return expiresAt < SECONDS_TO_MS_THRESHOLD
    ? expiresAt * 1000  // Convert seconds to milliseconds
    : expiresAt;         // Already in milliseconds
}
