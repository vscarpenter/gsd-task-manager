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
	showTaskNotification: vi.fn(async () => true),
	setAppBadge: vi.fn(async () => {}),
	clearAppBadge: vi.fn(async () => {}),
}));

const enabledSettings = {
	id: "settings",
	enabled: true,
	defaultReminder: 15,
	soundEnabled: true,
	permissionAsked: true,
	updatedAt: new Date().toISOString(),
};

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

	describe("marking a reminder sent", () => {
		it("should_mark_a_task_sent_once_its_reminder_was_shown", async () => {
			await getDb().tasks.put(createMockTask({ id: "task-due", completed: false, dueDate: dueInMinutes(10) }));

			await notificationChecker.checkAndNotify();

			expect((await getDb().tasks.get("task-due"))?.notificationSent).toBe(true);
		});

		it("should_leave_a_task_due_when_its_reminder_was_not_shown", async () => {
			vi.mocked(notifications.showTaskNotification).mockResolvedValueOnce(false);
			await getDb().tasks.put(createMockTask({ id: "task-due", completed: false, dueDate: dueInMinutes(10) }));

			await notificationChecker.checkAndNotify();

			expect((await getDb().tasks.get("task-due"))?.notificationSent).toBe(false);
		});

		it("should_not_mark_the_old_reminder_sent_after_the_due_date_moved", async () => {
			await getDb().tasks.put(createMockTask({ id: "task-due", completed: false, dueDate: dueInMinutes(10) }));
			// The user moves the due date while the reminder is on screen, which
			// re-arms it for the new time.
			vi.mocked(notifications.showTaskNotification).mockImplementationOnce(async () => {
				await getDb().tasks.update("task-due", { dueDate: dueInMinutes(120), notificationSent: false });
				return true;
			});

			await notificationChecker.checkAndNotify();

			expect((await getDb().tasks.get("task-due"))?.notificationSent).toBe(false);
		});

		it("should_keep_an_edit_saved_between_reading_and_marking_the_task", async () => {
			await getDb().tasks.put(
				createMockTask({ id: "task-due", title: "Before", completed: false, dueDate: dueInMinutes(10) }),
			);
			const table = getDb().tasks;
			const readTask = table.get.bind(table);
			// An edit lands right after the checker reads the task it will mark.
			vi.spyOn(table, "get").mockImplementationOnce((async (key: string) => {
				const snapshot = await readTask(key);
				await getDb().tasks.update("task-due", { title: "Edited" });
				return snapshot;
			}) as unknown as typeof table.get);

			await notificationChecker.checkAndNotify();

			const stored = await getDb().tasks.get("task-due");
			expect(stored?.title).toBe("Edited");
			expect(stored?.notificationSent).toBe(true);
		});
	});

	describe("app badge", () => {
		it("should_clear_the_badge_when_reminders_are_off", async () => {
			vi.mocked(notifications.getNotificationSettings).mockResolvedValueOnce({ ...enabledSettings, enabled: false });

			await notificationChecker.checkAndNotify();

			expect(notifications.clearAppBadge).toHaveBeenCalledTimes(1);
			expect(notifications.setAppBadge).not.toHaveBeenCalled();
		});
	});
});
