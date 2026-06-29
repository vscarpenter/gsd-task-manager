import { describe, it, expect, vi, afterEach } from "vitest";
import { createTask } from "@/lib/tasks/crud/create";
import type { TaskDraft } from "@/lib/types";

/**
 * Regression for #400: a validation failure must never write raw task content
 * (title/description) to the browser console. Only field names + Zod error
 * codes are safe to log.
 */
describe("createTask validation logging redaction", () => {
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
});
