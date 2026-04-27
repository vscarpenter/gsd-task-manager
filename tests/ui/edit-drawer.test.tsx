import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const mockTask: TaskRecord = {
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

describe("<EditDrawer>", () => {
  it("submits updated title and disables save when title is empty", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("Original title");

    await userEvent.clear(titleInput);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated title" }),
      "t1"
    );
  });

  it("Esc closes the drawer", async () => {
    const onClose = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={onClose} onSubmit={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("quadrant picker switches urgent/important flags", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /^schedule$/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ urgent: false, important: true }),
      "t1"
    );
  });
});
