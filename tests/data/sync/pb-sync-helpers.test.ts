import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

import { fetchRemoteTaskIndex, escapeFilterValue, assertSafeRecordId } from '@/lib/sync/pb-sync-helpers';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

describe('fetchRemoteTaskIndex', () => {
  it('returns task_id -> { pbRecordId, clientUpdatedAt } map', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => [
          { id: 'rec-1', task_id: 't1', client_updated_at: '2026-05-18T10:00:00.000Z' },
          { id: 'rec-2', task_id: 't2', client_updated_at: '2026-05-18T11:00:00.000Z' },
        ]),
      }),
    });

    const { index, fetchSucceeded } = await fetchRemoteTaskIndex('user-1');
    expect(fetchSucceeded).toBe(true);
    expect(index.get('t1')).toEqual({
      pbRecordId: 'rec-1',
      clientUpdatedAt: '2026-05-18T10:00:00.000Z',
    });
    expect(index.get('t2')?.pbRecordId).toBe('rec-2');
    expect(index.get('t2')?.clientUpdatedAt).toBe('2026-05-18T11:00:00.000Z');
  });

  it('falls back to an empty map and fetchSucceeded=false when PB throws', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getFullList: vi.fn(async () => {
          throw new Error('boom');
        }),
      }),
    });

    const { index, fetchSucceeded } = await fetchRemoteTaskIndex('user-1');
    expect(fetchSucceeded).toBe(false);
    expect(index.size).toBe(0);
  });
});

describe('escapeFilterValue', () => {
  it('escapes backslashes and double quotes', () => {
    expect(escapeFilterValue('hello "world"')).toBe('hello \\"world\\"');
    expect(escapeFilterValue('back\\slash')).toBe('back\\\\slash');
  });

  it('throws when value exceeds max length', () => {
    const longValue = 'a'.repeat(501);
    expect(() => escapeFilterValue(longValue)).toThrow('exceeds maximum length');
  });
});

describe('assertSafeRecordId', () => {
  it('accepts valid alphanumeric IDs', () => {
    expect(() => assertSafeRecordId('abc123')).not.toThrow();
    expect(() => assertSafeRecordId('user-1_test')).not.toThrow();
  });

  it('throws for empty strings', () => {
    expect(() => assertSafeRecordId('')).toThrow('unexpected length');
  });

  it('throws for strings exceeding 50 characters', () => {
    expect(() => assertSafeRecordId('a'.repeat(51))).toThrow('unexpected length');
  });

  it('throws for strings with unsafe characters', () => {
    expect(() => assertSafeRecordId('user"injection')).toThrow('unsafe characters');
    expect(() => assertSafeRecordId("user'id")).toThrow('unsafe characters');
    expect(() => assertSafeRecordId('a && b')).toThrow('unsafe characters');
  });
});
