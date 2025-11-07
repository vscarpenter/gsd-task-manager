import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getArchiveSettings,
  updateArchiveSettings,
  archiveOldTasks,
  listArchivedTasks,
  restoreTask,
  deleteArchivedTask,
  getArchivedCount,
} from "@/lib/archive";
import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({
    enqueue: vi.fn(),
  }),
}));

vi.mock("@/lib/sync/config", () => ({
  getSyncConfig: vi.fn(() => Promise.resolve({ deviceId: "test-device" })),
}));

describe("archive", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.archiveSettings.clear();
  });

  describe("getArchiveSettings", () => {
    it("returns default settings when none exist", async () => {
      const settings = await getArchiveSettings();

      expect(settings).toEqual({
        id: "settings",
        enabled: false,
        archiveAfterDays: 30,
      });
    });

    it("returns existing settings", async () => {
      const db = getDb();
      await db.archiveSettings.add({
        id: "settings",
        enabled: true,
        archiveAfterDays: 60,
      });

      const settings = await getArchiveSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.archiveAfterDays).toBe(60);
    });
  });

  describe("updateArchiveSettings", () => {
    it("updates archive settings", async () => {
      await getArchiveSettings(); // Initialize
      await updateArchiveSettings({ enabled: true, archiveAfterDays: 90 });

      const settings = await getArchiveSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.archiveAfterDays).toBe(90);
    });
  });

  describe("archiveOldTasks", () => {
    it("archives completed tasks older than specified days", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const oldTask: TaskRecord = {
        id: "old-task",
        title: "Old Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: true,
        completedAt: oldDate.toISOString(),
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.tasks.add(oldTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(1);

      const remainingTasks = await db.tasks.count();
      expect(remainingTasks).toBe(0);

      const archived = await db.archivedTasks.count();
      expect(archived).toBe(1);
    });

    it("does not archive recent completed tasks", async () => {
      const db = getDb();
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      const recentTask: TaskRecord = {
        id: "recent-task",
        title: "Recent Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: true,
        completedAt: recentDate.toISOString(),
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString(),
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.tasks.add(recentTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(0);
      expect(await db.tasks.count()).toBe(1);
    });

    it("does not archive incomplete tasks", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const incompleteTask: TaskRecord = {
        id: "incomplete-task",
        title: "Incomplete Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: false,
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.tasks.add(incompleteTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(0);
      expect(await db.tasks.count()).toBe(1);
    });
  });

  describe("listArchivedTasks", () => {
    it("returns all archived tasks", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      const archivedTask: TaskRecord = {
        id: "archived-1",
        title: "Archived Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: true,
        completedAt: now,
        archivedAt: now,
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: now,
        updatedAt: now,
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.archivedTasks.add(archivedTask);

      const archived = await listArchivedTasks();

      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe("archived-1");
    });
  });

  describe("restoreTask", () => {
    it("restores archived task to main tasks", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      const archivedTask: TaskRecord = {
        id: "restore-task",
        title: "Restore Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: true,
        completedAt: now,
        archivedAt: now,
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: now,
        updatedAt: now,
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.archivedTasks.add(archivedTask);

      await restoreTask("restore-task");

      const mainTasks = await db.tasks.toArray();
      expect(mainTasks).toHaveLength(1);
      expect(mainTasks[0].id).toBe("restore-task");
      expect(mainTasks[0].archivedAt).toBeUndefined();

      const archived = await db.archivedTasks.count();
      expect(archived).toBe(0);
    });

    it("throws error if task not found in archive", async () => {
      await expect(restoreTask("nonexistent")).rejects.toThrow(
        "Task not found in archive"
      );
    });
  });

  describe("deleteArchivedTask", () => {
    it("permanently deletes archived task", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      const archivedTask: TaskRecord = {
        id: "delete-task",
        title: "Delete Task",
        urgent: false,
        important: false,
        quadrant: "not-urgent-not-important",
        completed: true,
        completedAt: now,
        archivedAt: now,
        dueDate: undefined,
        recurrence: "none",
        tags: [],
        subtasks: [],
        dependencies: [],
        createdAt: now,
        updatedAt: now,
        notificationEnabled: false,
        notificationSent: false,
      };

      await db.archivedTasks.add(archivedTask);
      await deleteArchivedTask("delete-task");

      const archived = await db.archivedTasks.count();
      expect(archived).toBe(0);
    });
  });

  describe("getArchivedCount", () => {
    it("returns count of archived tasks", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      for (let i = 0; i < 3; i++) {
        await db.archivedTasks.add({
          id: `task-${i}`,
          title: `Task ${i}`,
          urgent: false,
          important: false,
          quadrant: "not-urgent-not-important",
          completed: true,
          completedAt: now,
          archivedAt: now,
          dueDate: undefined,
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          createdAt: now,
          updatedAt: now,
          notificationEnabled: false,
          notificationSent: false,
        });
      }

      const count = await getArchivedCount();
      expect(count).toBe(3);
    });
  });
});
