import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, getTokenStatus } from '../../auth/token-status.js';

/**
 * Build a JWT-like token whose payload contains the given `exp` (seconds
 * since epoch). Signature is a placeholder — `decodeJwtPayload` only parses
 * the payload, as the server enforces signatures on every request.
 */
function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-05-01T00:00:00.000Z');

describe('decodeJwtPayload', () => {
  it('returns the decoded payload for a valid JWT', () => {
    const token = makeToken({ sub: 'user123', exp: 1893456000 });
    const payload = decodeJwtPayload(token);
    expect(payload).toEqual({ sub: 'user123', exp: 1893456000 });
  });

  it('returns null for a token with the wrong number of segments', () => {
    expect(decodeJwtPayload('only.two')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('returns null for a token with non-JSON payload', () => {
    const bad = `header.${Buffer.from('not json').toString('base64url')}.sig`;
    expect(decodeJwtPayload(bad)).toBeNull();
  });
});

describe('getTokenStatus', () => {
  it('reports invalid when no token is provided', () => {
    const result = getTokenStatus(null);
    expect(result.status).toBe('invalid');
    expect(result.expired).toBe(true);
    expect(result.expiresAt).toBeNull();
    expect(result.instructions).not.toBeNull();
  });

  it('reports invalid for a malformed token', () => {
    const result = getTokenStatus('not.a.jwt', NOW);
    expect(result.status).toBe('invalid');
    expect(result.expired).toBe(true);
  });

  it('reports invalid for a JWT missing the exp claim', () => {
    const token = makeToken({ sub: 'user123' });
    const result = getTokenStatus(token, NOW);
    expect(result.status).toBe('invalid');
  });

  it('reports expired when exp is in the past', () => {
    const exp = Math.floor((NOW.getTime() - DAY_MS) / 1000);
    const result = getTokenStatus(makeToken({ exp }), NOW);
    expect(result.status).toBe('expired');
    expect(result.expired).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('reports critical when expiration is within 3 days', () => {
    const exp = Math.floor((NOW.getTime() + 2 * DAY_MS) / 1000);
    const result = getTokenStatus(makeToken({ exp }), NOW);
    expect(result.status).toBe('critical');
    expect(result.expired).toBe(false);
    expect(result.daysRemaining).toBe(2);
  });

  it('reports warning when expiration is within 14 days', () => {
    const exp = Math.floor((NOW.getTime() + 10 * DAY_MS) / 1000);
    const result = getTokenStatus(makeToken({ exp }), NOW);
    expect(result.status).toBe('warning');
    expect(result.daysRemaining).toBe(10);
  });

  it('reports healthy when expiration is beyond 14 days', () => {
    const exp = Math.floor((NOW.getTime() + 30 * DAY_MS) / 1000);
    const result = getTokenStatus(makeToken({ exp }), NOW);
    expect(result.status).toBe('healthy');
    expect(result.daysRemaining).toBe(30);
    expect(result.instructions).toBeNull();
  });
});
