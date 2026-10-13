import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { taskRecordToPocketBase } from "@/lib/sync/task-mapper";
import { updateTask } from "@/lib/tasks";
import type { TaskDraft } from "@/lib/types";
import { createMockTask } from "@/tests/fixtures";

const STORED = createMockTask({
  id: "clear-1",
  dueDate: "2026-05-01T05:00:00.000Z",
  estimatedMinutes: 45,
  notifyBefore: 30,
  notificationEnabled: true,
});

/** The shape the edit drawer submits: every field present, a cleared one as undefined. */
function editorDraft(overrides: Partial<TaskDraft>): Partial<TaskDraft> {
  return {
    title: STORED.title,
    description: STORED.description,
    urgent: STORED.urgent,
    important: STORED.important,
    dueDate: STORED.dueDate,
    tags: STORED.tags,
    dependencies: STORED.dependencies,
    recurrence: STORED.recurrence,
    subtasks: STORED.subtasks,
    estimatedMinutes: STORED.estimatedMinutes,
    notifyBefore: STORED.notifyBefore,
    notificationEnabled: STORED.notificationEnabled,
    ...overrides,
  };
}

async function enableSync(): Promise<void> {
  await getDb().syncMetadata.put({
    key: "sync_config",
    enabled: true,
    userId: "user-1",
    deviceId: "device-1",
    deviceName: "Test device",
    email: "test@example.com",
    provider: "test",
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
  });
}

describe("updateTask clearing optional fields (real DB)", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.tasks.put(STORED);
  });

  it("clears the due date when the editor saves None", async () => {
    await updateTask(STORED.id, editorDraft({ dueDate: undefined }));

    expect((await getDb().tasks.get(STORED.id))?.dueDate).toBeUndefined();
  });

  it("clears the estimate when the editor saves an empty field", async () => {
    await updateTask(STORED.id, editorDraft({ estimatedMinutes: undefined }));

    expect((await getDb().tasks.get(STORED.id))?.estimatedMinutes).toBeUndefined();
  });

  it("clears the reminder offset when the editor turns the reminder off", async () => {
    await updateTask(STORED.id, editorDraft({ notifyBefore: undefined, notificationEnabled: false }));

    expect((await getDb().tasks.get(STORED.id))?.notifyBefore).toBeUndefined();
  });

  it("keeps optional fields that a partial update leaves out", async () => {
    await updateTask(STORED.id, { title: "Renamed" });

    const saved = await getDb().tasks.get(STORED.id);
    expect(saved).toMatchObject({
      dueDate: STORED.dueDate,
      estimatedMinutes: STORED.estimatedMinutes,
      notifyBefore: STORED.notifyBefore,
    });
  });

  it("clears a snooze left over from the old due date", async () => {
    await getDb().tasks.put({
      ...STORED,
      notificationSent: true,
      snoozedUntil: "2026-05-01T06:00:00.000Z",
    });

    await updateTask(STORED.id, editorDraft({ dueDate: undefined }));

    expect(await getDb().tasks.get(STORED.id)).toMatchObject({
      notificationSent: false,
      snoozedUntil: undefined,
    });
  });

  it("queues an update that clears the fields on the wire", async () => {
    await enableSync();

    await updateTask(STORED.id, editorDraft({ dueDate: undefined, estimatedMinutes: undefined }));

    const [queued] = await getDb().syncQueue.toArray();
    expect(queued?.operation).toBe("update");
    expect(taskRecordToPocketBase(queued!.payload!, "user-1", "device-1")).toMatchObject({
      due_date: "",
      estimated_minutes: null,
    });
  });
});
