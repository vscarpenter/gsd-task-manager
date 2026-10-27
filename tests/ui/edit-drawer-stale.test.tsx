import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { changedDraftFields } from "@/components/matrix-simplified/use-edit-draft-state";
import type { TaskRecord } from "@/lib/types";

const task = {
  id: "t1",
  title: "Original title",
  description: "",
  urgent: true,
  important: true,
  quadrant: "urgent-important",
  completed: false,
  tags: ["work"],
  subtasks: [],
  dependencies: [],
  recurrence: "none",
  notificationEnabled: false,
  notificationSent: false,
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

describe("saving from a drawer that may be stale (second tab)", () => {
  it("hands over only the fields this drawer changed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EditDrawer open task={task} onClose={vi.fn()} onSubmit={onSubmit} />);
    // The title takes focus after a short delay and would steal the keystrokes.
    await waitFor(() => expect(screen.getByTestId("edit-title")).toHaveFocus());
    await user.type(screen.getByTestId("edit-description"), "More detail");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, taskId, changed] = onSubmit.mock.calls[0];
    expect(taskId).toBe("t1");
    expect(changed).toEqual({ description: "More detail" });
  });

  it("keeps a cleared optional field in the change set as undefined", () => {
    const start = { title: "a", estimatedMinutes: 30 } as never;
    const now = { title: "a", estimatedMinutes: undefined } as never;
    const changed = changedDraftFields(start, now);
    expect("estimatedMinutes" in changed).toBe(true);
    expect(changed).not.toHaveProperty("title");
  });
});
