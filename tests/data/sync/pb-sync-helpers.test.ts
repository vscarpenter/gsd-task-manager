import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
}));

import {
  fetchBoundedRemoteTasks,
  fetchRemoteTaskIndex,
  escapeFilterValue,
  assertSafeRecordId,
  isRemoteNewerThanArchive,
} from '@/lib/sync/pb-sync-helpers';
import { getPocketBase } from '@/lib/sync/pocketbase-client';

describe('fetchRemoteTaskIndex', () => {
  it('returns task_id -> { pbRecordId, clientUpdatedAt } map', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => [
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
        getList: vi.fn(async () => {
          throw new Error('boom');
        }),
      }),
    });

    const { index, fetchSucceeded } = await fetchRemoteTaskIndex('user-1');
    expect(fetchSucceeded).toBe(false);
    expect(index.size).toBe(0);
  });

  it.each([
    [{ id: 'rec-1', task_id: 't1' }],
    [
      { id: 'rec-1', task_id: 't1', client_updated_at: '2026-05-18T10:00:00.000Z' },
      { id: 'rec-2', task_id: 't1', client_updated_at: '2026-05-18T11:00:00.000Z' },
    ],
  ])('marks malformed or duplicate rows as an incomplete index', async (items) => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ getList: vi.fn(async () => items) }),
    });

    const result = await fetchRemoteTaskIndex('user-1');
    expect(result.fetchSucceeded).toBe(false);
    expect(result.index.size).toBe(0);
  });
});

describe('fetchBoundedRemoteTasks', () => {
  it('paginates with stable options and returns only after every page succeeds', async () => {
    const getList = vi.fn()
      .mockResolvedValueOnce({
        page: 1, perPage: 200, totalPages: 2, totalItems: 2,
        items: [{ id: 'rec-1' }],
      })
      .mockResolvedValueOnce({
        page: 2, perPage: 200, totalPages: 2, totalItems: 2,
        items: [{ id: 'rec-2' }],
      });
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ getList }),
    });
    const options = { filter: 'owner = "user-1"', sort: 'task_id,id', fields: 'id' };

    await expect(fetchBoundedRemoteTasks(options)).resolves.toEqual([
      { id: 'rec-1' },
      { id: 'rec-2' },
    ]);
    expect(getList).toHaveBeenNthCalledWith(1, 1, 200, options);
    expect(getList).toHaveBeenNthCalledWith(2, 2, 200, options);
  });

  it('rejects an oversized collection before materializing its items', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => ({
          page: 1, perPage: 200, totalPages: 51, totalItems: 10_001, items: [],
        })),
      }),
    });

    await expect(fetchBoundedRemoteTasks({
      filter: 'owner = "user-1"',
      sort: 'task_id,id',
    })).rejects.toThrow(/exceeds/);
  });

  it('rejects changing totals without returning partial data', async () => {
    const getList = vi.fn()
      .mockResolvedValueOnce({
        page: 1, perPage: 200, totalPages: 2, totalItems: 2, items: [{ id: 'rec-1' }],
      })
      .mockResolvedValueOnce({
        page: 2, perPage: 200, totalPages: 2, totalItems: 3, items: [{ id: 'rec-2' }],
      });
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({ getList }),
    });

    await expect(fetchBoundedRemoteTasks({
      filter: 'owner = "user-1"',
      sort: 'task_id,id',
    })).rejects.toThrow(/changed during pagination/);
  });

  it('rejects a truncated final page before returning a partial collection', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => ({
          page: 1,
          perPage: 200,
          totalPages: 1,
          totalItems: 2,
          items: [{ id: 'rec-1' }],
        })),
      }),
    });

    await expect(fetchBoundedRemoteTasks({
      filter: 'owner = "user-1"',
      sort: 'task_id,id',
    })).rejects.toThrow(/cardinality is inconsistent/);
  });

  it('rejects a response whose page does not match the requested page', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => ({
          page: 2,
          perPage: 200,
          totalPages: 2,
          totalItems: 1,
          items: [{ id: 'rec-1' }],
        })),
      }),
    });

    await expect(fetchBoundedRemoteTasks({
      filter: 'owner = "user-1"',
      sort: 'task_id,id',
    })).rejects.toThrow(/pagination metadata is malformed/);
  });

  it('rejects an empty nonterminal page instead of looping', async () => {
    (getPocketBase as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        getList: vi.fn(async () => ({
          page: 1,
          perPage: 200,
          totalPages: 2,
          totalItems: 1,
          items: [],
        })),
      }),
    });

    await expect(fetchBoundedRemoteTasks({
      filter: 'owner = "user-1"',
      sort: 'task_id,id',
    })).rejects.toThrow(/made no progress/);
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

describe('isRemoteNewerThanArchive', () => {
  const archivedAt = '2026-05-19T00:00:00.000Z';

  it('is true only when the remote edit strictly post-dates the archive', () => {
    expect(isRemoteNewerThanArchive('2026-05-20T00:00:00.000Z', archivedAt)).toBe(true);
    expect(isRemoteNewerThanArchive('2026-05-18T00:00:00.000Z', archivedAt)).toBe(false);
    // Equal timestamps must not resurrect: the archive is the later decision.
    expect(isRemoteNewerThanArchive(archivedAt, archivedAt)).toBe(false);
  });

  it('compares instants, not strings, across timezone offsets', () => {
    // 2026-05-19T02:00+04:00 is 22:00 on the 18th UTC — older despite sorting later.
    expect(isRemoteNewerThanArchive('2026-05-19T02:00:00.000+04:00', archivedAt)).toBe(false);
    expect(isRemoteNewerThanArchive('2026-05-19T02:00:00.000-04:00', archivedAt)).toBe(true);
  });

  it('refuses to resurrect on missing or unparseable timestamps', () => {
    // An unprovable claim must leave the archive standing.
    expect(isRemoteNewerThanArchive(undefined, archivedAt)).toBe(false);
    expect(isRemoteNewerThanArchive('2026-05-20T00:00:00.000Z', undefined)).toBe(false);
    expect(isRemoteNewerThanArchive('not-a-date', archivedAt)).toBe(false);
    expect(isRemoteNewerThanArchive('2026-05-20T00:00:00.000Z', 'not-a-date')).toBe(false);
  });
});
