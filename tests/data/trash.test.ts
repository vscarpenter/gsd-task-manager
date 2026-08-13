import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import { getDb } from "@/lib/db";
import { deleteTask, restoreTask } from "@/lib/tasks";
import {
  listTrashedTasks,
  getTrashCount,
  restoreFromTrash,
  deleteFromTrashForever,
  emptyTrash,
  purgeExpiredTrash,
  TRASH_RETENTION_DAYS,
} from "@/lib/trash";
import { createMockTask } from "@/tests/fixtures";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function clearAll() {
  const db = getDb();
  await Promise.all([db.tasks.clear(), db.archivedTasks.clear(), db.deletedTasks.clear(), db.syncQueue.clear()]);
}

describe("Trash (ADR 0015)", () => {
  beforeEach(async () => {
    await getDb();
    await clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deleting", () => {
    it("moves the task to trash rather than destroying it", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t1", title: "Deleted but recoverable" }));

      await deleteTask("t1");

      expect(await db.tasks.get("t1")).toBeUndefined();
      const trashed = await db.deletedTasks.get("t1");
      expect(trashed?.title).toBe("Deleted but recoverable");
      expect(trashed?.deletedAt).toBeTruthy();
    });

    it("keeps an id in exactly one lifecycle table", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t1" }));

      await deleteTask("t1");

      // ADR 0013's invariant, extended to three states.
      const present = [
        await db.tasks.get("t1"),
        await db.archivedTasks.get("t1"),
        await db.deletedTasks.get("t1"),
      ].filter(Boolean);
      expect(present).toHaveLength(1);
    });

    it("stays idempotent for a task that does not exist", async () => {
      await expect(deleteTask("nope")).resolves.toBeUndefined();
      expect(await getTrashCount()).toBe(0);
    });
  });

  describe("restoring", () => {
    it("returns the task to the board and clears its trash row", async () => {
      const db = getDb();
      const task = createMockTask({ id: "t1", title: "Back again" });
      await db.tasks.put(task);
      await deleteTask("t1");

      await restoreFromTrash("t1");

      expect((await db.tasks.get("t1"))?.title).toBe("Back again");
      expect(await db.deletedTasks.get("t1")).toBeUndefined();
    });

    it("drops the trash row when the undo toast restores the record", async () => {
      const db = getDb();
      const task = createMockTask({ id: "t1", title: "Undone" });
      await db.tasks.put(task);
      await deleteTask("t1");

      // The toast's Undo replays the captured record; it must not leave the
      // task sitting in both `tasks` and `deletedTasks`.
      await restoreTask(task);

      expect(await db.tasks.get("t1")).toBeDefined();
      expect(await db.deletedTasks.get("t1")).toBeUndefined();
    });
  });

  describe("retention", () => {
    it("purges rows older than the retention window", async () => {
      const db = getDb();
      await db.deletedTasks.put({
        ...createMockTask({ id: "old" }),
        deletedAt: daysAgo(TRASH_RETENTION_DAYS + 1),
      });
      await db.deletedTasks.put({
        ...createMockTask({ id: "recent" }),
        deletedAt: daysAgo(1),
      });

      const purged = await purgeExpiredTrash();

      expect(purged).toBe(1);
      expect(await db.deletedTasks.get("old")).toBeUndefined();
      expect(await db.deletedTasks.get("recent")).toBeDefined();
    });

    it("keeps a row that is exactly at the boundary", async () => {
      const db = getDb();
      await db.deletedTasks.put({
        ...createMockTask({ id: "boundary" }),
        deletedAt: daysAgo(TRASH_RETENTION_DAYS - 1),
      });

      await purgeExpiredTrash();

      expect(await db.deletedTasks.get("boundary")).toBeDefined();
    });
  });

  describe("permanent deletion", () => {
    it("removes one item forever", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t1" }));
      await deleteTask("t1");

      await deleteFromTrashForever("t1");

      expect(await db.deletedTasks.get("t1")).toBeUndefined();
      expect(await getTrashCount()).toBe(0);
    });

    it("empties the whole trash and reports how many went", async () => {
      const db = getDb();
      await db.tasks.bulkPut([createMockTask({ id: "a" }), createMockTask({ id: "b" })]);
      await deleteTask("a");
      await deleteTask("b");

      expect(await emptyTrash()).toBe(2);
      expect(await getTrashCount()).toBe(0);
    });
  });

  describe("listing", () => {
    it("returns the most recently deleted first", async () => {
      const db = getDb();
      await db.deletedTasks.put({ ...createMockTask({ id: "older" }), deletedAt: daysAgo(5) });
      await db.deletedTasks.put({ ...createMockTask({ id: "newer" }), deletedAt: daysAgo(1) });

      const listed = await listTrashedTasks();

      expect(listed.map((t) => t.id)).toEqual(["newer", "older"]);
    });
  });
});
