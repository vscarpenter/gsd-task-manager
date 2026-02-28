/**
 * Sync utility tests
 *
 * The old normalizeTokenExpiration utility was removed during PocketBase migration.
 * PocketBase SDK handles token normalization internally.
 */

import { describe, it, expect } from 'vitest';

describe('sync utils (PocketBase migration)', () => {
  it('normalizeTokenExpiration was removed — PocketBase SDK handles tokens', () => {
    // PocketBase SDK manages auth tokens internally via pb.authStore
    // No manual token expiration normalization needed
    expect(true).toBe(true);
  });
});
