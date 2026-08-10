import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getArchiveSettings,
  updateArchiveSettings,
  archiveOldTasks,
  listArchivedTasks,
  restoreTask,
  archiveTaskNow,
  deleteArchivedTask,
  reinstateArchivedTask,
  getArchivedCount,
} from "@/lib/archive";
import { getDb } from "@/lib/db";
import { createMockTask } from "@/tests/fixtures";
import { getSyncConfig } from "@/lib/sync/config";

// Stable across calls so individual tests can make the enqueue fail.
const { enqueueMock } = vi.hoisted(() => ({ enqueueMock: vi.fn() }));

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({
    enqueue: enqueueMock,
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
    enqueueMock.mockReset();
    vi.mocked(getSyncConfig).mockResolvedValue({ enabled: false } as never);
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

    it("should_initialize_defaults_idempotently_when_effects_race", async () => {
      const [first, second] = await Promise.all([
        getArchiveSettings(),
        getArchiveSettings(),
      ]);

      expect(first).toEqual(second);
      expect(await getDb().archiveSettings.count()).toBe(1);
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

    it("should_archive_a_task_that_is_already_in_the_archive", async () => {
      // Regression: a task archived earlier can be resurrected in `tasks` by a
      // sync pull while its archived copy still exists. bulkAdd then threw
      // ConstraintError and aborted the whole transaction, so NO task was ever
      // archived again on that device.
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const resurrected = createMockTask({
        id: "resurrected-task",
        title: "Resurrected Task",
        completed: true,
        completedAt: oldDate.toISOString(),
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      });

      await db.archivedTasks.add({ ...resurrected, archivedAt: oldDate.toISOString() });
      await db.tasks.add(resurrected);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(1);
      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(1);
    });

    it("should_preserve_a_newer_archived_snapshot_when_a_stale_live_copy_reappears", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const staleLive = createMockTask({
        id: "stale-resurrection",
        title: "Stale live title",
        completed: true,
        completedAt: oldDate.toISOString(),
        updatedAt: "2026-07-01T00:00:00.000Z",
      });
      await db.archivedTasks.add({
        ...staleLive,
        title: "Newer archived title",
        updatedAt: "2026-07-03T00:00:00.000Z",
        archivedAt: "2026-07-04T00:00:00.000Z",
      });
      await db.tasks.add(staleLive);

      await archiveOldTasks(30);

      expect(await db.tasks.get(staleLive.id)).toBeUndefined();
      expect((await db.archivedTasks.get(staleLive.id))?.title).toBe("Newer archived title");
    });

    it("should_not_let_one_duplicate_block_archiving_the_rest", async () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const base = {
        completed: true,
        completedAt: oldDate.toISOString(),
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      };

      const duplicate = createMockTask({ id: "dupe", title: "Dupe", ...base });
      const fresh = createMockTask({ id: "fresh", title: "Fresh", ...base });

      await db.archivedTasks.add({ ...duplicate, archivedAt: oldDate.toISOString() });
      await db.tasks.bulkAdd([duplicate, fresh]);

      const archivedCount = await archiveOldTasks(30);

      expect(archivedCount).toBe(2);
      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(2);
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

    it("should_not_throw_or_duplicate_when_called_concurrently", async () => {
      // Regression test for a production BulkError: two overlapping calls to
      // archiveOldTasks() (e.g. two open tabs, or the hourly auto-archive
      // racing a manual "Archive now" click) both read the same eligible
      // tasks before either had committed its bulkDelete, so the second
      // call's bulkAdd collided with keys the first call had just inserted.
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockTask({
          id: `concurrent-task-${i}`,
          completed: true,
          completedAt: oldDate.toISOString(),
        })
      );
      await db.tasks.bulkAdd(tasks);

      const [countA, countB] = await Promise.all([
        archiveOldTasks(30),
        archiveOldTasks(30),
      ]);

      expect(countA + countB).toBe(5);
      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(5);
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

    it("should_leave_both_tables_untouched_when_the_sync_enqueue_fails", async () => {
      // Without a transaction the task is added to `tasks` before the enqueue
      // runs and only removed from `archivedTasks` afterwards, so a failure here
      // strands the task in BOTH tables — the exact state the v15 migration has
      // to tolerate. The restore must be all-or-nothing instead.
      const db = getDb();
      const now = new Date().toISOString();
      vi.mocked(getSyncConfig).mockResolvedValue({ enabled: true } as never);
      enqueueMock.mockRejectedValue(new Error("sync queue write failed"));

      await db.archivedTasks.add(
        createMockTask({
          id: "atomic-restore",
          title: "Atomic Restore",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );

      await expect(restoreTask("atomic-restore")).rejects.toThrow();

      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(1);
    });

    it("should_enqueue_the_restore_for_sync_when_sync_is_enabled", async () => {
      const db = getDb();
      const now = new Date().toISOString();
      vi.mocked(getSyncConfig).mockResolvedValue({ enabled: true } as never);

      await db.archivedTasks.add(
        createMockTask({
          id: "synced-restore",
          title: "Synced Restore",
          completed: true,
          completedAt: now,
          archivedAt: now,
        })
      );

      await restoreTask("synced-restore");

      expect(enqueueMock).toHaveBeenCalledWith(
        "update",
        "synced-restore",
        expect.objectContaining({ id: "synced-restore" })
      );
      expect(await db.tasks.count()).toBe(1);
      expect(await db.archivedTasks.count()).toBe(0);
    });

    it("should_not_duplicate_when_the_task_is_already_live", async () => {
      // Reading the archived row inside the transaction closes the TOCTOU gap
      // between two concurrent restores (two tabs, or a double-click).
      const db = getDb();
      const now = new Date().toISOString();
      const task = createMockTask({
        id: "already-live",
        title: "Already Live",
        completed: true,
        completedAt: now,
        archivedAt: now,
      });
      await db.archivedTasks.add(task);

      const [first, second] = await Promise.allSettled([
        restoreTask("already-live"),
        restoreTask("already-live"),
      ]);

      expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
      expect(await db.tasks.count()).toBe(1);
      expect(await db.archivedTasks.count()).toBe(0);
    });
  });

  describe("archiveTaskNow", () => {
    it("should_move_a_live_task_into_the_archive", async () => {
      const db = getDb();
      await db.tasks.add(createMockTask({ id: "undo-me", title: "Undo Me" }));

      await archiveTaskNow("undo-me");

      expect(await db.tasks.count()).toBe(0);
      const archived = await db.archivedTasks.get("undo-me");
      expect(archived).toBeDefined();
      expect(archived!.archivedAt).toBeTruthy();
    });

    it("should_throw_when_the_task_is_not_live", async () => {
      await expect(archiveTaskNow("nonexistent")).rejects.toThrow("Task not found");
    });

    it("should_leave_both_tables_untouched_when_the_sync_enqueue_fails", async () => {
      // Inverse of the restoreTask hole: without a transaction the archived row
      // is written before the live row is removed, so a failure between them
      // leaves the task in both tables.
      const db = getDb();
      vi.mocked(getSyncConfig).mockResolvedValue({ enabled: true } as never);
      enqueueMock.mockRejectedValue(new Error("sync queue write failed"));
      await db.tasks.add(createMockTask({ id: "atomic-undo", title: "Atomic Undo" }));

      await expect(archiveTaskNow("atomic-undo")).rejects.toThrow();

      expect(await db.tasks.count()).toBe(1);
      expect(await db.archivedTasks.count()).toBe(0);
    });

    it("should_enqueue_a_delete_so_other_devices_drop_the_task", async () => {
      const db = getDb();
      vi.mocked(getSyncConfig).mockResolvedValue({ enabled: true } as never);
      await db.tasks.add(createMockTask({ id: "sync-undo", title: "Sync Undo" }));

      await archiveTaskNow("sync-undo");

      expect(enqueueMock).toHaveBeenCalledWith(
        "delete",
        "sync-undo",
        expect.objectContaining({ id: "sync-undo" })
      );
    });

    it("should_overwrite_a_stale_archived_copy_instead_of_colliding", async () => {
      // Same reasoning as archiveOldTasks' bulkPut: re-archiving must be
      // idempotent, or a lingering archived row makes undo permanently fail.
      const db = getDb();
      const task = createMockTask({
        id: "already-archived",
        title: "Newer Title",
        updatedAt: "2026-07-06T00:00:00.000Z",
      });
      await db.archivedTasks.add({
        ...createMockTask({
          id: "already-archived",
          title: "Stale Title",
          updatedAt: "2026-07-04T00:00:00.000Z",
        }),
        archivedAt: "2026-07-05T00:00:00.000Z",
      });
      await db.tasks.add(task);

      await archiveTaskNow("already-archived");

      expect(await db.tasks.count()).toBe(0);
      expect(await db.archivedTasks.count()).toBe(1);
      const archived = await db.archivedTasks.get("already-archived");
      expect(archived!.title).toBe("Newer Title");
    });

    it("should_not_replace_a_newer_tombstone_with_an_older_live_snapshot", async () => {
      const db = getDb();
      const live = createMockTask({
        id: "newer-tombstone",
        title: "Stale live title",
        updatedAt: "2026-07-01T00:00:00.000Z",
      });
      await db.archivedTasks.add({
        ...live,
        title: "Newer archived title",
        updatedAt: "2026-07-03T00:00:00.000Z",
        archivedAt: "2026-07-04T00:00:00.000Z",
      });
      await db.tasks.add(live);

      await archiveTaskNow(live.id);

      expect(await db.tasks.get(live.id)).toBeUndefined();
      expect((await db.archivedTasks.get(live.id))?.title).toBe("Newer archived title");
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

  describe("reinstateArchivedTask", () => {
    it("should_put_a_deleted_task_back_into_the_archive", async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const task = createMockTask({
        id: "undo-delete",
        title: "Undo Delete",
        completed: true,
        completedAt: now,
        archivedAt: now,
      });

      await db.archivedTasks.add(task);
      await deleteArchivedTask("undo-delete");
      expect(await db.archivedTasks.count()).toBe(0);

      await reinstateArchivedTask(task);

      const restored = await db.archivedTasks.get("undo-delete");
      expect(restored).toBeDefined();
      expect(restored!.title).toBe("Undo Delete");
      expect(restored!.archivedAt).toBe(now);
    });

    it("should_not_clobber_a_newer_archived_row_with_the_stale_snapshot", async () => {
      // Between the delete and the Undo click the same id can come back and be
      // archived again with newer content: the remote copy survives when
      // pb-push abandons the archive's delete as stale, the pull re-adds it
      // (the archive guard no longer suppresses it — the row was just deleted),
      // and auto-archive files it away again. Undo then holds a stale snapshot
      // captured at delete time, so writing it unconditionally would discard
      // the intervening edit.
      const db = getDb();
      const staleSnapshot = createMockTask({
        id: "raced-undo",
        title: "Stale Title",
        completed: true,
        completedAt: "2026-06-01T00:00:00.000Z",
        archivedAt: "2026-07-05T00:00:00.000Z",
      });
      const newerRow = createMockTask({
        id: "raced-undo",
        title: "Newer Title From Another Device",
        completed: true,
        completedAt: "2026-06-01T00:00:00.000Z",
        archivedAt: "2026-07-20T00:00:00.000Z",
      });

      await db.archivedTasks.add(newerRow);
      await reinstateArchivedTask(staleSnapshot);

      const stored = await db.archivedTasks.get("raced-undo");
      expect(stored!.title).toBe("Newer Title From Another Device");
      expect(stored!.archivedAt).toBe("2026-07-20T00:00:00.000Z");
      expect(await db.archivedTasks.count()).toBe(1);
    });

    it("should_be_idempotent_when_the_row_already_exists", async () => {
      // The Undo affordance can be activated twice (double-click, or a stale
      // toast). `add` threw ConstraintError on the second call, which escaped
      // the handler as an unhandled rejection.
      const db = getDb();
      const now = new Date().toISOString();
      const task = createMockTask({
        id: "double-undo",
        title: "Double Undo",
        completed: true,
        completedAt: now,
        archivedAt: now,
      });

      await reinstateArchivedTask(task);
      await expect(reinstateArchivedTask(task)).resolves.toBeUndefined();

      expect(await db.archivedTasks.count()).toBe(1);
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
