import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCardActions } from "@/components/task-card/task-card-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMockTask } from "@/tests/fixtures";

function renderActions(props: Partial<React.ComponentProps<typeof TaskCardActions>> = {}) {
  const task = props.task ?? createMockTask({ urgent: false, important: true, quadrant: "not-urgent-important" });
  render(
    <TooltipProvider>
      <TaskCardActions
        task={task}
        taskIsOverdue={false}
        taskIsDueToday={false}
        overdueDays={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        {...props}
      />
    </TooltipProvider>
  );
  return { task, user: userEvent.setup() };
}

describe("card menu: Duplicate and Move to", () => {
  it("duplicates from the menu", async () => {
    const onDuplicate = vi.fn();
    const { task, user } = renderActions({ onDuplicate });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith(task);
  });

  it("lists the four quadrants under Move to, with the current one disabled", async () => {
    const { user } = renderActions({ onMoveTo: vi.fn() });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move to" }));
    const items = await screen.findAllByRole("menuitem", { name: /Do First|Schedule|Delegate|Eliminate/ });
    expect(items.map((i) => i.textContent)).toEqual(["Do First", "Schedule", "Delegate", "Eliminate"]);
    expect(screen.getByRole("menuitem", { name: "Schedule" })).toHaveAttribute("aria-disabled", "true");
  });

  it("moves to the chosen quadrant", async () => {
    const onMoveTo = vi.fn();
    const { task, user } = renderActions({ onMoveTo });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move to" }));
    // Radix closes a submenu when the synthetic pointer leaves its trigger, so click the item directly.
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delegate" }));
    expect(onMoveTo).toHaveBeenCalledWith(task, "urgent-not-important");
  });

  it("offers no Move to without a handler", async () => {
    const { user } = renderActions();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Move to" })).toBeNull();
  });

  it("keeps one More actions trigger, visible to a mouse user on hover at sm and up", () => {
    renderActions({ onMoveTo: vi.fn() });
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger.className).toContain("sm:group-hover:opacity-100");
    expect(trigger.className).toContain("sm:group-focus-within:opacity-100");
  });
});
