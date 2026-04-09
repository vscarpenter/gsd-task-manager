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
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({
    enqueue: vi.fn(),
  }),
}));

vi.mock("@/lib/sync/config", () => ({
  getSyncConfig: vi.fn(() => Promise.resolve({ enabled: false })),
}));

describe("archive", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.archiveSettings.clear();
  });

  describe("getArchiveSettings", () => {
    it("should_return_defaults_when_no_settings_exist", async () => {
      const settings = await getArchiveSettings();

      expect(settings).toEqual({
        id: "settings",
        enabled: false,
        archiveAfterDays: 30,
      });
    });

    it("should_return_stored_settings_when_they_exist", async () => {
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

    it("should_persist_defaults_to_database_on_first_call", async () => {
      await getArchiveSettings();

      const db = getDb();
      const stored = await db.archiveSettings.get("settings");
      expect(stored).toBeDefined();
      expect(stored!.enabled).toBe(false);
      expect(stored!.archiveAfterDays).toBe(30);
    });
  });

  describe("updateArchiveSettings", () => {
    it("should_update_settings_correctly", async () => {
      // Initialize defaults first
      await getArchiveSettings();

      await updateArchiveSettings({ enabled: true, archiveAfterDays: 90 });

      const settings = await getArchiveSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.archiveAfterDays).toBe(90);
    });

    it("should_allow_partial_updates", async () => {
      await getArchiveSettings();

      await updateArchiveSettings({ enabled: true });

      const settings = await getArchiveSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.archiveAfterDays).toBe(30); // unchanged
    });
  });

  describe("archiveOldTasks", () => {
    it("should_archive_completed_tasks_older_than_cutoff", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const oldTask = createMockTask({
        id: "old-task",
        title: "Old Task",
        completed: true,
        completedAt: oldDate.toISOString(),
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      });

      await db.tasks.add(oldTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(1);
      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(1);
    });

    it("should_skip_incomplete_tasks", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const incompleteTask = createMockTask({
        id: "incomplete-task",
        title: "Incomplete Task",
        completed: false,
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      });

      await db.tasks.add(incompleteTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(0);
      expect(await db.tasks.count()).toBe(1);
    });

    it("should_skip_recently_completed_tasks", async () => {
      const db = getDb();
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      const recentTask = createMockTask({
        id: "recent-task",
        title: "Recent Task",
        completed: true,
        completedAt: recentDate.toISOString(),
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString(),
      });

      await db.tasks.add(recentTask);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(0);
      expect(await db.tasks.count()).toBe(1);
    });

    it("should_return_correct_count_with_mixed_tasks", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      // Should be archived (completed + old)
      await db.tasks.add(
        createMockTask({
          id: "old-done-1",
          completed: true,
          completedAt: oldDate.toISOString(),
        })
      );
      await db.tasks.add(
        createMockTask({
          id: "old-done-2",
          completed: true,
          completedAt: oldDate.toISOString(),
        })
      );

      // Should NOT be archived (not completed)
      await db.tasks.add(
        createMockTask({
          id: "old-incomplete",
          completed: false,
          createdAt: oldDate.toISOString(),
        })
      );

      // Should NOT be archived (completed but recent)
      await db.tasks.add(
        createMockTask({
          id: "recent-done",
          completed: true,
          completedAt: recentDate.toISOString(),
        })
      );

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(2);
      expect(await db.tasks.count()).toBe(2); // incomplete + recent
      expect(await db.archivedTasks.count()).toBe(2);
    });

    it("should_return_zero_when_no_tasks_match", async () => {
      const archivedCount = await archiveOldTasks(30);
      expect(archivedCount).toBe(0);
    });

    it("should_set_archivedAt_on_archived_tasks", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      await db.tasks.add(
        createMockTask({
          id: "archive-me",
          completed: true,
          completedAt: oldDate.toISOString(),
        })
      );

      await archiveOldTasks(30);

      const archived = await db.archivedTasks.get("archive-me");
      expect(archived).toBeDefined();
      expect(archived!.archivedAt).toBeDefined();
    });
  });

  describe("listArchivedTasks", () => {
    it("should_return_all_archived_tasks", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      await db.archivedTasks.add(
        createMockTask({
          id: "archived-1",
          title: "Archived Task 1",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );
      await db.archivedTasks.add(
        createMockTask({
          id: "archived-2",
          title: "Archived Task 2",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );

      const archived = await listArchivedTasks();

      expect(archived).toHaveLength(2);
      expect(archived.map((t) => t.id).sort()).toEqual([
        "archived-1",
        "archived-2",
      ]);
    });

    it("should_return_empty_array_when_no_archived_tasks", async () => {
      const archived = await listArchivedTasks();
      expect(archived).toHaveLength(0);
    });
  });

  describe("restoreTask", () => {
    it("should_move_task_from_archive_to_main", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      await db.archivedTasks.add(
        createMockTask({
          id: "restore-task",
          title: "Restore Task",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );

      await restoreTask("restore-task");

      const mainTasks = await db.tasks.toArray();
      expect(mainTasks).toHaveLength(1);
      expect(mainTasks[0].id).toBe("restore-task");
      expect(mainTasks[0].archivedAt).toBeUndefined();

      expect(await db.archivedTasks.count()).toBe(0);
    });

    it("should_throw_for_missing_task", async () => {
      await expect(restoreTask("nonexistent")).rejects.toThrow(
        "Task not found in archive"
      );
    });
  });

  describe("deleteArchivedTask", () => {
    it("should_remove_task_from_archive", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      await db.archivedTasks.add(
        createMockTask({
          id: "delete-task",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );

      await deleteArchivedTask("delete-task");

      expect(await db.archivedTasks.count()).toBe(0);
    });
  });

  describe("getArchivedCount", () => {
    it("should_return_correct_count", async () => {
      const db = getDb();
      const now = new Date().toISOString();

      for (let i = 0; i < 3; i++) {
        await db.archivedTasks.add(
          createMockTask({
            id: `task-${i}`,
            completed: true,
            completedAt: now,
            archivedAt: now,
          })
        );
      }

      const count = await getArchivedCount();
      expect(count).toBe(3);
    });

    it("should_return_zero_when_archive_is_empty", async () => {
      const count = await getArchivedCount();
      expect(count).toBe(0);
    });
  });
});
