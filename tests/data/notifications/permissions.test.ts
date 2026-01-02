import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isNotificationSupported,
  checkNotificationPermission,
  requestNotificationPermission,
  shouldAskForPermission,
  isInQuietHours,
} from '@/lib/notifications';

// Mock the settings functions at the correct import path
// Must use vi.fn() directly in factory due to hoisting
vi.mock('@/lib/notifications/settings', () => ({
  getNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

// Import mocked functions after mock is set up
import { getNotificationSettings, updateNotificationSettings } from '@/lib/notifications/settings';

describe('Notification Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isNotificationSupported', () => {
    it('should return false when window is undefined', () => {
      // @ts-expect-error - testing undefined window
      global.window = undefined;

      expect(isNotificationSupported()).toBe(false);
    });

    it('should return false when Notification is not in window', () => {
      global.window = {} as Window & typeof globalThis;

      expect(isNotificationSupported()).toBe(false);
    });

    it('should return true when Notification is available', () => {
      global.window = { Notification: vi.fn() } as unknown as Window & typeof globalThis;

      expect(isNotificationSupported()).toBe(true);
    });
  });

  describe('checkNotificationPermission', () => {
    it('should return "denied" when notifications not supported', () => {
      global.window = {} as Window & typeof globalThis;

      expect(checkNotificationPermission()).toBe('denied');
    });

    it('should return current permission when supported', () => {
      global.Notification = { permission: 'granted' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      expect(checkNotificationPermission()).toBe('granted');
    });

    it('should return "default" when permission not yet determined', () => {
      global.Notification = { permission: 'default' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      expect(checkNotificationPermission()).toBe('default');
    });
  });

  describe('requestNotificationPermission', () => {
    it('should return false when notifications not supported', async () => {
      global.window = {} as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(result).toBe(false);
    });

    it('should return true when permission already granted', async () => {
      global.Notification = { permission: 'granted' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(result).toBe(true);
    });

    it('should return false when permission already denied', async () => {
      global.Notification = { permission: 'denied' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(result).toBe(false);
    });

    it('should request permission and return true when granted', async () => {
      const requestPermissionMock = vi.fn().mockResolvedValue('granted');

      (getNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true, permissionAsked: false });
      (updateNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      global.Notification = {
        permission: 'default',
        requestPermission: requestPermissionMock,
      } as unknown as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(requestPermissionMock).toHaveBeenCalled();
      expect(updateNotificationSettings).toHaveBeenCalledWith(
        expect.objectContaining({ permissionAsked: true })
      );
      expect(result).toBe(true);
    });

    it('should request permission and return false when denied', async () => {
      const requestPermissionMock = vi.fn().mockResolvedValue('denied');

      (getNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true, permissionAsked: false });
      (updateNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      global.Notification = {
        permission: 'default',
        requestPermission: requestPermissionMock,
      } as unknown as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      const requestPermissionMock = vi.fn().mockRejectedValue(new Error('Permission error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.Notification = {
        permission: 'default',
        requestPermission: requestPermissionMock,
      } as unknown as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await requestNotificationPermission();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('shouldAskForPermission', () => {
    it('should return false when notifications not supported', async () => {
      global.window = {} as Window & typeof globalThis;

      const result = await shouldAskForPermission();

      expect(result).toBe(false);
    });

    it('should return false when permission already granted', async () => {
      global.Notification = { permission: 'granted' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await shouldAskForPermission();

      expect(result).toBe(false);
    });

    it('should return false when permission already denied', async () => {
      global.Notification = { permission: 'denied' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await shouldAskForPermission();

      expect(result).toBe(false);
    });

    it('should return false when permission was already asked', async () => {
      (getNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ permissionAsked: true });

      global.Notification = { permission: 'default' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await shouldAskForPermission();

      expect(result).toBe(false);
    });

    it('should return true when permission is default and not asked yet', async () => {
      (getNotificationSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ permissionAsked: false });

      global.Notification = { permission: 'default' } as typeof Notification;
      global.window = { Notification: global.Notification } as unknown as Window & typeof globalThis;

      const result = await shouldAskForPermission();

      expect(result).toBe(true);
    });
  });

  describe('isInQuietHours', () => {
    const setLocalTime = (hours: number, minutes: number) => {
      vi.setSystemTime(new Date(2025, 0, 15, hours, minutes));
    };

    beforeEach(() => {
      vi.useFakeTimers();
      // Mock current time to 14:30 (2:30 PM) local time
      setLocalTime(14, 30);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false when no quiet hours configured', () => {
      const result = isInQuietHours({});

      expect(result).toBe(false);
    });

    it('should return false when only start time configured', () => {
      const result = isInQuietHours({ quietHoursStart: '22:00' });

      expect(result).toBe(false);
    });

    it('should return false when only end time configured', () => {
      const result = isInQuietHours({ quietHoursEnd: '08:00' });

      expect(result).toBe(false);
    });

    it('should return true when current time is within quiet hours', () => {
      // Current time: 14:30, Quiet hours: 14:00 - 15:00
      const result = isInQuietHours({
        quietHoursStart: '14:00',
        quietHoursEnd: '15:00',
      });

      expect(result).toBe(true);
    });

    it('should return false when current time is before quiet hours', () => {
      // Current time: 14:30, Quiet hours: 15:00 - 16:00
      const result = isInQuietHours({
        quietHoursStart: '15:00',
        quietHoursEnd: '16:00',
      });

      expect(result).toBe(false);
    });

    it('should return false when current time is after quiet hours', () => {
      // Current time: 14:30, Quiet hours: 12:00 - 13:00
      const result = isInQuietHours({
        quietHoursStart: '12:00',
        quietHoursEnd: '13:00',
      });

      expect(result).toBe(false);
    });

    it('should handle overnight quiet hours correctly (inside range, after start)', () => {
      // Current time: 23:00, Quiet hours: 22:00 - 08:00
      setLocalTime(23, 0);

      const result = isInQuietHours({
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      expect(result).toBe(true);
    });

    it('should handle overnight quiet hours correctly (inside range, before end)', () => {
      // Current time: 07:00, Quiet hours: 22:00 - 08:00
      setLocalTime(7, 0);

      const result = isInQuietHours({
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      expect(result).toBe(true);
    });

    it('should handle overnight quiet hours correctly (outside range)', () => {
      // Current time: 10:00, Quiet hours: 22:00 - 08:00
      setLocalTime(10, 0);

      const result = isInQuietHours({
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      expect(result).toBe(false);
    });

    it('should handle edge case at exact start time', () => {
      // Current time: 22:00, Quiet hours: 22:00 - 08:00
      setLocalTime(22, 0);

      const result = isInQuietHours({
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      expect(result).toBe(true);
    });

    it('should handle edge case at exact end time', () => {
      // Current time: 08:00, Quiet hours: 22:00 - 08:00
      setLocalTime(8, 0);

      const result = isInQuietHours({
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      });

      expect(result).toBe(false); // End time is exclusive
    });
  });
});
