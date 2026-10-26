import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCardActions } from "@/components/task-card/task-card-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMockTask } from "@/tests/fixtures";

it("offers an accessible Move to Saved action for an incomplete task", async () => {
  const onSave = vi.fn(); const task = createMockTask();
  render(<TooltipProvider><TaskCardActions task={task} taskIsOverdue={false} taskIsDueToday={false} overdueDays={0} onEdit={vi.fn()} onDelete={vi.fn()} onSave={onSave} /></TooltipProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Move to Saved" }));
  expect(onSave).toHaveBeenCalledWith(task);
});

it("keeps the shared desktop actions attached to the correct task", async () => {
  const task = createMockTask();
  const onShare = vi.fn(), onDuplicate = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn();
  render(<TooltipProvider><TaskCardActions task={task} taskIsOverdue={false} taskIsDueToday={false} overdueDays={0} onEdit={onEdit} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} /></TooltipProvider>);
  const user = userEvent.setup();
  for (const label of ["Share task", "Duplicate task", "Edit task", "Delete task"]) {
    await user.click(screen.getAllByRole("button", { name: label, exact: true })[0]);
  }
  for (const action of [onShare, onDuplicate, onEdit, onDelete]) expect(action).toHaveBeenCalledWith(task);
});

it("offers Move to Saved in the mobile menu", async () => {
  const task = createMockTask(), onSave = vi.fn(), onEdit = vi.fn();
  render(<TooltipProvider><TaskCardActions task={task} taskIsOverdue={false} taskIsDueToday={false} overdueDays={0} onEdit={onEdit} onDelete={vi.fn()} onSave={onSave} /></TooltipProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByTestId("edit-task-mobile"));
  expect(onEdit).toHaveBeenCalledWith(task);
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Move to Saved" }));
  expect(onSave).toHaveBeenCalledWith(task);
});

it("keeps completed work out of Saved", () => {
  const task = createMockTask({ completed: true });
  render(<TooltipProvider><TaskCardActions task={task} taskIsOverdue={false} taskIsDueToday={false} overdueDays={0} onEdit={vi.fn()} onDelete={vi.fn()} onSave={vi.fn()} /></TooltipProvider>);
  expect(screen.queryByRole("button", { name: "Move to Saved" })).not.toBeInTheDocument();
});
