/**
 * Tests for sync utility functions
 */
import { describe, it, expect } from 'vitest';
import { normalizeTokenExpiration } from '@/lib/sync/utils';

describe('normalizeTokenExpiration', () => {
  it('should convert seconds to milliseconds when below threshold', () => {
    // JWT token expiration: Jan 1, 2025 00:00:00 UTC (in seconds)
    const expiresAtSeconds = 1735689600;
    const result = normalizeTokenExpiration(expiresAtSeconds);

    expect(result).toBe(expiresAtSeconds * 1000);
    expect(result).toBe(1735689600000);
  });

  it('should keep milliseconds unchanged when above threshold', () => {
    // Already in milliseconds: Jan 1, 2025 00:00:00 UTC
    const expiresAtMs = 1735689600000;
    const result = normalizeTokenExpiration(expiresAtMs);

    expect(result).toBe(expiresAtMs);
  });

  it('should handle edge case at threshold boundary (seconds)', () => {
    // Just below threshold: 9,999,999,999 seconds
    const justBelowThreshold = 9_999_999_999;
    const result = normalizeTokenExpiration(justBelowThreshold);

    expect(result).toBe(justBelowThreshold * 1000);
  });

  it('should handle edge case at threshold boundary (milliseconds)', () => {
    // Just at threshold: 10,000,000,000 milliseconds
    const atThreshold = 10_000_000_000;
    const result = normalizeTokenExpiration(atThreshold);

    // Should NOT multiply since it's >= threshold
    expect(result).toBe(atThreshold);
  });

  it('should throw error for zero expiration', () => {
    expect(() => normalizeTokenExpiration(0)).toThrow('Invalid token expiration');
  });

  it('should throw error for negative expiration', () => {
    expect(() => normalizeTokenExpiration(-1)).toThrow('Invalid token expiration');
  });

  it('should throw error for non-finite values', () => {
    expect(() => normalizeTokenExpiration(Number.POSITIVE_INFINITY)).toThrow('Invalid token expiration');
    expect(() => normalizeTokenExpiration(Number.NaN)).toThrow('Invalid token expiration');
  });

  it('should handle realistic JWT token expiration (1 hour from now)', () => {
    // Typical JWT: current time + 1 hour (in seconds)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneHourLater = nowSeconds + 3600;

    const result = normalizeTokenExpiration(oneHourLater);

    expect(result).toBe(oneHourLater * 1000);
  });

  it('should handle realistic token expiration already in milliseconds', () => {
    // Already in milliseconds
    const nowMs = Date.now();
    const oneHourLater = nowMs + 3600000;

    const result = normalizeTokenExpiration(oneHourLater);

    expect(result).toBe(oneHourLater);
  });
});
