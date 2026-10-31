/**
 * The module-level matrix handlers that close over no component state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createTask, snoozeTask, updateTask } from "@/lib/tasks";
import { TaskValidationError } from "@/lib/tasks/crud/validation-error";
import { saveTaskForLater, returnSavedTask } from "@/lib/tasks/saved";
import { createMockTask } from "@/tests/fixtures";
import { logError } from "@/lib/error-logger";
import { captureAndReveal, handleCapture, handleSnooze, handleSaveForLater, handleMarkUrgent } from "@/components/matrix-simplified/task-actions";

vi.mock("@/lib/tasks/saved", () => ({ saveTaskForLater: vi.fn(), returnSavedTask: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn(),
  toggleCompleted: vi.fn(),
  deleteTask: vi.fn(),
  snoozeTask: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

vi.mock("@/lib/confetti", () => ({ celebrateCompletion: vi.fn() }));

describe("handleSnooze", () => {
  beforeEach(() => {
    vi.mocked(snoozeTask).mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(logError).mockClear();
  });

  it("snoozes the task for the requested hour and confirms it", async () => {
    vi.mocked(snoozeTask).mockResolvedValue({} as never);

    await handleSnooze("task-1", 60);

    expect(snoozeTask).toHaveBeenCalledWith("task-1", 60);
    expect(toast.success).toHaveBeenCalledWith("Snoozed for 1 hour", expect.any(Object));
  });

  it("names shorter presets in minutes", async () => {
    vi.mocked(snoozeTask).mockResolvedValue({} as never);

    await handleSnooze("task-1", 30);

    expect(toast.success).toHaveBeenCalledWith("Snoozed for 30 minutes", expect.any(Object));
  });

  it("reports a failed snooze through the error path instead of swallowing it", async () => {
    const failure = new Error("boom");
    vi.mocked(snoozeTask).mockRejectedValue(failure);

    await handleSnooze("task-1", 60);

    expect(toast.error).toHaveBeenCalledWith("Failed to snooze task", expect.any(Object));
    expect(logError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ action: "snooze_task", taskId: "task-1" })
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("handleSaveForLater", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("offers an Undo with the original quadrant and due date", async () => {
    const task = createMockTask({ dueDate: "2026-11-01T16:00:00.000Z" });
    vi.mocked(saveTaskForLater).mockResolvedValue(task);
    vi.mocked(returnSavedTask).mockResolvedValue(task);
    const offerUndo = vi.fn();
    await expect(handleSaveForLater(task, offerUndo)).resolves.toBe(true);
    expect(saveTaskForLater).toHaveBeenCalledWith(task.id);
    expect(offerUndo).toHaveBeenCalledWith("Moved to Saved", expect.any(Function));
    await offerUndo.mock.calls[0][1]();
    expect(returnSavedTask).toHaveBeenCalledWith(task.id, task.quadrant, task.dueDate);
  });
  it("reports a running timer without falsely confirming a save", async () => {
    const task = createMockTask();
    vi.mocked(saveTaskForLater).mockRejectedValue(new Error("Stop the timer before moving this task to Saved"));
    const offerUndo = vi.fn();
    await expect(handleSaveForLater(task, offerUndo)).resolves.toBe(false);
    expect(offerUndo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Stop the timer before moving this task to Saved", expect.anything());
  });
});

describe("handleCapture", () => {
  beforeEach(() => {
    vi.mocked(createTask).mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  // "Task added" while the card landed off-screen left people hunting for it.
  it("returns the new task and names the quadrant it landed in", async () => {
    const created = createMockTask({ id: "new-1", urgent: false, important: false });
    vi.mocked(createTask).mockResolvedValue(created);

    const result = await handleCapture({ title: "Call the dentist", urgent: false, important: false, tags: [] });

    expect(result).toBe(created);
    expect(toast.success).toHaveBeenCalledWith("Added to Eliminate", expect.any(Object));
  });

  it("says which limit a capture broke instead of a bare failure", async () => {
    vi.mocked(createTask).mockRejectedValue(
      new TaskValidationError([{ path: ["title"], code: "too_big", origin: "string", maximum: 80 }], "title (too_big)")
    );

    const result = await handleCapture({ title: "x".repeat(81), urgent: false, important: false, tags: [] });

    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Titles can be up to 80 characters.", expect.any(Object));
  });
});

describe("captureAndReveal", () => {
  beforeEach(() => {
    vi.mocked(createTask).mockReset();
  });

  it("reveals the new task and reports success", async () => {
    vi.mocked(createTask).mockResolvedValue(createMockTask({ id: "new-2" }));
    const reveal = vi.fn();

    await expect(captureAndReveal({ title: "Pay rent", urgent: true, important: true, tags: [] }, reveal)).resolves.toBe(true);
    expect(reveal).toHaveBeenCalledWith("new-2");
  });

  it("reveals nothing and keeps the draft when the save fails", async () => {
    vi.mocked(createTask).mockRejectedValue(new Error("disk full"));
    const reveal = vi.fn();

    await expect(captureAndReveal({ title: "Pay rent", urgent: true, important: true, tags: [] }, reveal)).resolves.toBe(false);
    expect(reveal).not.toHaveBeenCalled();
  });
});

describe("handleMarkUrgent", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("sets urgent through updateTask and offers an Undo that clears it", async () => {
    const task = createMockTask({ urgent: false, important: true });
    vi.mocked(updateTask).mockResolvedValue({ ...task, urgent: true } as never);
    const offerUndo = vi.fn();
    await handleMarkUrgent(task, offerUndo);
    expect(updateTask).toHaveBeenCalledWith(task.id, { urgent: true });
    expect(offerUndo).toHaveBeenCalledWith("Moved to Do First", expect.any(Function));
    await offerUndo.mock.calls[0][1]();
    expect(updateTask).toHaveBeenLastCalledWith(task.id, { urgent: false });
  });

  it("names Delegate for an Eliminate task", async () => {
    const task = createMockTask({ urgent: false, important: false });
    vi.mocked(updateTask).mockResolvedValue({ ...task, urgent: true } as never);
    const offerUndo = vi.fn();
    await handleMarkUrgent(task, offerUndo);
    expect(offerUndo).toHaveBeenCalledWith("Moved to Delegate", expect.any(Function));
  });

  it("reports a failed update and offers no Undo", async () => {
    const task = createMockTask();
    vi.mocked(updateTask).mockRejectedValue(new Error("boom"));
    const offerUndo = vi.fn();
    await handleMarkUrgent(task, offerUndo);
    expect(offerUndo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
