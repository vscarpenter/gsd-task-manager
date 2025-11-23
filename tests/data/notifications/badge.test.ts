import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isBadgeSupported, setAppBadge, clearAppBadge } from '@/lib/notifications';

describe('Notification Badge', () => {
  beforeEach(() => {
    // Reset navigator mock
    vi.clearAllMocks();
  });

  describe('isBadgeSupported', () => {
    it('should return false when navigator is undefined', () => {
      // @ts-expect-error - testing undefined navigator
      global.navigator = undefined;

      expect(isBadgeSupported()).toBe(false);
    });

    it('should return false when setAppBadge is not available', () => {
      global.navigator = {} as Navigator;

      expect(isBadgeSupported()).toBe(false);
    });

    it('should return true when setAppBadge is available', () => {
      global.navigator = {
        setAppBadge: vi.fn(),
        clearAppBadge: vi.fn(),
      } as unknown as Navigator;

      expect(isBadgeSupported()).toBe(true);
    });
  });

  describe('setAppBadge', () => {
    it('should not call setAppBadge when not supported', async () => {
      global.navigator = {} as Navigator;

      await setAppBadge(5);

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should call navigator.setAppBadge with count when count > 0', async () => {
      const setAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      global.navigator = {
        setAppBadge: setAppBadgeMock,
        clearAppBadge: vi.fn(),
      } as unknown as Navigator;

      await setAppBadge(5);

      expect(setAppBadgeMock).toHaveBeenCalledWith(5);
    });

    it('should call navigator.clearAppBadge when count is 0', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      global.navigator = {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      } as unknown as Navigator;

      await setAppBadge(0);

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should call navigator.clearAppBadge when count is negative', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      global.navigator = {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      } as unknown as Navigator;

      await setAppBadge(-1);

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const setAppBadgeMock = vi.fn().mockRejectedValue(new Error('Badge error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.navigator = {
        setAppBadge: setAppBadgeMock,
        clearAppBadge: vi.fn(),
      } as unknown as Navigator;

      await setAppBadge(5);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error setting app badge:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearAppBadge', () => {
    it('should not call clearAppBadge when not supported', async () => {
      global.navigator = {} as Navigator;

      await clearAppBadge();

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should call navigator.clearAppBadge when supported', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      global.navigator = {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      } as unknown as Navigator;

      await clearAppBadge();

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const clearAppBadgeMock = vi.fn().mockRejectedValue(new Error('Clear badge error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.navigator = {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      } as unknown as Navigator;

      await clearAppBadge();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error clearing app badge:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
