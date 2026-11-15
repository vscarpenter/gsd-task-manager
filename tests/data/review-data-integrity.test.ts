import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { importTasks } from "@/lib/tasks/import-export";
import { toggleCompleted } from "@/lib/tasks/crud/toggle";
import { duplicateTask } from "@/lib/tasks/crud/duplicate";
import { getSyncQueue } from "@/lib/sync/queue";
import { pocketBaseToTaskRecord, taskRecordToPocketBase } from "@/lib/sync/task-mapper";
import { createMockSyncConfig, createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";
import type { RecordModel } from "pocketbase";

const STAMP = "2026-11-10T10:00:00.000Z";
const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => createMockTask({
  id: "review-task", createdAt: STAMP, updatedAt: STAMP, notifyBefore: 15, ...overrides,
});
const backup = (tasks: TaskRecord[]) => ({ version: "2.2.0", exportedAt: STAMP, tasks });

beforeEach(async () => {
  await Promise.all(getDb().tables.map((table) => table.clear()));
});

describe("review: import lifecycle and queue integrity", () => {
  it("remaps merge ids that collide with either tombstone, including references", async () => {
    const db = getDb();
    await db.archivedTasks.put(task({ archivedAt: STAMP }));
    await db.deletedTasks.put(task({ id: "trashed-task", deletedAt: STAMP }));
    await importTasks(backup([task(), task({ id: "trashed-task", dependencies: ["review-task"] })]), "merge");
    const imported = await db.tasks.toArray();
    expect(imported).toHaveLength(2);
    expect(imported.map((row) => row.id)).not.toContain("review-task");
    expect(imported.map((row) => row.id)).not.toContain("trashed-task");
    expect(imported.find((row) => row.dependencies.length)?.dependencies[0]).toBe(imported.find((row) => !row.dependencies.length)?.id);
    expect(await db.archivedTasks.count()).toBe(1);
    expect(await db.deletedTasks.count()).toBe(1);
  });

  it("keeps an existing Trash row when merging an archived copy", async () => {
    const db = getDb();
    await db.deletedTasks.put(task({ title: "Local trash", deletedAt: STAMP }));
    await importTasks({ ...backup([]), archivedTasks: [task({ archivedAt: STAMP })] }, "merge");
    expect(await db.archivedTasks.get("review-task")).toBeUndefined();
    expect((await db.deletedTasks.get("review-task"))?.title).toBe("Local trash");
  });

  it("a legacy replace clears only tombstones contradicted by restored live ids", async () => {
    const db = getDb();
    await db.archivedTasks.bulkPut([task({ archivedAt: STAMP }), task({ id: "untouched-archive", archivedAt: STAMP })]);
    await db.deletedTasks.put(task({ id: "trashed-task", deletedAt: STAMP }));
    await importTasks(backup([task(), task({ id: "trashed-task" })]), "replace");
    expect(await db.archivedTasks.get("review-task")).toBeUndefined();
    expect(await db.deletedTasks.get("trashed-task")).toBeUndefined();
    expect(await db.archivedTasks.get("untouched-archive")).toBeDefined();
  });

  it("replace supersedes queued updates/deletes and stamps restored sync writes", async () => {
    const db = getDb();
    await db.syncMetadata.put(createMockSyncConfig());
    await db.tasks.put(task());
    await getSyncQueue().enqueue("update", "review-task", task({ title: "Superseded" }));
    await getSyncQueue().enqueue("delete", "removed-remotely", null);
    await importTasks(backup([task({ title: "Restored" })]), "replace");
    const rows = await getSyncQueue().getPending();
    expect(rows.filter((row) => row.taskId === "review-task")).toHaveLength(1);
    expect(rows.find((row) => row.taskId === "review-task")?.payload?.title).toBe("Restored");
    expect(Date.parse((await db.tasks.get("review-task"))!.updatedAt)).toBeGreaterThan(Date.parse(STAMP));
    // A queued deletion for an already absent task remains part of the replacement intent.
    expect(rows.find((row) => row.taskId === "removed-remotely")?.operation).toBe("delete");
  });
});

describe("review: fresh work history and remote validation", () => {
  const tracked = (): TaskRecord => task({ recurrence: "daily", timeSpent: 45,
    timeEntries: [{ id: "running-entry", startedAt: STAMP }] });

  it("new recurring instances carry no previous work or running entries", async () => {
    await getDb().tasks.put(tracked());
    const { recurringInstance } = await toggleCompleted("review-task", true);
    expect(recurringInstance?.timeEntries).toEqual([]);
    expect(recurringInstance?.timeSpent ?? 0).toBe(0);
  });

  it("duplicates carry the estimate but no recorded work", async () => {
    await getDb().tasks.put({ ...tracked(), estimatedMinutes: 60 });
    const copy = await duplicateTask("review-task");
    expect(copy.timeEntries).toEqual([]);
    expect(copy.timeSpent ?? 0).toBe(0);
    expect(copy.estimatedMinutes).toBe(60);
  });

  it.each([
    { due_date: "not-a-date" }, { completed_at: "not-a-date" },
    { tags: [""] }, { estimated_minutes: 10081 }, { task_id: "x" },
  ])("rejects a remote record that the local storage contract rejects: %j", (invalid) => {
    const wire = { ...taskRecordToPocketBase(task(), "owner", "device", 15), ...invalid };
    expect(pocketBaseToTaskRecord(wire as unknown as RecordModel)).toBeNull();
  });
});
