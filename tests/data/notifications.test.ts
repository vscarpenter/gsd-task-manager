import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	isNotificationSupported,
	checkNotificationPermission,
	requestNotificationPermission,
	shouldAskForPermission,
	getNotificationSettings,
	updateNotificationSettings,
	showTaskNotification,
	isInQuietHours,
	showTestNotification,
	isBadgeSupported,
	setAppBadge,
	clearAppBadge,
} from "@/lib/notifications";
import type { TaskRecord, NotificationSettings } from "@/lib/types";
import { getDb } from "@/lib/db";

// Mock the database
vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

describe("Notifications module", () => {
	let mockDb: any;
	let mockNotificationConstructor: any;
	let mockNotificationInstance: any;

	beforeEach(() => {
		// Create mock database
		mockDb = {
			notificationSettings: {
				get: vi.fn(),
				put: vi.fn(),
			},
		};
		vi.mocked(getDb).mockReturnValue(mockDb);

		// Create mock notification instance with methods
		mockNotificationInstance = {
			close: vi.fn(),
			onclick: null,
		};

		// Mock Notification constructor - must be a proper constructor function
		mockNotificationConstructor = vi.fn(function Notification(title: string, options: any) {
			const instance = Object.create(mockNotificationInstance);
			instance.title = title;
			instance.options = options;
			return instance;
		});
		mockNotificationConstructor.permission = "default";
		mockNotificationConstructor.requestPermission = vi
			.fn()
			.mockResolvedValue("granted");

		// Set up global Notification
		global.Notification = mockNotificationConstructor as any;

		// Setup window
		global.window = {
			Notification: mockNotificationConstructor,
			focus: vi.fn(),
		} as any;

		// Mock navigator with service worker and badge API
		global.navigator = {
			serviceWorker: {
				ready: Promise.resolve({
					showNotification: vi.fn().mockResolvedValue(undefined),
				}),
			},
			setAppBadge: vi.fn().mockResolvedValue(undefined),
			clearAppBadge: vi.fn().mockResolvedValue(undefined),
		} as any;
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe("isNotificationSupported", () => {
		it("should return true when Notification API is available", () => {
			expect(isNotificationSupported()).toBe(true);
		});

		it("should return false when window is undefined", () => {
			global.window = undefined as any;
			expect(isNotificationSupported()).toBe(false);
		});

		it("should return false when Notification is not in window", () => {
			global.window = {} as any;
			expect(isNotificationSupported()).toBe(false);
		});
	});

	describe("checkNotificationPermission", () => {
		it("should return current permission status", () => {
			mockNotificationConstructor.permission = "granted";
			expect(checkNotificationPermission()).toBe("granted");

			mockNotificationConstructor.permission = "denied";
			expect(checkNotificationPermission()).toBe("denied");

			mockNotificationConstructor.permission = "default";
			expect(checkNotificationPermission()).toBe("default");
		});

		it("should return 'denied' when notifications not supported", () => {
			global.window = undefined as any;
			expect(checkNotificationPermission()).toBe("denied");
		});
	});

	describe("requestNotificationPermission", () => {
		it("should return true if permission already granted", async () => {
			mockNotificationConstructor.permission = "granted";

			const result = await requestNotificationPermission();

			expect(result).toBe(true);
			expect(
				mockNotificationConstructor.requestPermission,
			).not.toHaveBeenCalled();
		});

		it("should return false if permission already denied", async () => {
			mockNotificationConstructor.permission = "denied";

			const result = await requestNotificationPermission();

			expect(result).toBe(false);
			expect(
				mockNotificationConstructor.requestPermission,
			).not.toHaveBeenCalled();
		});

		it("should request permission when status is default", async () => {
			mockNotificationConstructor.permission = "default";
			mockNotificationConstructor.requestPermission.mockResolvedValue(
				"granted",
			);

			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: new Date().toISOString(),
			});

			const result = await requestNotificationPermission();

			expect(result).toBe(true);
			expect(mockNotificationConstructor.requestPermission).toHaveBeenCalled();
			expect(mockDb.notificationSettings.put).toHaveBeenCalledWith(
				expect.objectContaining({ permissionAsked: true }),
			);
		});

		it("should return false when user denies permission", async () => {
			mockNotificationConstructor.permission = "default";
			mockNotificationConstructor.requestPermission.mockResolvedValue("denied");

			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: new Date().toISOString(),
			});

			const result = await requestNotificationPermission();

			expect(result).toBe(false);
		});

		it("should return false when notifications not supported", async () => {
			global.window = undefined as any;

			const result = await requestNotificationPermission();

			expect(result).toBe(false);
		});

		it("should handle errors gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			mockNotificationConstructor.permission = "default";
			mockNotificationConstructor.requestPermission.mockRejectedValue(
				new Error("Permission denied"),
			);

			const result = await requestNotificationPermission();

			expect(result).toBe(false);
			expect(consoleErrorSpy).toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});
	});

	describe("shouldAskForPermission", () => {
		it("should return false when notifications not supported", async () => {
			global.window = undefined as any;

			const result = await shouldAskForPermission();

			expect(result).toBe(false);
		});

		it("should return false when permission already granted", async () => {
			mockNotificationConstructor.permission = "granted";

			const result = await shouldAskForPermission();

			expect(result).toBe(false);
		});

		it("should return false when permission already denied", async () => {
			mockNotificationConstructor.permission = "denied";

			const result = await shouldAskForPermission();

			expect(result).toBe(false);
		});

		it("should return false when permission already asked", async () => {
			mockNotificationConstructor.permission = "default";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				permissionAsked: true,
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				updatedAt: new Date().toISOString(),
			});

			const result = await shouldAskForPermission();

			expect(result).toBe(false);
		});

		it("should return true when permission is default and not asked yet", async () => {
			mockNotificationConstructor.permission = "default";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				permissionAsked: false,
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				updatedAt: new Date().toISOString(),
			});

			const result = await shouldAskForPermission();

			expect(result).toBe(true);
		});
	});

	describe("getNotificationSettings", () => {
		it("should return existing settings from database", async () => {
			const existingSettings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 30,
				soundEnabled: false,
				permissionAsked: true,
				updatedAt: "2025-01-15T12:00:00Z",
			};
			mockDb.notificationSettings.get.mockResolvedValue(existingSettings);

			const settings = await getNotificationSettings();

			expect(settings).toEqual(existingSettings);
			expect(mockDb.notificationSettings.get).toHaveBeenCalledWith("settings");
		});

		it("should create default settings when none exist", async () => {
			mockDb.notificationSettings.get.mockResolvedValue(null);
			mockDb.notificationSettings.put.mockResolvedValue(undefined);

			const settings = await getNotificationSettings();

			expect(settings.id).toBe("settings");
			expect(settings.enabled).toBe(true);
			expect(settings.defaultReminder).toBe(15);
			expect(settings.soundEnabled).toBe(true);
			expect(settings.permissionAsked).toBe(false);
			expect(mockDb.notificationSettings.put).toHaveBeenCalled();
		});
	});

	describe("updateNotificationSettings", () => {
		it("should merge updates with existing settings", async () => {
			const existingSettings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: "2025-01-15T12:00:00Z",
			};
			mockDb.notificationSettings.get.mockResolvedValue(existingSettings);

			await updateNotificationSettings({
				enabled: false,
				defaultReminder: 30,
			});

			expect(mockDb.notificationSettings.put).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "settings",
					enabled: false,
					defaultReminder: 30,
					soundEnabled: true, // Unchanged
					permissionAsked: false, // Unchanged
				}),
			);
		});

		it("should always use 'settings' as ID", async () => {
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: "2025-01-15T12:00:00Z",
			});

			await updateNotificationSettings({
				id: "different-id" as any,
			});

			const savedSettings = mockDb.notificationSettings.put.mock.calls[0][0];
			expect(savedSettings.id).toBe("settings");
		});

		it("should update timestamp", async () => {
			const oldTimestamp = "2025-01-10T12:00:00Z";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: oldTimestamp,
			});

			await updateNotificationSettings({ enabled: false });

			const savedSettings = mockDb.notificationSettings.put.mock.calls[0][0];
			expect(savedSettings.updatedAt).not.toBe(oldTimestamp);
		});
	});

	describe("showTaskNotification", () => {
		const createTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
			id: "task-1",
			title: "Test Task",
			description: "Task description",
			urgent: false,
			important: false,
			quadrant: "not-urgent-not-important",
			completed: false,
			dueDate: new Date(Date.now() + 3600000).toISOString(),
			recurrence: "none",
			tags: [],
			subtasks: [],
			dependencies: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			notificationEnabled: true,
			notificationSent: false,
			...overrides,
		});

		it("should not show notification when not supported", async () => {
			global.window = undefined as any;
			const task = createTask();

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).not.toHaveBeenCalled();
		});

		it("should not show notification without permission", async () => {
			mockNotificationConstructor.permission = "denied";
			const task = createTask();

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).not.toHaveBeenCalled();
		});

		it("should not show notification when settings disabled", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: false, // Disabled
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const task = createTask();

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).not.toHaveBeenCalled();
		});

		it("should not show notification when task notification disabled", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const task = createTask({ notificationEnabled: false });

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).not.toHaveBeenCalled();
		});

		it("should not show notification when task is snoozed", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const futureTime = new Date(Date.now() + 3600000).toISOString();
			const task = createTask({ snoozedUntil: futureTime });

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).not.toHaveBeenCalled();
		});

		it("should show notification via service worker when available", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const task = createTask({ title: "Important Task" });

			const mockShowNotification = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(global.navigator, 'serviceWorker', {
				value: {
					ready: Promise.resolve({
						showNotification: mockShowNotification,
					} as any),
				} as any,
				writable: true,
				configurable: true,
			});

			await showTaskNotification(task, 15);

			expect(mockShowNotification).toHaveBeenCalledWith(
				expect.stringContaining("Important Task"),
				expect.objectContaining({
					body: "Task description",
					tag: "task-task-1",
				}),
			);
		});

		it("should show notification via Notification constructor as fallback", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: false,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const task = createTask({ title: "Test Task" });

			// No service worker
			Object.defineProperty(global.navigator, 'serviceWorker', {
				value: undefined as any,
				writable: true,
				configurable: true,
			});

			await showTaskNotification(task, 15);

			expect(mockNotificationConstructor).toHaveBeenCalledWith(
				expect.stringContaining("Test Task"),
				expect.objectContaining({
					body: "Task description",
					tag: "task-task-1",
					silent: true, // soundEnabled is false
				}),
			);
		});

		it("should format notification title based on time until due", async () => {
			mockNotificationConstructor.permission = "granted";
			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			});
			const task = createTask({ title: "Task" });

			// No service worker to test Notification constructor
			Object.defineProperty(global.navigator, 'serviceWorker', {
				value: undefined as any,
				writable: true,
				configurable: true,
			});

			// Due now
			await showTaskNotification(task, 0);
			expect(mockNotificationConstructor).toHaveBeenLastCalledWith(
				"Due now: Task",
				expect.any(Object),
			);

			// Due in minutes
			mockNotificationConstructor.mockClear();
			await showTaskNotification(task, 30);
			expect(mockNotificationConstructor).toHaveBeenLastCalledWith(
				"Due in 30 min: Task",
				expect.any(Object),
			);

			// Due in hours
			mockNotificationConstructor.mockClear();
			await showTaskNotification(task, 120);
			expect(mockNotificationConstructor).toHaveBeenLastCalledWith(
				"Due in 2h: Task",
				expect.any(Object),
			);

			// Due in days
			mockNotificationConstructor.mockClear();
			await showTaskNotification(task, 1440);
			expect(mockNotificationConstructor).toHaveBeenLastCalledWith(
				"Due in 1d: Task",
				expect.any(Object),
			);
		});
	});

	describe("isInQuietHours", () => {
		it("should return false when quiet hours not configured", () => {
			const settings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			};

			expect(isInQuietHours(settings)).toBe(false);
		});

		it("should return true when current time is within quiet hours", () => {
			const settings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				quietHoursStart: "22:00",
				quietHoursEnd: "08:00",
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			};

			// Mock current time to be 23:00 local time (within 22:00-08:00)
			vi.useFakeTimers();
			const testDate = new Date();
			testDate.setHours(23, 0, 0, 0);
			vi.setSystemTime(testDate);

			expect(isInQuietHours(settings)).toBe(true);

			vi.useRealTimers();
		});

		it("should handle overnight quiet hours", () => {
			const settings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				quietHoursStart: "22:00",
				quietHoursEnd: "08:00",
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			};

			vi.useFakeTimers();

			// Test at 01:00 local time (should be quiet)
			let testDate = new Date();
			testDate.setHours(1, 0, 0, 0);
			vi.setSystemTime(testDate);
			expect(isInQuietHours(settings)).toBe(true);

			// Test at 07:00 local time (should be quiet)
			testDate = new Date();
			testDate.setHours(7, 0, 0, 0);
			vi.setSystemTime(testDate);
			expect(isInQuietHours(settings)).toBe(true);

			// Test at 10:00 local time (should not be quiet)
			testDate = new Date();
			testDate.setHours(10, 0, 0, 0);
			vi.setSystemTime(testDate);
			expect(isInQuietHours(settings)).toBe(false);

			vi.useRealTimers();
		});

		it("should handle normal quiet hours", () => {
			const settings: NotificationSettings = {
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				quietHoursStart: "13:00",
				quietHoursEnd: "14:00",
				permissionAsked: true,
				updatedAt: new Date().toISOString(),
			};

			vi.useFakeTimers();

			// Test at 13:30 local time (should be quiet)
			let testDate = new Date();
			testDate.setHours(13, 30, 0, 0);
			vi.setSystemTime(testDate);
			expect(isInQuietHours(settings)).toBe(true);

			// Test at 14:30 local time (should not be quiet)
			testDate = new Date();
			testDate.setHours(14, 30, 0, 0);
			vi.setSystemTime(testDate);
			expect(isInQuietHours(settings)).toBe(false);

			vi.useRealTimers();
		});
	});

	describe("showTestNotification", () => {
		it("should request permission if not granted", async () => {
			mockNotificationConstructor.permission = "default";
			mockNotificationConstructor.requestPermission.mockResolvedValue(
				"granted",
			);

			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: new Date().toISOString(),
			});

			await showTestNotification();

			expect(mockNotificationConstructor.requestPermission).toHaveBeenCalled();
		});

		it("should show test notification when permission granted", async () => {
			mockNotificationConstructor.permission = "granted";

			const result = await showTestNotification();

			expect(result).toBe(true);
			expect(mockNotificationConstructor).toHaveBeenCalledWith(
				"Test Notification",
				expect.objectContaining({
					body: "Your notifications are working correctly!",
					tag: "test-notification",
				}),
			);
		});

		it("should return false when permission denied", async () => {
			mockNotificationConstructor.permission = "default";
			mockNotificationConstructor.requestPermission.mockResolvedValue("denied");

			mockDb.notificationSettings.get.mockResolvedValue({
				id: "settings",
				enabled: true,
				defaultReminder: 15,
				soundEnabled: true,
				permissionAsked: false,
				updatedAt: new Date().toISOString(),
			});

			const result = await showTestNotification();

			expect(result).toBe(false);
		});
	});

	describe("isBadgeSupported", () => {
		it("should return true when Badge API is available", () => {
			expect(isBadgeSupported()).toBe(true);
		});

		it("should return false when navigator is undefined", () => {
			global.navigator = undefined as any;
			expect(isBadgeSupported()).toBe(false);
		});

		it("should return false when setAppBadge is not available", () => {
			global.navigator = {} as any;
			expect(isBadgeSupported()).toBe(false);
		});
	});

	describe("setAppBadge", () => {
		it("should set badge when count > 0", async () => {
			const setAppBadgeMock = vi.fn().mockResolvedValue(undefined);
			global.navigator.setAppBadge = setAppBadgeMock;

			await setAppBadge(5);

			expect(setAppBadgeMock).toHaveBeenCalledWith(5);
		});

		it("should clear badge when count = 0", async () => {
			const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
			global.navigator.clearAppBadge = clearAppBadgeMock;

			await setAppBadge(0);

			expect(clearAppBadgeMock).toHaveBeenCalled();
		});

		it("should do nothing when badge API not supported", async () => {
			global.navigator = {} as any;

			await expect(setAppBadge(5)).resolves.not.toThrow();
		});

		it("should handle errors gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const setAppBadgeMock = vi
				.fn()
				.mockRejectedValue(new Error("Badge error"));
			global.navigator.setAppBadge = setAppBadgeMock;

			await setAppBadge(5);

			expect(consoleErrorSpy).toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});
	});

	describe("clearAppBadge", () => {
		it("should call clearAppBadge API", async () => {
			const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
			global.navigator.clearAppBadge = clearAppBadgeMock;

			await clearAppBadge();

			expect(clearAppBadgeMock).toHaveBeenCalled();
		});

		it("should do nothing when badge API not supported", async () => {
			global.navigator = {} as any;

			await expect(clearAppBadge()).resolves.not.toThrow();
		});

		it("should handle errors gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const clearAppBadgeMock = vi
				.fn()
				.mockRejectedValue(new Error("Badge error"));
			global.navigator.clearAppBadge = clearAppBadgeMock;

			await clearAppBadge();

			expect(consoleErrorSpy).toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});
	});
});
