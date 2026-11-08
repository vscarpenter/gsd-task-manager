import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { TodayMenuProvider, useTodayMenu } from "@/components/today-strip/today-menu-context";
import { createMockTask } from "@/tests/fixtures";

const actions = vi.hoisted(() => ({
  addToToday: vi.fn(async () => "added"),
  removeFromToday: vi.fn(async () => {}),
}));
vi.mock("@/lib/tasks/top-three-actions", () => actions);

const task = createMockTask({ id: "a", title: "Task a" });

function AddButton() {
  const menu = useTodayMenu();
  return <button onClick={() => menu?.add(task)}>add</button>;
}

describe("TodayMenuProvider: a refused add", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says Today is full and shows no success toast", async () => {
    actions.addToToday.mockResolvedValueOnce("full");
    const success = vi.spyOn(toast, "success");
    const message = vi.spyOn(toast, "message");
    render(<TodayMenuProvider tasks={[task]}><AddButton /></TodayMenuProvider>);

    await userEvent.setup().click(screen.getByRole("button", { name: "add" }));

    expect(message).toHaveBeenCalledWith("Today is full", expect.anything());
    expect(success).not.toHaveBeenCalled();
  });

  it("still confirms a real add", async () => {
    const success = vi.spyOn(toast, "success");
    render(<TodayMenuProvider tasks={[task]}><AddButton /></TodayMenuProvider>);

    await userEvent.setup().click(screen.getByRole("button", { name: "add" }));

    expect(success).toHaveBeenCalledWith("Added to today", expect.anything());
  });
});
