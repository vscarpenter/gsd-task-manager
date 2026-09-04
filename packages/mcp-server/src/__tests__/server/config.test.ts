import { describe, it, expect } from 'vitest';
import { configSchema } from '../../server/config.js';

const validToken = 'a'.repeat(40);

function jwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('configSchema URL validation', () => {
  describe('accepts safe URLs', () => {
    it('accepts https URLs', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'https://api.example.com',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });

    it('accepts http://localhost', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://localhost',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });

    it('accepts http://localhost with a port', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://localhost:8090',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });

    it('accepts http://127.0.0.1', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://127.0.0.1',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });

    it('accepts http://127.0.0.1 with a port', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://127.0.0.1:8090',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });

    it('accepts http://[::1] (IPv6 loopback)', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://[::1]:8090',
        authToken: validToken,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejects DNS subdomain bypass attempts', () => {
    it('rejects http://localhost.attacker.com', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://localhost.attacker.com',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });

    it('rejects http://127.0.0.1.attacker.com', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://127.0.0.1.attacker.com',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });

    it('rejects http://localhost@attacker.com (userinfo trick)', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://localhost@attacker.com',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });

    it('rejects http://attacker.com#localhost (fragment trick)', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://attacker.com#localhost',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rejects plain http to non-loopback hosts', () => {
    it('rejects http://api.example.com', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://api.example.com',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });

    it('rejects http://192.168.1.1 (private network, not loopback)', () => {
      const result = configSchema.safeParse({
        pocketBaseUrl: 'http://192.168.1.1',
        authToken: validToken,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('configSchema principal validation', () => {
  const parse = (authToken: string) =>
    configSchema.safeParse({ pocketBaseUrl: 'https://api.example.com', authToken });

  it.each([
    { collectionId: '_superusers' },
    { collectionName: '_superusers' },
    { type: 'superuser' },
    { isSuperuser: true },
  ])('rejects known superuser claims: %j', (claims) => {
    const result = parse(jwt(claims));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('superuser tokens are not accepted');
    }
  });

  it('accepts a normal users-collection JWT for runtime attestation', () => {
    expect(
      parse(
        jwt({
          collectionId: 'users_collection_id',
          collectionName: 'users',
          id: 'user-1',
          type: 'auth',
        })
      ).success
    ).toBe(true);
  });

  it('leaves malformed opaque tokens for authoritative runtime validation', () => {
    expect(parse(validToken).success).toBe(true);
  });
});
