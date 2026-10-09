import { describe, expect, it } from "vitest";
import { focusTaskCard, neighborFocusId } from "@/components/matrix-simplified/focus-after-removal";
import type { TaskRecord } from "@/lib/types";

function task(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title: id,
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

describe("neighborFocusId", () => {
  const tasks = [task("a"), task("b"), task("c"), task("other", { urgent: false })];

  it("chooses the following open task in the same quadrant", () => {
    expect(neighborFocusId(tasks, "b")).toBe("c");
  });

  it("falls back to the previous open task when nothing follows", () => {
    expect(neighborFocusId(tasks, "c")).toBe("b");
  });

  it("skips a completed neighbor", () => {
    const withDone = [task("a"), task("b", { completed: true }), task("c")];
    expect(neighborFocusId(withDone, "a")).toBe("c");
  });
});

describe("focusTaskCard", () => {
  it("focuses the first enabled button inside the card", () => {
    const card = document.createElement("article");
    card.dataset.taskId = "keep";
    const button = document.createElement("button");
    button.textContent = "Complete";
    card.append(button);
    document.body.append(card);

    expect(focusTaskCard("keep")).toBe(true);
    expect(document.activeElement).toBe(button);
    card.remove();
  });
});
