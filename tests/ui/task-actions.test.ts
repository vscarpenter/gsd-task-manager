/**
 * The module-level matrix handlers that close over no component state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { snoozeTask } from "@/lib/tasks";
import { logError } from "@/lib/error-logger";
import { handleSnooze } from "@/components/matrix-simplified/task-actions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn(),
  toggleCompleted: vi.fn(),
  deleteTask: vi.fn(),
  snoozeTask: vi.fn(),
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
