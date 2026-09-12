import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	notificationChecker,
	resetTaskNotification,
	snoozeTaskNotification,
	getDueSoonCount,
} from "@/lib/notification-checker";
import type { TaskRecord, NotificationSettings } from "@/lib/types";
import { getDb } from "@/lib/db";
import * as notifications from "@/lib/notifications";
import { NOTIFICATION_TIMING } from "@/lib/constants";

// Mock the database
vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

// Mock the notifications module
vi.mock("@/lib/notifications", () => ({
	isNotificationSupported: vi.fn(),
	checkNotificationPermission: vi.fn(),
	getNotificationSettings: vi.fn(),
	isInQuietHours: vi.fn(),
	showTaskNotification: vi.fn(),
	setAppBadge: vi.fn(),
}));

describe("NotificationChecker", () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let mockDb: any;
	let mockTasks: TaskRecord[];

	const createTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
		id: `task-${Date.now()}-${Math.random()}`,
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

	const createSettings = (
		overrides: Partial<NotificationSettings> = {},
	): NotificationSettings => ({
		id: "settings",
		enabled: true,
		defaultReminder: 15,
		soundEnabled: true,
		permissionAsked: true,
		updatedAt: new Date().toISOString(),
		...overrides,
	});

	beforeEach(() => {
		mockTasks = [];

		// Create mock database
		mockDb = {
			tasks: {
				filter: vi.fn().mockReturnThis(),
				toArray: vi.fn().mockResolvedValue(mockTasks),
				get: vi.fn(),
				put: vi.fn(),
			},
		};
		vi.mocked(getDb).mockReturnValue(mockDb);

		// Setup default mocks for notifications module
		vi.mocked(notifications.isNotificationSupported).mockReturnValue(true);
		vi.mocked(notifications.checkNotificationPermission).mockReturnValue(
			"granted",
		);
		vi.mocked(notifications.getNotificationSettings).mockResolvedValue(
			createSettings(),
		);
		vi.mocked(notifications.isInQuietHours).mockReturnValue(false);
		vi.mocked(notifications.showTaskNotification).mockResolvedValue();
		vi.mocked(notifications.setAppBadge).mockResolvedValue();

		// Use fake timers
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		notificationChecker.stop();
		// Reset the singleton's internal state by accessing private properties
		// This is necessary because the checker is a singleton
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(notificationChecker as any).lastCheck = null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(notificationChecker as any).isChecking = false;
	});

	describe("checkAndNotify", () => {
		it("should skip when notifications not supported", async () => {
			vi.mocked(notifications.isNotificationSupported).mockReturnValue(false);

			await notificationChecker.checkAndNotify();

			expect(notifications.checkNotificationPermission).not.toHaveBeenCalled();
			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip when permission not granted", async () => {
			vi.mocked(notifications.checkNotificationPermission).mockReturnValue(
				"denied",
			);

			await notificationChecker.checkAndNotify();

			expect(notifications.getNotificationSettings).not.toHaveBeenCalled();
			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip when notifications disabled in settings", async () => {
			vi.mocked(notifications.getNotificationSettings).mockResolvedValue(
				createSettings({ enabled: false }),
			);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip when in quiet hours", async () => {
			vi.mocked(notifications.isInQuietHours).mockReturnValue(true);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should check tasks with due dates and notifications enabled", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const dueTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(), // 10 minutes from now
				notificationEnabled: true,
			});

			mockTasks.push(dueTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			const keepsTask = mockDb.tasks.filter.mock.calls[0][0];
			expect(keepsTask(createTask({ completed: false }))).toBe(true);
			expect(keepsTask(createTask({ completed: true }))).toBe(false);
			expect(notifications.showTaskNotification).toHaveBeenCalledWith(
				dueTask,
				10,
			);
		});

		it("should skip tasks without due dates", async () => {
			const taskWithoutDue = createTask({
				id: "task-1",
				dueDate: undefined,
			});

			mockTasks.push(taskWithoutDue);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip tasks with notifications disabled", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const taskDisabled = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
				notificationEnabled: false,
			});

			mockTasks.push(taskDisabled);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip tasks outside notification window", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const farFutureTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T14:00:00Z").toISOString(), // 2 hours from now
			});

			mockTasks.push(farFutureTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip tasks that already sent notification", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const notifiedTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
				notificationSent: true,
			});

			mockTasks.push(notifiedTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should skip tasks that are snoozed", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const snoozedTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
				snoozedUntil: new Date("2025-01-15T13:00:00Z").toISOString(), // Snoozed until 1 hour from now
			});

			mockTasks.push(snoozedTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
		});

		it("should notify tasks with expired snooze", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const expiredSnoozeTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
				snoozedUntil: new Date("2025-01-15T11:00:00Z").toISOString(), // Snooze expired
			});

			mockTasks.push(expiredSnoozeTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).toHaveBeenCalledWith(
				expiredSnoozeTask,
				10,
			);
		});

		it("should use task-specific notification window", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const customTask = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:25:00Z").toISOString(), // 25 minutes from now
				notifyBefore: 30, // Custom 30-minute window
			});

			mockTasks.push(customTask);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).toHaveBeenCalledWith(
				customTask,
				25,
			);
		});

		it("should mark task as notified after sending notification", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
			});

			mockTasks.push(task);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);
			mockDb.tasks.get.mockResolvedValue(task);

			await notificationChecker.checkAndNotify();

			expect(mockDb.tasks.put).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "task-1",
					notificationSent: true,
					lastNotificationAt: expect.any(String),
				}),
			);
		});

		it("should update app badge with due soon count", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: new Date("2025-01-15T12:12:00Z").toISOString(),
			});

			mockTasks.push(task1, task2);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			await notificationChecker.checkAndNotify();

			expect(notifications.setAppBadge).toHaveBeenCalled();
		});

		it("should prevent concurrent checks", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			// Set the isChecking flag manually to simulate an ongoing check
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(notificationChecker as any).isChecking = true;

			// Try to start a check while one is "in progress"
			await notificationChecker.checkAndNotify();

			// Should not have queried tasks because isChecking was true
			expect(mockDb.tasks.toArray).not.toHaveBeenCalled();

			// Reset the flag
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(notificationChecker as any).isChecking = false;
		});

		it("should handle errors gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			mockDb.tasks.toArray.mockRejectedValue(new Error("Database error"));

			await notificationChecker.checkAndNotify();

			// Logger routes error through console.error with structured format
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[NOTIFICATIONS]"),
				expect.objectContaining({ message: "Error in notification checker" }),
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("start and stop", () => {
		it("should start checking at specified interval", () => {
			notificationChecker.start(1);

			expect(notificationChecker.isRunning()).toBe(true);
		});

		it("should check immediately on start", async () => {
			const checkSpy = vi.spyOn(notificationChecker, "checkAndNotify");

			notificationChecker.start(1);

			expect(checkSpy).toHaveBeenCalledTimes(1);
		});

		it("should check periodically after start", async () => {
			const checkSpy = vi.spyOn(notificationChecker, "checkAndNotify");

			notificationChecker.start(1);

			// Advance time by 2 minutes
			await vi.advanceTimersByTimeAsync(2 * NOTIFICATION_TIMING.MS_PER_MINUTE);

			// Should have checked: once on start + 2 times from interval
			expect(checkSpy).toHaveBeenCalledTimes(3);
		});

		it("should not start multiple times", () => {
			notificationChecker.start(1);
			notificationChecker.start(1);

			expect(notificationChecker.isRunning()).toBe(true);
		});

		it("should stop checking", () => {
			notificationChecker.start(1);
			notificationChecker.stop();

			expect(notificationChecker.isRunning()).toBe(false);
		});

		it("should not check after stop", async () => {
			const checkSpy = vi.spyOn(notificationChecker, "checkAndNotify");

			notificationChecker.start(1);
			checkSpy.mockClear(); // Clear the initial check

			notificationChecker.stop();

			// Advance time
			await vi.advanceTimersByTimeAsync(2 * NOTIFICATION_TIMING.MS_PER_MINUTE);

			// Should not have checked after stop
			expect(checkSpy).not.toHaveBeenCalled();
		});

		it("should handle stop when not running", () => {
			expect(() => notificationChecker.stop()).not.toThrow();
		});
	});

	describe("getLastCheckTime", () => {
		it("should return null before first check", () => {
			expect(notificationChecker.getLastCheckTime()).toBeNull();
		});

		it("should return last check time after check", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			await notificationChecker.checkAndNotify();

			const lastCheck = notificationChecker.getLastCheckTime();
			expect(lastCheck).toEqual(now);
		});
	});

	describe("resetTaskNotification", () => {
		it("should reset notification state for a task", async () => {
			const task = createTask({
				id: "task-1",
				notificationSent: true,
				lastNotificationAt: new Date().toISOString(),
				snoozedUntil: new Date().toISOString(),
			});

			mockDb.tasks.get.mockResolvedValue(task);

			await resetTaskNotification("task-1");

			expect(mockDb.tasks.put).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "task-1",
					notificationSent: false,
					lastNotificationAt: undefined,
					snoozedUntil: undefined,
				}),
			);
		});

		it("should do nothing if task not found", async () => {
			mockDb.tasks.get.mockResolvedValue(null);

			await resetTaskNotification("nonexistent");

			expect(mockDb.tasks.put).not.toHaveBeenCalled();
		});
	});

	describe("snoozeTaskNotification", () => {
		it("should snooze task for specified minutes", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task = createTask({
				id: "task-1",
				notificationSent: true,
			});

			mockDb.tasks.get.mockResolvedValue(task);

			await snoozeTaskNotification("task-1", 30);

			const expectedSnoozeUntil = new Date("2025-01-15T12:30:00Z").toISOString();

			expect(mockDb.tasks.put).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "task-1",
					snoozedUntil: expectedSnoozeUntil,
					notificationSent: false, // Reset so it can notify again
				}),
			);
		});

		it("should do nothing if task not found", async () => {
			mockDb.tasks.get.mockResolvedValue(null);

			await snoozeTaskNotification("nonexistent", 30);

			expect(mockDb.tasks.put).not.toHaveBeenCalled();
		});
	});

	describe("getDueSoonCount", () => {
		it("should count tasks within notification window", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(), // 10 min
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: new Date("2025-01-15T12:12:00Z").toISOString(), // 12 min
			});
			const task3 = createTask({
				id: "task-3",
				dueDate: new Date("2025-01-15T14:00:00Z").toISOString(), // 2 hours (outside window)
			});

			mockTasks.push(task1, task2, task3);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			const count = await getDueSoonCount();

			expect(count).toBe(2); // Only task1 and task2
		});

		it("should exclude tasks without due dates", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: undefined,
			});

			mockTasks.push(task1, task2);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			const count = await getDueSoonCount();

			expect(count).toBe(1);
		});

		it("should exclude tasks with notifications disabled", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(),
				notificationEnabled: true,
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: new Date("2025-01-15T12:12:00Z").toISOString(),
				notificationEnabled: false,
			});

			mockTasks.push(task1, task2);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			const count = await getDueSoonCount();

			expect(count).toBe(1);
		});

		it("should exclude overdue tasks beyond threshold", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(), // 10 min future
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: new Date("2025-01-15T10:00:00Z").toISOString(), // 2 hours overdue
			});

			mockTasks.push(task1, task2);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			const count = await getDueSoonCount();

			expect(count).toBe(1); // Only task1
		});

		it("should use task-specific notification window", async () => {
			const now = new Date("2025-01-15T12:00:00Z");
			vi.setSystemTime(now);

			const task1 = createTask({
				id: "task-1",
				dueDate: new Date("2025-01-15T12:25:00Z").toISOString(), // 25 min
				notifyBefore: 30, // Custom 30-minute window
			});
			const task2 = createTask({
				id: "task-2",
				dueDate: new Date("2025-01-15T12:25:00Z").toISOString(), // 25 min
				// Uses default 15-minute window
			});

			mockTasks.push(task1, task2);
			mockDb.tasks.toArray.mockResolvedValue(mockTasks);

			const count = await getDueSoonCount();

			expect(count).toBe(1); // Only task1 with custom window
		});
	});

	describe("while a reset is pending", () => {
		const RESET_PENDING_KEY = "gsd-reset-pending";
		const PENDING_MARKER = '{"preserveTheme":true}';
		const dueTask = () =>
			createTask({
				id: "task-private",
				dueDate: new Date("2025-01-15T12:10:00Z").toISOString(), // 10 minutes from now
			});

		beforeEach(() => {
			localStorage.removeItem(RESET_PENDING_KEY);
			vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
		});

		afterEach(() => {
			localStorage.removeItem(RESET_PENDING_KEY);
		});

		it("should_not_notify_or_mark_a_due_task_when_a_reset_is_pending", async () => {
			localStorage.setItem(RESET_PENDING_KEY, PENDING_MARKER);
			const task = dueTask();
			mockDb.tasks.toArray.mockResolvedValue([task]);
			mockDb.tasks.get.mockResolvedValue(task);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
			expect(mockDb.tasks.put).not.toHaveBeenCalled();
		});

		it("should_not_notify_when_a_reset_begins_while_tasks_load", async () => {
			const task = dueTask();
			// The lock begins while the checker waits for IndexedDB.
			mockDb.tasks.toArray.mockImplementation(async () => {
				localStorage.setItem(RESET_PENDING_KEY, PENDING_MARKER);
				return [task];
			});
			mockDb.tasks.get.mockResolvedValue(task);

			await notificationChecker.checkAndNotify();

			expect(notifications.showTaskNotification).not.toHaveBeenCalled();
			expect(mockDb.tasks.put).not.toHaveBeenCalled();
		});
	});
});
