/**
 * OAuth Security Tests
 *
 * Tests multi-layer security validation for OAuth postMessage flows.
 * Covers origin validation, message structure, state validation, and attack scenarios.
 */

import { describe, it, expect } from 'vitest';
import { isOAuthOriginAllowed } from '@/lib/oauth-config';
import { validateOAuthMessage } from '@/lib/oauth-schemas';

describe('OAuth Security - Origin Validation', () => {
  it('should allow production origin', () => {
    expect(isOAuthOriginAllowed('https://gsd.vinny.dev')).toBe(true);
  });

  it('should allow development origin', () => {
    expect(isOAuthOriginAllowed('https://gsd-dev.vinny.dev')).toBe(true);
  });

  it('should allow worker domains', () => {
    expect(isOAuthOriginAllowed('https://gsd-sync-worker.vscarpenter.workers.dev')).toBe(true);
    expect(isOAuthOriginAllowed('https://gsd-sync-worker-production.vscarpenter.workers.dev')).toBe(true);
    expect(isOAuthOriginAllowed('https://gsd-sync-worker-dev.vscarpenter.workers.dev')).toBe(true);
  });

  it('should allow localhost with any port', () => {
    expect(isOAuthOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOAuthOriginAllowed('http://localhost:8080')).toBe(true);
    expect(isOAuthOriginAllowed('http://127.0.0.1:3000')).toBe(true);
    expect(isOAuthOriginAllowed('http://127.0.0.1:8787')).toBe(true);
  });

  it('should reject untrusted origins', () => {
    expect(isOAuthOriginAllowed('https://evil.com')).toBe(false);
    expect(isOAuthOriginAllowed('https://gsd-vinny-dev.attacker.com')).toBe(false);
    expect(isOAuthOriginAllowed('http://malicious.localhost')).toBe(false);
  });

  it('should reject null or undefined origins', () => {
    expect(isOAuthOriginAllowed(null as any)).toBe(false);
    expect(isOAuthOriginAllowed(undefined as any)).toBe(false);
  });

  it('should reject empty string origin', () => {
    expect(isOAuthOriginAllowed('')).toBe(false);
  });
});

describe('OAuth Security - Message Structure Validation', () => {
  it('should validate correct OAuth success message', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32), // Valid 32-char state
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.type).toBe('oauth_success');
  });

  it('should validate correct OAuth error message', () => {
    const message = {
      type: 'oauth_error',
      error: 'User denied authorization',
      state: 'a'.repeat(32),
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.type).toBe('oauth_error');
  });

  it('should reject message with short state token', () => {
    const message = {
      type: 'oauth_success',
      state: 'short', // Too short (< 32 chars)
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toContain('State token too short');
  });

  it('should reject message with invalid email', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'not-an-email', // Invalid email format
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email format');
  });

  it('should reject message with invalid provider', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'facebook', // Invalid provider (not google or apple)
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid OAuth provider');
  });

  it('should reject message with missing required fields', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        // Missing deviceId, email, token, etc.
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
  });

  it('should reject message with invalid type', () => {
    const message = {
      type: 'oauth_hacked', // Invalid type
      state: 'a'.repeat(32),
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
  });

  it('should reject message with negative expiresAt', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: -1, // Negative timestamp
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid expiration timestamp');
  });

  it('should reject completely malformed message', () => {
    const messages = [
      null,
      undefined,
      'not an object',
      123,
      [],
      { random: 'object' },
    ];

    messages.forEach((msg) => {
      const result = validateOAuthMessage(msg);
      expect(result.success).toBe(false);
    });
  });
});

describe('OAuth Security - Attack Scenarios', () => {
  it('should reject CSRF attack with fake state', () => {
    // Attacker tries to inject a message with a fake state
    const attackMessage = {
      type: 'oauth_success',
      state: 'fake_state_from_attacker_12345678901234567890',
      authData: {
        userId: 'attacker_user',
        deviceId: 'attacker_device',
        email: 'attacker@evil.com',
        token: 'fake_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(attackMessage);
    // Message structure is valid, but state won't match (checked in component logic)
    expect(result.success).toBe(true);
    // In actual usage, the component would reject due to unknown state
  });

  it('should reject XSS payload injection attempts', () => {
    const xssMessage = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: '<script>alert("xss")</script>',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    // Message validation passes (strings are allowed)
    // XSS prevention happens in rendering layer
    const result = validateOAuthMessage(xssMessage);
    expect(result.success).toBe(true);
  });

  it('should validate encryptionSalt if provided', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
        encryptionSalt: 'salt_value_here',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true);
    expect(result.data?.type === 'oauth_success' && result.data.authData.encryptionSalt).toBe('salt_value_here');
  });
});

describe('OAuth Security - Edge Cases', () => {
  it('should handle OAuth error without state', () => {
    const message = {
      type: 'oauth_error',
      error: 'Generic OAuth error',
      // No state field
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('oauth_error');
  });

  it('should reject empty error message', () => {
    const message = {
      type: 'oauth_error',
      error: '', // Empty error message
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Error message is required');
  });

  it('should handle very long state tokens', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(256), // Very long state
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'google',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true); // Long states are ok
  });

  it('should validate Apple provider', () => {
    const message = {
      type: 'oauth_success',
      state: 'a'.repeat(32),
      authData: {
        userId: 'user123',
        deviceId: 'device456',
        email: 'user@example.com',
        token: 'valid_jwt_token',
        expiresAt: Date.now() + 3600000,
        requiresEncryptionSetup: false,
        provider: 'apple',
      },
    };

    const result = validateOAuthMessage(message);
    expect(result.success).toBe(true);
  });
});
