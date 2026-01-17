import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/notifications';
import { getDb } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');

describe('Notification Settings', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      notificationSettings: {
        get: vi.fn(),
        put: vi.fn(),
      },
    };

    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
  });

  describe('getNotificationSettings', () => {
    it('should return existing settings from database', async () => {
      const existingSettings = {
        id: 'settings',
        enabled: true,
        defaultReminder: 15,
        soundEnabled: true,
        permissionAsked: true,
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockDb.notificationSettings.get.mockResolvedValue(existingSettings);

      const result = await getNotificationSettings();

      expect(mockDb.notificationSettings.get).toHaveBeenCalledWith('settings');
      expect(result).toEqual(existingSettings);
    });

    it('should create and return default settings when none exist', async () => {
      mockDb.notificationSettings.get.mockResolvedValue(null);
      mockDb.notificationSettings.put.mockResolvedValue(undefined);

      const result = await getNotificationSettings();

      expect(mockDb.notificationSettings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'settings',
          enabled: true,
          defaultReminder: 15,
          soundEnabled: true,
          permissionAsked: false,
        })
      );
      expect(result.enabled).toBe(true);
      expect(result.defaultReminder).toBe(15);
    });
  });

  describe('updateNotificationSettings', () => {
    it('should merge updates with current settings', async () => {
      const currentSettings = {
        id: 'settings',
        enabled: true,
        defaultReminder: 15,
        soundEnabled: true,
        permissionAsked: false,
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockDb.notificationSettings.get.mockResolvedValue(currentSettings);
      mockDb.notificationSettings.put.mockResolvedValue(undefined);

      await updateNotificationSettings({ enabled: false, soundEnabled: false });

      expect(mockDb.notificationSettings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          soundEnabled: false,
          defaultReminder: 15, // Unchanged
          permissionAsked: false, // Unchanged
        })
      );
    });

    it('should always set id to "settings"', async () => {
      const currentSettings = {
        id: 'settings',
        enabled: true,
        defaultReminder: 15,
        soundEnabled: true,
        permissionAsked: false,
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockDb.notificationSettings.get.mockResolvedValue(currentSettings);
      mockDb.notificationSettings.put.mockResolvedValue(undefined);

      await updateNotificationSettings({ enabled: false });

      expect(mockDb.notificationSettings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'settings',
        })
      );
    });

    it('should update updatedAt timestamp', async () => {
      const currentSettings = {
        id: 'settings',
        enabled: true,
        defaultReminder: 15,
        soundEnabled: true,
        permissionAsked: false,
        updatedAt: '2025-01-15T10:00:00Z',
      };

      mockDb.notificationSettings.get.mockResolvedValue(currentSettings);
      mockDb.notificationSettings.put.mockResolvedValue(undefined);

      await updateNotificationSettings({ enabled: false });

      const call = mockDb.notificationSettings.put.mock.calls[0][0];
      expect(call.updatedAt).toBeDefined();
      expect(call.updatedAt).not.toBe(currentSettings.updatedAt);
    });
  });
});
