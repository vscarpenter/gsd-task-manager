import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createTask } from "@/lib/tasks/crud/create";
import type { TaskDraft } from "@/lib/types";

const { mockAdd, mockGetSyncContext, mockEnqueue } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetSyncContext: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ tasks: { add: mockAdd } }),
}));

vi.mock("@/lib/tasks/crud/helpers", () => ({
  getSyncContext: mockGetSyncContext,
  enqueueSyncOperation: mockEnqueue,
}));

/**
 * Regression for #400: task content (title/description) must never be written
 * to the browser console on a failed create — neither on a Zod validation
 * failure nor on a database-write failure. Only field names, Zod error codes,
 * and the operation name are safe to log.
 */
describe("createTask logging redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSyncContext.mockResolvedValue({ syncConfig: { enabled: false } });
    mockEnqueue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not log task description content on validation failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const secretDescription = "DIAGNOSIS_RESULTS_DO_NOT_LEAK";
    const invalidDraft = {
      title: "", // empty title fails z.string().min(1)
      description: secretDescription,
      urgent: true,
      important: false,
    } as TaskDraft;

    await expect(createTask(invalidDraft)).rejects.toThrow(
      /Task validation failed/
    );

    const logged = consoleErrorSpy.mock.calls
      .map((call) => JSON.stringify(call))
      .join("|");

    expect(logged).not.toContain(secretDescription);
    // Field names remain useful and are safe to log.
    expect(logged).toContain("title");
  });

  it("should not log task title or description content on database-write failure", async () => {
    mockAdd.mockRejectedValue(new Error("DB write failed"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const secretTitle = "SECRET_DB_TITLE_NO_LEAK";
    const secretDescription = "SECRET_DB_DESC_NO_LEAK";
    const validDraft = {
      title: secretTitle,
      description: secretDescription,
      urgent: true,
      important: false,
    } as TaskDraft;

    await expect(createTask(validDraft)).rejects.toThrow(
      /Failed to create task/
    );

    const logged = consoleErrorSpy.mock.calls
      .map((call) => JSON.stringify(call))
      .join("|");

    expect(logged).not.toContain(secretTitle);
    expect(logged).not.toContain(secretDescription);
    // Operation context is non-content and safe to log.
    expect(logged).toContain("create");
  });
});
