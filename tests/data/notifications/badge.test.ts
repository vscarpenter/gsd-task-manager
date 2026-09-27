import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isBadgeSupported, setAppBadge, clearAppBadge } from '@/lib/notifications';

describe('Notification Badge', () => {
  beforeEach(() => {
    // Reset navigator mock
    vi.clearAllMocks();
  });

  // Vitest 5 forwards global writes to jsdom, whose navigator is getter-only,
  // so tests stub it with vi.stubGlobal and restore the real one after each.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isBadgeSupported', () => {
    it('should return false when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined);

      expect(isBadgeSupported()).toBe(false);
    });

    it('should return false when setAppBadge is not available', () => {
      vi.stubGlobal('navigator', {});

      expect(isBadgeSupported()).toBe(false);
    });

    it('should return true when setAppBadge is available', () => {
      vi.stubGlobal('navigator', {
        setAppBadge: vi.fn(),
        clearAppBadge: vi.fn(),
      });

      expect(isBadgeSupported()).toBe(true);
    });
  });

  describe('setAppBadge', () => {
    it('should not call setAppBadge when not supported', async () => {
      vi.stubGlobal('navigator', {});

      await setAppBadge(5);

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should call navigator.setAppBadge with count when count > 0', async () => {
      const setAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        setAppBadge: setAppBadgeMock,
        clearAppBadge: vi.fn(),
      });

      await setAppBadge(5);

      expect(setAppBadgeMock).toHaveBeenCalledWith(5);
    });

    it('should call navigator.clearAppBadge when count is 0', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      });

      await setAppBadge(0);

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should call navigator.clearAppBadge when count is negative', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      });

      await setAppBadge(-1);

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const setAppBadgeMock = vi.fn().mockRejectedValue(new Error('Badge error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.stubGlobal('navigator', {
        setAppBadge: setAppBadgeMock,
        clearAppBadge: vi.fn(),
      });

      await setAppBadge(5);

      // Logger routes error through console.error with structured format
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NOTIFICATIONS]'),
        expect.objectContaining({ message: 'Error setting app badge' })
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearAppBadge', () => {
    it('should not call clearAppBadge when not supported', async () => {
      vi.stubGlobal('navigator', {});

      await clearAppBadge();

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should call navigator.clearAppBadge when supported', async () => {
      const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      });

      await clearAppBadge();

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const clearAppBadgeMock = vi.fn().mockRejectedValue(new Error('Clear badge error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.stubGlobal('navigator', {
        setAppBadge: vi.fn(),
        clearAppBadge: clearAppBadgeMock,
      });

      await clearAppBadge();

      // Logger routes error through console.error with structured format
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NOTIFICATIONS]'),
        expect.objectContaining({ message: 'Error clearing app badge' })
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
