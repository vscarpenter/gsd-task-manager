/**
 * Tests for encryption-helpers.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import { validatePassphrase, getOrCreateSalt, buildSaltApiUrl } from '@/lib/sync/encryption-helpers';

describe('validatePassphrase', () => {
  it('returns valid when passphrase meets minimum length', () => {
    const result = validatePassphrase('mySecurePass123', '', false);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when passphrase is too short', () => {
    const result = validatePassphrase('short', '', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('returns valid when passphrases match for new user', () => {
    const result = validatePassphrase('mySecurePass123', 'mySecurePass123', true);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when passphrases do not match for new user', () => {
    const result = validatePassphrase('mySecurePass123', 'differentPass456', true);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Passphrases do not match');
  });

  it('ignores confirmation for existing user', () => {
    const result = validatePassphrase('mySecurePass123', 'differentPass456', false);
    expect(result.valid).toBe(true);
  });
});

describe('getOrCreateSalt', () => {
  it('parses existing salt string from server', () => {
    const saltString = '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16';
    const result = getOrCreateSalt(saltString);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(16);
    expect(result[0]).toBe(1);
    expect(result[15]).toBe(16);
  });

  it('generates new salt when server salt is null', () => {
    const result = getOrCreateSalt(null);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32); // Salt is 32 bytes (256 bits) for PBKDF2
  });

  it('generates new salt when server salt is undefined', () => {
    const result = getOrCreateSalt(undefined);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it('generates random salt each time', () => {
    const salt1 = getOrCreateSalt(undefined);
    const salt2 = getOrCreateSalt(undefined);
    // Random salts should not be equal (statistically extremely unlikely)
    const areEqual = salt1.every((val, i) => val === salt2[i]);
    expect(areEqual).toBe(false);
  });
});

// Note: buildSaltApiUrl tests require a browser environment (window.location)
// They are tested in the UI test suite instead
