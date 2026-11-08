import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createTask, duplicateTask, updateTask } from "@/lib/tasks";
import { importTasks } from "@/lib/tasks/import-export";
import { savedReminder } from "@/components/matrix-simplified/use-edit-draft-state";
import { createMockTask, createMockTaskDraft } from "@/tests/fixtures";

const DEVICE_DEFAULT = 45;

async function setDefaultReminder(minutes: number): Promise<void> {
  await getDb().notificationSettings.put({
    id: "settings",
    enabled: true,
    defaultReminder: minutes,
    soundEnabled: true,
    permissionAsked: false,
    updatedAt: new Date().toISOString(),
  });
}

describe("notify_before is always a number (D-10, web)", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    await db.notificationSettings.clear();
    await setDefaultReminder(DEVICE_DEFAULT);
  });

  it("a new task with no offset stores the default", async () => {
    const created = await createTask(createMockTaskDraft({ notifyBefore: undefined }));

    expect(created.notifyBefore).toBe(DEVICE_DEFAULT);
    expect((await getDb().tasks.get(created.id))?.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("a zero offset stays zero and fires at the due time", async () => {
    const created = await createTask(createMockTaskDraft({ notifyBefore: 0 }));

    expect(created.notifyBefore).toBe(0);
  });

  it("a duplicate of a legacy null stores the default", async () => {
    await getDb().tasks.put(createMockTask({ id: "legacy", notifyBefore: undefined }));

    const copy = await duplicateTask("legacy");

    expect(copy.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("a backup with no offset imports with the default", async () => {
    const task = createMockTask({ id: "imported", notifyBefore: undefined });

    await importTasks({ tasks: [task], exportedAt: new Date().toISOString(), version: "1.0.0" }, "replace");

    expect((await getDb().tasks.get("imported"))?.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("a Replace import gives a missing offset the backup's default, which is in effect once it finishes", async () => {
    const task = createMockTask({ id: "imported", notifyBefore: undefined });

    await importTasks(
      {
        tasks: [task],
        exportedAt: new Date().toISOString(),
        version: "2.1.0",
        notificationSettings: {
          id: "settings", enabled: true, defaultReminder: 90, soundEnabled: true, permissionAsked: true,
          updatedAt: new Date().toISOString(),
        },
      },
      "replace"
    );

    expect((await getDb().notificationSettings.get("settings"))?.defaultReminder).toBe(90);
    expect((await getDb().tasks.get("imported"))?.notifyBefore).toBe(90);
  });

  it("a Merge import keeps this device's default, since merging adopts no settings", async () => {
    const task = createMockTask({ id: "merged", notifyBefore: undefined });

    await importTasks(
      {
        tasks: [task],
        exportedAt: new Date().toISOString(),
        version: "2.1.0",
        notificationSettings: {
          id: "settings", enabled: true, defaultReminder: 90, soundEnabled: true, permissionAsked: true,
          updatedAt: new Date().toISOString(),
        },
      },
      "merge"
    );

    expect((await getDb().tasks.get("merged"))?.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("changing the default doesn't move an existing number", async () => {
    const created = await createTask(createMockTaskDraft({ notifyBefore: undefined }));
    await setDefaultReminder(5);

    const updated = await updateTask(created.id, { title: "Renamed" });

    expect(updated.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("a legacy null fires the default until it's written, then stores it", async () => {
    await getDb().tasks.put(createMockTask({ id: "legacy", notifyBefore: undefined }));

    const updated = await updateTask("legacy", { title: "Touched" });

    expect(updated.notifyBefore).toBe(DEVICE_DEFAULT);
  });

  it("turning a reminder off keeps the offset", () => {
    const task = createMockTask({ notifyBefore: 60, notificationEnabled: true });

    expect(savedReminder(task, null)).toEqual({ notifyBefore: 60, notificationEnabled: false });
  });

  it("picking an offset turns the reminder on with that number", () => {
    const task = createMockTask({ notifyBefore: 60, notificationEnabled: false });

    expect(savedReminder(task, 10)).toEqual({ notifyBefore: 10, notificationEnabled: true });
  });

  it("resolving a null offset doesn't re-arm a sent reminder", async () => {
    await getDb().tasks.put(
      createMockTask({
        id: "sent",
        dueDate: "2026-05-01T05:00:00.000Z",
        notifyBefore: undefined,
        notificationSent: true,
        lastNotificationAt: "2026-05-01T04:45:00.000Z",
      })
    );

    const updated = await updateTask("sent", { notifyBefore: DEVICE_DEFAULT });

    expect(updated.notificationSent).toBe(true);
    expect(updated.lastNotificationAt).toBe("2026-05-01T04:45:00.000Z");
  });

  it("a real change to the offset still re-arms", async () => {
    await getDb().tasks.put(
      createMockTask({
        id: "sent",
        dueDate: "2026-05-01T05:00:00.000Z",
        notifyBefore: 30,
        notificationSent: true,
      })
    );

    const updated = await updateTask("sent", { notifyBefore: 10 });

    expect(updated.notificationSent).toBe(false);
  });
});
