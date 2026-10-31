import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCardActions } from "@/components/task-card/task-card-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMockTask } from "@/tests/fixtures";
import { SNOOZE_PRESETS } from "@/lib/snooze-presets";

function renderActions(props: Partial<React.ComponentProps<typeof TaskCardActions>> = {}) {
  const task = props.task ?? createMockTask();
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

async function openSnoozeSubmenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Snooze" }));
}

describe("snooze presets", () => {
  it("match native: 15m, 30m, 1h, 3h, Tomorrow, Next week", () => {
    expect(SNOOZE_PRESETS.map((p) => [p.label, p.minutes])).toEqual([
      ["15 minutes", 15],
      ["30 minutes", 30],
      ["1 hour", 60],
      ["3 hours", 180],
      ["Tomorrow", 1440],
      ["Next week", 10080],
    ]);
  });
});

describe("card menu: Snooze", () => {
  it("lists the presets under Snooze in the menu a mouse user can reach", async () => {
    const { user } = renderActions({ onSnooze: vi.fn() });
    await openSnoozeSubmenu(user);
    const items = await screen.findAllByRole("menuitem", { name: /minutes|hour|Tomorrow|Next week/ });
    expect(items.map((i) => i.textContent)).toEqual(SNOOZE_PRESETS.map((p) => p.label));
    expect(screen.queryByRole("menuitem", { name: "Clear snooze" })).toBeNull();
  });

  it("snoozes for the chosen preset", async () => {
    const onSnooze = vi.fn();
    const { task, user } = renderActions({ onSnooze });
    await openSnoozeSubmenu(user);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Next week" }));
    expect(onSnooze).toHaveBeenCalledWith(task.id, 10080);
  });

  it("offers Clear snooze only while the task is snoozed", async () => {
    const onClearSnooze = vi.fn();
    const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const task = createMockTask({ snoozedUntil });
    const { user } = renderActions({ task, onSnooze: vi.fn(), onClearSnooze });
    await openSnoozeSubmenu(user);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear snooze" }));
    expect(onClearSnooze).toHaveBeenCalledWith(task.id);
  });

  it("is absent on a completed task and without a handler", async () => {
    const { user } = renderActions({ task: createMockTask({ completed: true }), onSnooze: vi.fn() });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Snooze" })).toBeNull();
  });
});
