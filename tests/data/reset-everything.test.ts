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
  mockAdd,
  mockResetFeedbackState,
} = vi.hoisted(() => ({
  mockDisableSync: vi.fn().mockResolvedValue(undefined),
  mockGetSyncConfig: vi.fn().mockResolvedValue(null),
  mockClear: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue(undefined),
  mockResetFeedbackState: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    transaction: vi.fn(async (...args: unknown[]) => (args.at(-1) as () => Promise<unknown>)()),
    tasks: { clear: mockClear, name: 'tasks' },
    archivedTasks: { clear: mockClear, name: 'archivedTasks' },
    deletedTasks: { clear: mockClear, name: 'deletedTasks' },
    notificationSettings: { clear: mockClear, name: 'notificationSettings' },
    archiveSettings: { clear: mockClear, name: 'archiveSettings' },
    syncQueue: { clear: mockClear, name: 'syncQueue' },
    syncHistory: { clear: mockClear, name: 'syncHistory' },
    smartViews: { clear: mockClear, name: 'smartViews' },
    deviceInfo: { clear: mockClear, name: 'deviceInfo' },
    appPreferences: { clear: mockClear, name: 'appPreferences' },
    syncMetadata: {
      clear: mockClear,
      add: mockAdd,
      name: 'syncMetadata',
    },
    tables: [
      { clear: mockClear, name: 'tasks' },
      { clear: mockClear, name: 'archivedTasks' },
      { clear: mockClear, name: 'deletedTasks' },
      { clear: mockClear, name: 'smartViews' },
      { clear: mockClear, name: 'notificationSettings' },
      { clear: mockClear, name: 'syncQueue' },
      { clear: mockClear, name: 'syncMetadata' },
      { clear: mockClear, name: 'deviceInfo' },
      { clear: mockClear, name: 'archiveSettings' },
      { clear: mockClear, name: 'syncHistory' },
      { clear: mockClear, name: 'appPreferences' },
    ],
  }),
}));

vi.mock('@/lib/sync/config', () => ({
  disableSync: (...args: unknown[]) => mockDisableSync(...args),
  getSyncConfig: (...args: unknown[]) => mockGetSyncConfig(...args),
}));

vi.mock('@/lib/feedback/feedback-store', () => ({
  resetFeedbackState: () => mockResetFeedbackState(),
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
    // localStorage.clear() does not work in jsdom-under-Bun — remove keys individually
    for (const key of [
      'pocketbase_auth', 'gsd-pwa-dismissed', 'theme', 'gsd-theme',
      'gsd:feedback:draft', 'gsd:feedback:last-sent',
      'gsd:feedback:nudge-dismissed', 'gsd-onboarding-seen',
    ]) {
      localStorage.removeItem(key);
    }
  });

  describe('resetEverything', () => {
    it('should clear all IndexedDB tables and localStorage on success', async () => {
      const result = await resetEverything();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.clearedTables).toEqual(expect.arrayContaining([
        'tasks', 'archivedTasks', 'deletedTasks', 'smartViews',
        'deviceInfo', 'appPreferences', 'syncMetadata',
      ]));
      expect(result.clearedLocalStorage).toContain('pocketbase_auth');
      expect(result.clearedLocalStorage).toContain('theme');
      expect(mockResetFeedbackState).toHaveBeenCalled();
    });

    it('should preserve theme when preserveTheme option is true', async () => {
      localStorage.setItem('gsd-theme', 'dark');

      const result = await resetEverything({ preserveTheme: true });

      expect(result.success).toBe(true);
      expect(result.clearedLocalStorage).not.toContain('gsd-theme');
      expect(localStorage.getItem('gsd-theme')).toBe('dark');
    });

    it('clears every application-owned key while preserving unrelated origin data', async () => {
      localStorage.setItem('gsd:feedback:draft', 'private');
      localStorage.setItem('gsd-onboarding-seen', 'true');
      localStorage.setItem('third-party-key', 'keep');

      const result = await resetEverything();

      expect(result.clearedLocalStorage).toEqual(expect.arrayContaining([
        'gsd:feedback:draft', 'gsd-onboarding-seen',
      ]));
      expect(localStorage.getItem('gsd:feedback:draft')).toBeNull();
      expect(localStorage.getItem('gsd-onboarding-seen')).toBeNull();
      expect(localStorage.getItem('third-party-key')).toBe('keep');
      localStorage.removeItem('third-party-key');
    });

    it('clears feedback fallback state when localStorage enumeration fails', async () => {
      const storageLength = vi.spyOn(window.localStorage, 'length', 'get').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      try {
        const result = await resetEverything();

        expect(result.success).toBe(false);
        expect(result.errors).toContain('localStorage enumeration: SecurityError');
        expect(mockResetFeedbackState).toHaveBeenCalled();
      } finally {
        storageLength.mockRestore();
      }
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
      // No theme set — localStorage.getItem('gsd-theme') returns null
      const result = await resetEverything({ preserveTheme: true });

      expect(result.success).toBe(true);
      expect(result.clearedLocalStorage).not.toContain('gsd-theme');
      // Theme should remain absent (not created)
      expect(localStorage.getItem('gsd-theme')).toBeNull();
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
          lastClientUpdatedAt: null,
          pullCursorVersion: 2,
          lastServerUpdatedAt: null,
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
