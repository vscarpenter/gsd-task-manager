import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateSettings, updateSettings, cleanupOldRecords } from '@/lib/db-helpers';

// Mock the db module
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

describe('db-helpers', () => {
  describe('getOrCreateSettings', () => {
    it('should return existing record when found', async () => {
      const existing = { id: 'settings', value: 'existing' };
      const mockTable = {
        get: vi.fn().mockResolvedValue(existing),
        add: vi.fn(),
      };

      const result = await getOrCreateSettings(
        mockTable as never,
        'settings',
        { id: 'settings', value: 'default' }
      );

      expect(result).toBe(existing);
      expect(mockTable.add).not.toHaveBeenCalled();
    });

    it('should create and return defaults when record not found', async () => {
      const defaults = { id: 'settings', value: 'default' };
      const mockTable = {
        get: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue('settings'),
      };

      const result = await getOrCreateSettings(
        mockTable as never,
        'settings',
        defaults
      );

      expect(result).toBe(defaults);
      expect(mockTable.add).toHaveBeenCalledWith(defaults);
    });
  });

  describe('updateSettings', () => {
    it('should merge updates, validate, and save', async () => {
      const current = { id: 'settings', value: 'old', updatedAt: '2024-01-01T00:00:00.000Z' };
      const mockTable = {
        put: vi.fn().mockResolvedValue('settings'),
      };
      const mockSchema = {
        parse: vi.fn((data: Record<string, unknown>) => data),
      };

      await updateSettings(
        mockTable as never,
        'settings',
        async () => current,
        { value: 'new' },
        mockSchema as never
      );

      expect(mockSchema.parse).toHaveBeenCalled();
      const parsedArg = mockSchema.parse.mock.calls[0][0];
      expect(parsedArg.value).toBe('new');
      expect(parsedArg.id).toBe('settings');
      expect(mockTable.put).toHaveBeenCalled();
    });

    it('should preserve the ID even if updates try to change it', async () => {
      const current = { id: 'settings', value: 'old' };
      const mockTable = { put: vi.fn() };
      const mockSchema = { parse: vi.fn((data: Record<string, unknown>) => data) };

      await updateSettings(
        mockTable as never,
        'settings',
        async () => current,
        { id: 'hacked' } as never,
        mockSchema as never
      );

      const parsedArg = mockSchema.parse.mock.calls[0][0];
      expect(parsedArg.id).toBe('settings');
    });
  });

  describe('cleanupOldRecords', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should return 0 when count is within limit', async () => {
      const { getDb } = await import('@/lib/db');
      const mockTable = {
        count: vi.fn().mockResolvedValue(5),
        orderBy: vi.fn(),
      };
      vi.mocked(getDb).mockReturnValue({
        syncHistory: mockTable,
      } as never);

      const deleted = await cleanupOldRecords('syncHistory', 'timestamp', 10);
      expect(deleted).toBe(0);
    });

    it('should delete oldest records when count exceeds limit', async () => {
      const { getDb } = await import('@/lib/db');
      const oldRecords = [
        { id: 'old-1' },
        { id: 'old-2' },
      ];
      const mockTable = {
        count: vi.fn().mockResolvedValue(12),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(oldRecords),
          }),
        }),
        bulkDelete: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getDb).mockReturnValue({
        syncHistory: mockTable,
      } as never);

      const deleted = await cleanupOldRecords('syncHistory', 'timestamp', 10);

      expect(deleted).toBe(2);
      expect(mockTable.bulkDelete).toHaveBeenCalledWith(['old-1', 'old-2']);
    });
  });
});
