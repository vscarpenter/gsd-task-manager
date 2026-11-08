import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "@/components/task-card";
import { TodayMenuContext, type TodayMenu } from "@/components/today-strip/today-menu-context";
import type { TaskRecord } from "@/lib/types";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: null, isDragging: false }),
}));
vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: () => "" } } }));

const task: TaskRecord = {
  id: "task-1", title: "File the report", description: "", urgent: true, important: true,
  quadrant: "urgent-important", completed: false, recurrence: "none", tags: [], subtasks: [],
  dependencies: [], createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
  notificationEnabled: true, notificationSent: false,
};

async function openMenu(menu: TodayMenu | null) {
  const user = userEvent.setup();
  render(
    <TodayMenuContext.Provider value={menu}>
      <TaskCard task={task} allTasks={[task]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleComplete={vi.fn()} />
    </TodayMenuContext.Provider>
  );
  await user.click(screen.getByTestId("task-card-menu"));
  return user;
}

describe("card menu: Today", () => {
  it("offers Add to today and runs it", async () => {
    const add = vi.fn();
    const user = await openMenu({ isPicked: () => false, isFull: false, add, remove: vi.fn() });

    await user.click(screen.getByRole("menuitem", { name: "Add to today" }));

    expect(add).toHaveBeenCalledWith(task);
  });

  it("offers Remove from today for a pick", async () => {
    const remove = vi.fn();
    const user = await openMenu({ isPicked: () => true, isFull: true, add: vi.fn(), remove });

    await user.click(screen.getByRole("menuitem", { name: "Remove from today" }));

    expect(remove).toHaveBeenCalledWith(task);
  });

  it("reads Today is full, disabled, when no slot is free", async () => {
    await openMenu({ isPicked: () => false, isFull: true, add: vi.fn(), remove: vi.fn() });

    expect(screen.getByRole("menuitem", { name: "Today is full" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows nothing without a Today provider", async () => {
    await openMenu(null);

    expect(screen.queryByRole("menuitem", { name: /today/i })).toBeNull();
  });

  it("hides it for a completed task", async () => {
    const user = userEvent.setup();
    render(
      <TodayMenuContext.Provider value={{ isPicked: () => false, isFull: false, add: vi.fn(), remove: vi.fn() }}>
        <TaskCard task={{ ...task, completed: true }} allTasks={[task]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleComplete={vi.fn()} />
      </TodayMenuContext.Provider>
    );
    await user.click(screen.getByTestId("task-card-menu"));

    expect(screen.queryByRole("menuitem", { name: /today/i })).toBeNull();
  });
});
