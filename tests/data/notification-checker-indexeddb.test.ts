/**
 * Due-task notifications against a real IndexedDB (fake-indexeddb).
 *
 * The app stores `completed` as a boolean, and IndexedDB cannot index booleans,
 * so a `where("completed").equals(0)` query finds none of those rows. The suite
 * in notification-checker.test.ts fakes that query, so it cannot catch this.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { getDueSoonCount, notificationChecker } from "@/lib/notification-checker";
import * as notifications from "@/lib/notifications";
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/notifications", () => ({
	isNotificationSupported: vi.fn(() => true),
	checkNotificationPermission: vi.fn(() => "granted"),
	getNotificationSettings: vi.fn(async () => ({
		id: "settings",
		enabled: true,
		defaultReminder: 15,
		soundEnabled: true,
		permissionAsked: true,
		updatedAt: new Date().toISOString(),
	})),
	isInQuietHours: vi.fn(() => false),
	showTaskNotification: vi.fn(async () => {}),
	setAppBadge: vi.fn(async () => {}),
}));

const MS_PER_MINUTE = 60_000;

function dueInMinutes(minutes: number): string {
	return new Date(Date.now() + minutes * MS_PER_MINUTE).toISOString();
}

describe("notification checker on a real database", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		localStorage.removeItem("gsd-reset-pending");
		await getDb().tasks.clear();
	});

	afterEach(() => {
		notificationChecker.stop();
	});

	it("should_notify_a_due_task_stored_with_a_boolean_completed_flag", async () => {
		await getDb().tasks.put(createMockTask({ id: "task-due", completed: false, dueDate: dueInMinutes(10) }));

		await notificationChecker.checkAndNotify();

		expect(notifications.showTaskNotification).toHaveBeenCalledTimes(1);
		expect(vi.mocked(notifications.showTaskNotification).mock.calls[0][0].id).toBe("task-due");
	});

	it("should_not_notify_a_completed_task", async () => {
		await getDb().tasks.put(
			createMockTask({ id: "task-done", completed: true, completedAt: new Date().toISOString(), dueDate: dueInMinutes(10) }),
		);

		await notificationChecker.checkAndNotify();

		expect(notifications.showTaskNotification).not.toHaveBeenCalled();
	});

	it("should_count_only_incomplete_due_tasks_for_the_badge", async () => {
		await getDb().tasks.put(createMockTask({ id: "task-due", completed: false, dueDate: dueInMinutes(10) }));
		await getDb().tasks.put(
			createMockTask({ id: "task-done", completed: true, completedAt: new Date().toISOString(), dueDate: dueInMinutes(10) }),
		);

		await expect(getDueSoonCount()).resolves.toBe(1);
	});
});
