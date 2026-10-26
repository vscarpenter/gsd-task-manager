import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { createTask, updateTask, exportToJson, importFromJson } from "@/lib/tasks";
import { saveTaskForLater, returnSavedTask } from "@/lib/tasks/saved";
import { taskRecordSchema } from "@/lib/schema";
import { taskRecordToPocketBase, pocketBaseToTaskRecord } from "@/lib/sync/task-mapper";
import type { RecordModel } from "pocketbase";

beforeEach(async () => { await getDb().tasks.clear(); });
const draft = { title: "Read this article", description: "https://example.com/article", urgent: false, important: true, tags: ["reading"] };

describe("Saved task lifecycle", () => {
  it("saves the same task without losing context or completing it", async () => {
    const task = await createTask(draft);
    const saved = await saveTaskForLater(task.id);
    expect(saved).toMatchObject({ id: task.id, title: task.title, description: task.description, tags: task.tags, quadrant: task.quadrant });
    expect(saved.savedAt).toBeTruthy();
    expect(saved.completed).toBe(false);
    expect(await getDb().tasks.count()).toBe(1);
    expect((await saveTaskForLater(task.id)).savedAt).toBe(saved.savedAt);
  });
  it("edits short notes while preserving Saved status and the original link", async () => {
    const task = await createTask(draft);
    const saved = await saveTaskForLater(task.id);
    const edited = await updateTask(task.id, { description: `${task.description}\nUseful background for later.` });
    expect(edited.savedAt).toBe(saved.savedAt);
    expect(edited.description).toContain("https://example.com/article");
    expect(edited.description).toContain("Useful background");
  });
  it("returns to a chosen quadrant and clears a stale date only when requested", async () => {
    const task = await createTask({ ...draft, dueDate: "2026-01-01T00:00:00.000Z" });
    await saveTaskForLater(task.id);
    const returned = await returnSavedTask(task.id, "urgent-not-important", undefined);
    expect(returned.savedAt).toBeUndefined();
    expect(returned).toMatchObject({ urgent: true, important: false, quadrant: "urgent-not-important", notificationSent: false });
    expect(returned.dueDate).toBeUndefined();
    expect((await returnSavedTask(task.id, "not-urgent-important", undefined)).quadrant).toBe("urgent-not-important");
  });
  it("rejects missing, completed and actively timed tasks", async () => {
    await expect(saveTaskForLater("missing")).rejects.toThrow();
    const task = await createTask(draft);
    await getDb().tasks.update(task.id, { completed: true });
    await expect(saveTaskForLater(task.id)).rejects.toThrow(/completed/i);
    await getDb().tasks.update(task.id, { completed: false, timeEntries: [{ id: "timer", startedAt: new Date().toISOString() }] });
    await expect(saveTaskForLater(task.id)).rejects.toThrow(/timer/i);
  });
  it("retains saved state in validated backups and optional sync round trips", async () => {
    const task = await saveTaskForLater((await createTask(draft)).id);
    expect(taskRecordSchema.parse(task).savedAt).toBe(task.savedAt);
    const wire = taskRecordToPocketBase(task, "owner", "device");
    expect(wire.saved_at).toBe(task.savedAt);
    expect(pocketBaseToTaskRecord(wire as RecordModel)?.savedAt).toBe(task.savedAt);
    expect(taskRecordToPocketBase({ ...task, savedAt: undefined }, "owner", "device").saved_at).toBe("");
    const json = await exportToJson();
    await getDb().tasks.clear();
    await importFromJson(json, "replace");
    expect((await getDb().tasks.get(task.id))?.savedAt).toBe(task.savedAt);
  });
  it("does not leave a task saved if its sync queue write fails", async () => {
    const task = await createTask(draft);
    const config = await import("@/lib/sync/config");
    const queue = await import("@/lib/sync/queue");
    vi.spyOn(config, "getSyncConfig").mockResolvedValueOnce({ enabled: true } as Awaited<ReturnType<typeof config.getSyncConfig>>);
    const enqueue = vi.spyOn(queue.getSyncQueue(), "enqueue").mockRejectedValueOnce(new Error("Queue unavailable"));
    await expect(saveTaskForLater(task.id)).rejects.toThrow("Queue unavailable");
    expect((await getDb().tasks.get(task.id))?.savedAt).toBeUndefined();
    enqueue.mockRestore();
    vi.restoreAllMocks();
  });
});
