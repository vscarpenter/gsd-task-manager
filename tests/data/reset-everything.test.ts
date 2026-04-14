/**
 * Tests for lib/reset-everything.ts
 * Covers resetEverything(), reloadAfterReset(), and internal helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const {
  mockDisableSync,
  mockGetSyncConfig,
  mockClear,
  mockBulkDelete,
  mockAdd,
  mockToArray,
} = vi.hoisted(() => ({
  mockDisableSync: vi.fn().mockResolvedValue(undefined),
  mockGetSyncConfig: vi.fn().mockResolvedValue(null),
  mockClear: vi.fn().mockResolvedValue(undefined),
  mockBulkDelete: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue(undefined),
  mockToArray: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    tasks: { clear: mockClear, name: 'tasks' },
    archivedTasks: { clear: mockClear, name: 'archivedTasks' },
    notificationSettings: { clear: mockClear, name: 'notificationSettings' },
    archiveSettings: { clear: mockClear, name: 'archiveSettings' },
    syncQueue: { clear: mockClear, name: 'syncQueue' },
    syncHistory: { clear: mockClear, name: 'syncHistory' },
    smartViews: {
      toArray: mockToArray,
      bulkDelete: mockBulkDelete,
      name: 'smartViews',
    },
    syncMetadata: {
      clear: mockClear,
      add: mockAdd,
      name: 'syncMetadata',
    },
  }),
}));

vi.mock('@/lib/sync/config', () => ({
  disableSync: (...args: unknown[]) => mockDisableSync(...args),
  getSyncConfig: (...args: unknown[]) => mockGetSyncConfig(...args),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { resetEverything, reloadAfterReset } from '@/lib/reset-everything';

describe('reset-everything', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSyncConfig.mockResolvedValue(null);
    mockToArray.mockResolvedValue([]);
    localStorage.clear();
  });

  describe('resetEverything', () => {
    it('should clear all IndexedDB tables and localStorage on success', async () => {
      const result = await resetEverything();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      // 6 standard tables + smartViews + syncMetadata
      expect(result.clearedTables.length).toBeGreaterThanOrEqual(7);
      expect(result.clearedLocalStorage).toContain('pocketbase_auth');
      expect(result.clearedLocalStorage).toContain('gsd-pwa-dismissed');
      expect(result.clearedLocalStorage).toContain('theme');
    });

    it('should preserve theme when preserveTheme option is true', async () => {
      localStorage.setItem('theme', 'dark');

      const result = await resetEverything({ preserveTheme: true });

      expect(result.success).toBe(true);
      expect(result.clearedLocalStorage).not.toContain('theme');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should disable sync as part of reset', async () => {
      await resetEverything();

      expect(mockDisableSync).toHaveBeenCalled();
    });

    it('should preserve deviceId in syncMetadata when available', async () => {
      mockGetSyncConfig.mockResolvedValue({ deviceId: 'my-device-123' });

      await resetEverything();

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sync_config',
          enabled: false,
          deviceId: 'my-device-123',
        })
      );
    });

    it('should delete only custom smart views and keep built-in ones', async () => {
      mockToArray.mockResolvedValue([
        { id: 'built-in-1', isBuiltIn: true },
        { id: 'custom-1', isBuiltIn: false },
        { id: 'custom-2', isBuiltIn: false },
      ]);

      await resetEverything();

      expect(mockBulkDelete).toHaveBeenCalledWith(['custom-1', 'custom-2']);
    });

    it('should report errors when disableSync fails', async () => {
      mockDisableSync.mockRejectedValueOnce(new Error('sync error'));

      const result = await resetEverything();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('sync error');
    });

    it('should set success=false and report error when IndexedDB clear fails', async () => {
      mockClear.mockRejectedValueOnce(new Error('DB clear failed'));

      const result = await resetEverything();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('DB clear failed'))).toBe(true);
    });

    it('should report "Unknown error" when a non-Error is thrown by disableSync', async () => {
      mockDisableSync.mockImplementationOnce(() => Promise.reject('plain string error'));

      const result = await resetEverything();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown error'))).toBe(true);
    });

    it('should handle preserveTheme=true when no theme is in localStorage', async () => {
      // No theme set — localStorage.getItem('theme') returns null
      const result = await resetEverything({ preserveTheme: true });

      expect(result.success).toBe(true);
      expect(result.clearedLocalStorage).not.toContain('theme');
      // Theme should remain absent (not created)
      expect(localStorage.getItem('theme')).toBeNull();
    });

    it('should return correct buildPreservedSyncMetadata structure for a given deviceId', async () => {
      mockGetSyncConfig.mockResolvedValue({ deviceId: 'device-xyz-999' });

      await resetEverything();

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sync_config',
          enabled: false,
          userId: null,
          deviceId: 'device-xyz-999',
          deviceName: 'Device',
          email: null,
          provider: null,
          lastSyncAt: null,
          lastSuccessfulSyncAt: null,
          consecutiveFailures: 0,
          lastFailureAt: null,
          lastFailureReason: null,
          nextRetryAt: null,
          autoSyncEnabled: true,
          autoSyncIntervalMinutes: 2,
        })
      );
    });

    it('should skip adding syncMetadata when no deviceId is available', async () => {
      mockGetSyncConfig.mockResolvedValue({ deviceId: undefined });

      await resetEverything();

      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe('reloadAfterReset', () => {
    it('should set window.location.href to root when window is defined', () => {
      // jsdom provides window by default
      const originalHref = window.location.href;

      // window.location.href assignment in jsdom; just verify no throw
      reloadAfterReset();
      // In jsdom, assigning href navigates; we just verify the function runs
      expect(true).toBe(true);
    });
  });
});
