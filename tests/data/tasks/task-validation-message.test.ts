import { describe, it, expect, vi } from "vitest";
import { createTask } from "@/lib/tasks/crud/create";
import { taskValidationMessage, TaskValidationError } from "@/lib/tasks/crud/validation-error";
import type { TaskDraft } from "@/lib/types";

vi.mock("@/lib/db", () => ({ getDb: () => ({ tasks: { add: vi.fn() } }) }));
vi.mock("@/lib/tasks/crud/helpers", () => ({
  runTaskSyncTransaction: (mutation: (context: unknown) => Promise<unknown>) =>
    mutation({ syncEnabled: false, enqueue: vi.fn() }),
}));

const base: TaskDraft = { title: "Plan the week", description: "", urgent: false, important: false } as TaskDraft;

async function messageFor(draft: Partial<TaskDraft>): Promise<string | null> {
  const error = await createTask({ ...base, ...draft }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(TaskValidationError);
  return taskValidationMessage(error);
}

// "Failed to create task" for an 82-character sentence read as an app
// failure. The message now names the field and its limit.
describe("taskValidationMessage", () => {
  it("names the title limit", async () => {
    expect(await messageFor({ title: "x".repeat(81) })).toBe("Titles can be up to 80 characters.");
  });

  it("names the description limit", async () => {
    expect(await messageFor({ description: "x".repeat(601) })).toBe("Descriptions can be up to 600 characters.");
  });

  it("tells a tag count apart from a tag length", async () => {
    const tags = Array.from({ length: 21 }, (_, index) => `tag${index}`);
    expect(await messageFor({ tags })).toBe("A task can have up to 20 tags.");
    expect(await messageFor({ tags: ["x".repeat(31)] })).toBe("Tags can be up to 30 characters.");
  });

  it("names the subtask limits", async () => {
    const subtask = (title: string, index: number) => ({ id: `sub-${index}`, title, completed: false });
    const many = Array.from({ length: 51 }, (_, index) => subtask("Step", index));
    expect(await messageFor({ subtasks: many })).toBe("A task can have up to 50 subtasks.");
    expect(await messageFor({ subtasks: [subtask("x".repeat(101), 0)] })).toBe(
      "Subtask titles can be up to 100 characters."
    );
  });

  it("returns null for anything that is not a validation failure", () => {
    expect(taskValidationMessage(new Error("disk full"))).toBeNull();
  });
});
