import Dexie from "dexie";
import { beforeEach, expect, it } from "vitest";
import { archiveOldTasks, archiveTaskNow, restoreTask } from "@/lib/archive";
import { getDb } from "@/lib/db";
import { updateTask } from "@/lib/tasks/crud/update";
import { importTasks } from "@/lib/tasks/import-export";
import { restoreFromTrash } from "@/lib/trash";
import { createMockSyncConfig, createMockTask } from "@/tests/fixtures";

const stamp = "2026-01-01T00:00:00.000Z";
const task = createMockTask({
  id: "sync-writer-task", completed: true, completedAt: stamp,
  createdAt: stamp, updatedAt: stamp,
});

beforeEach(async () => {
  await Promise.all(getDb().tables.map((table) => table.clear()));
});

const writers = [
  { name: "task edit", seed: "tasks", write: () => updateTask(task.id, { title: "Edited" }), operation: "update" },
  { name: "Trash restore", seed: "deletedTasks", write: () => restoreFromTrash(task.id), operation: "create" },
  { name: "auto-archive", seed: "tasks", write: () => archiveOldTasks(30), operation: "delete" },
  { name: "manual archive", seed: "tasks", write: () => archiveTaskNow(task.id), operation: "delete" },
  { name: "Archive restore", seed: "archivedTasks", write: () => restoreTask(task.id), operation: "update" },
  {
    name: "backup import",
    seed: undefined,
    write: () => importTasks({ version: "2.2.0", exportedAt: stamp, tasks: [task] }, "replace"),
    operation: "create",
  },
] as const;

it.each(writers)("$name reads the sync flag inside the same transaction that queues the write", async ({ seed, write, operation }) => {
  const db = getDb();
  await db.syncMetadata.put(createMockSyncConfig({ enabled: true }));
  if (seed === "deletedTasks") await db.deletedTasks.put({ ...task, deletedAt: stamp });
  if (seed === "archivedTasks") await db.archivedTasks.put({ ...task, archivedAt: stamp });
  if (seed === "tasks") await db.tasks.put(task);

  const reads: { mode?: string; stores?: string[] }[] = [];
  const recordRead = (row: { key: string } | undefined) => {
    if (row?.key === "sync_config") {
      const transaction = Dexie.currentTransaction;
      reads.push({ mode: transaction?.mode, stores: transaction?.storeNames });
    }
    return row;
  };
  db.syncMetadata.hook("reading", recordRead);
  try {
    await write();
  } finally {
    db.syncMetadata.hook("reading").unsubscribe(recordRead);
  }

  expect(await db.syncQueue.toArray()).toMatchObject([{ taskId: task.id, operation }]);
  expect(reads).toEqual([{
    mode: "readwrite",
    stores: expect.arrayContaining(["tasks", "syncQueue", "syncMetadata"]),
  }]);
});
