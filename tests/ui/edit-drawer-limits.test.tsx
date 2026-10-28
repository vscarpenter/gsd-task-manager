import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import type { TaskRecord } from "@/lib/types";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "t1",
    title: "Original title",
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed: false,
    tags: [],
    subtasks: [],
    dependencies: [],
    recurrence: "none",
    notificationEnabled: false,
    notificationSent: false,
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
    ...overrides,
  } as TaskRecord;
}

async function renderDrawer(task: TaskRecord, onSubmit = vi.fn()) {
  const view = render(<EditDrawer open task={task} onClose={vi.fn()} onSubmit={onSubmit} />);
  await waitFor(() => expect(screen.getByTestId("edit-title")).toHaveFocus());
  return { ...view, onSubmit };
}

describe("edit drawer input limits", () => {
  it("caps the text inputs at the schema limits", async () => {
    await renderDrawer(makeTask());
    // The title has no cap: a pasted link moves to the description on save.
    expect(screen.getByTestId("edit-title")).not.toHaveAttribute("maxlength");
    expect(screen.getByTestId("edit-description")).toHaveAttribute("maxlength", String(SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH));
    expect(screen.getByLabelText("Add a tag")).toHaveAttribute("maxlength", String(SCHEMA_LIMITS.TAG_MAX_LENGTH));
    expect(screen.getByLabelText("Add a subtask")).toHaveAttribute("maxlength", String(SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH));
  });

  it("stops adding tags at the limit and says so", async () => {
    const tags = Array.from({ length: SCHEMA_LIMITS.MAX_TAGS }, (_, i) => `tag${i}`);
    await renderDrawer(makeTask({ tags }));
    expect(screen.getByText(/up to 20 tags/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Add a tag")).toBeDisabled();
  });

  it("does not add a 21st tag even when one is committed", async () => {
    const user = userEvent.setup();
    const tags = Array.from({ length: SCHEMA_LIMITS.MAX_TAGS - 1 }, (_, i) => `tag${i}`);
    await renderDrawer(makeTask({ tags }));
    await user.type(screen.getByLabelText("Add a tag"), "last{Enter}");
    expect(screen.getByText(/up to 20 tags/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^remove /i })).toHaveLength(SCHEMA_LIMITS.MAX_TAGS);
  });

  it("stops adding subtasks at the limit and says so", async () => {
    const subtasks = Array.from({ length: SCHEMA_LIMITS.MAX_SUBTASKS }, (_, i) => ({
      id: `s${i}x`,
      title: `step ${i}`,
      completed: false,
    }));
    await renderDrawer(makeTask({ subtasks }));
    expect(screen.getByText(/up to 50 subtasks/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Add a subtask")).toBeDisabled();
  });

  it("shows a visible Title label tied to the input", async () => {
    await renderDrawer(makeTask());
    const label = screen.getByText("Title", { selector: "span" });
    expect(label).toBeVisible();
    expect(screen.getByLabelText("Title")).toBe(screen.getByTestId("edit-title"));
  });

  it("treats a zero-width title as empty: Save is disabled and nothing submits", async () => {
    const { onSubmit } = await renderDrawer(makeTask());
    fireEvent.change(screen.getByTestId("edit-title"), { target: { value: "​‍﻿" } });
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    fireEvent.submit(screen.getByTestId("save-task").closest("form") as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
