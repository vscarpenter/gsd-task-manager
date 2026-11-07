import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayStrip } from "@/components/today-strip/today-strip";
import { tidyDismissal } from "@/lib/top-three-session";
import { toast } from "sonner";
import { createMockTask } from "@/tests/fixtures";

const actions = vi.hoisted(() => ({
  addToToday: vi.fn(async () => "added"),
  removeFromToday: vi.fn(async () => {}),
  movePick: vi.fn(async () => {}),
  reorderPicks: vi.fn(async () => {}),
  tidyPicks: vi.fn(async () => {}),
}));
vi.mock("@/lib/tasks/top-three-actions", () => actions);

const NOW = new Date("2026-11-08T16:00:00.000Z");
const TODAY = "2026-11-08";
const q1 = (id: string, extra = {}) =>
  createMockTask({ id, title: `Task ${id}`, urgent: true, important: true, ...extra });

function setup(tasks = [q1("a")]) {
  const onToggleComplete = vi.fn();
  const onInspect = vi.fn();
  render(<TodayStrip tasks={tasks} onToggleComplete={onToggleComplete} onInspect={onInspect} />);
  return { onToggleComplete, onInspect, user: userEvent.setup() };
}

describe("TodayStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    Object.values(actions).forEach((fn) => fn.mockClear());
    tidyDismissal.reset();
  });
  afterEach(() => vi.useRealTimers());

  it("with no picks shows one line that opens the suggestions", async () => {
    const { user } = setup([q1("a"), q1("b")]);

    expect(screen.getByRole("region", { name: "Today, 0 of 3" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pick up to three for today" }));

    expect(screen.getAllByRole("button", { name: /Add to today/ })).toHaveLength(2);
  });

  describe("?pickToday=1 from the end of the weekly sweep", () => {
    afterEach(() => window.history.replaceState(null, "", "/"));

    it("opens the suggestions without a click and clears the parameter", () => {
      window.history.replaceState(null, "", "/?pickToday=1");

      setup([q1("a"), q1("b")]);

      expect(screen.getAllByRole("button", { name: /Add to today/ })).toHaveLength(2);
      expect(window.location.search).toBe("");
    });

    it("keeps other parameters when it clears its own", () => {
      window.history.replaceState(null, "", "/?pickToday=1&highlight=abc");

      setup([q1("a")]);

      expect(window.location.search).toBe("?highlight=abc");
    });

    it("clears the parameter and opens nothing when today is full", () => {
      window.history.replaceState(null, "", "/?pickToday=1");

      setup([
        q1("a", { focusDate: TODAY, focusRank: 1 }),
        q1("b", { focusDate: TODAY, focusRank: 2 }),
        q1("c", { focusDate: TODAY, focusRank: 3 }),
        q1("d"),
      ]);

      expect(screen.queryByRole("button", { name: /Add to today: Task d/ })).toBeNull();
      expect(window.location.search).toBe("");
    });

    it("leaves the suggestions closed when the parameter is absent", () => {
      setup([q1("a")]);

      expect(screen.queryByRole("button", { name: /Add to today/ })).toBeNull();
    });
  });

  it("says so when there is nothing to suggest", async () => {
    const { user } = setup([createMockTask({ id: "a", title: "Task a", urgent: false, important: false })]);

    await user.click(screen.getByRole("button", { name: "Pick up to three for today" }));

    expect(screen.getByText("Nothing to suggest right now.")).toBeInTheDocument();
  });

  it("shows the card's due chip on a pick row", () => {
    setup([q1("a", { focusDate: TODAY, focusRank: 1, dueDate: "2026-11-03T12:00:00.000Z" })]);

    expect(within(screen.getByRole("listitem")).getByText(/overdue/)).toBeInTheDocument();
  });

  it("keeps Not now until the next launch, not just until the strip remounts", async () => {
    const tasks = [q1("a", { focusDate: TODAY, focusRank: 1 }), q1("b", { focusDate: TODAY, focusRank: 1 })];
    const first = setup(tasks);
    await first.user.click(screen.getByRole("button", { name: "Not now" }));
    cleanup();

    setup(tasks);

    expect(screen.queryByText("Two devices picked for today. Tidy up?")).toBeNull();
  });

  describe("a refused add", () => {
    it("says Today is full, with no success toast and no announcement", async () => {
      actions.addToToday.mockResolvedValueOnce("full");
      const success = vi.spyOn(toast, "success");
      const message = vi.spyOn(toast, "message");
      const { user } = setup([q1("a"), q1("b", { focusDate: TODAY, focusRank: 1 })]);

      await user.click(screen.getByRole("button", { name: "Pick up to three for today" }));
      await user.click(screen.getByRole("button", { name: "Add to today: Task a" }));

      expect(message).toHaveBeenCalledWith("Today is full", expect.anything());
      expect(success).not.toHaveBeenCalled();
      expect(screen.getByTestId("today-status")).toHaveTextContent("");
    });
  });

  it("names the section and reads each row as first, second, or third", () => {
    setup([
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 2 }),
    ]);

    const region = screen.getByRole("region", { name: "Today, 2 of 3" });
    const rows = within(region).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Task a");
    expect(rows[0]).toHaveTextContent("first");
    expect(rows[1]).toHaveTextContent("second");
  });

  it("never uses the words missed, unfinished, or failed", () => {
    setup([q1("old", { focusDate: "2026-11-07", focusRank: 1 }), q1("a", { focusDate: TODAY, focusRank: 1 })]);

    expect(screen.getByTestId("today-strip").textContent).not.toMatch(/missed|unfinished|failed/i);
  });

  it("offers carry-over as From yesterday and adds on a tap", async () => {
    const { user } = setup([q1("old", { focusDate: "2026-11-07", focusRank: 1 })]);

    expect(screen.getByText("From yesterday")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add to today: Task old" }));

    expect(actions.addToToday).toHaveBeenCalledWith("old", expect.any(Array), expect.any(Date), expect.any(String));
  });

  it("hides carry-over while today is full", () => {
    setup([
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 2 }),
      q1("c", { focusDate: TODAY, focusRank: 3 }),
      q1("old", { focusDate: "2026-11-07", focusRank: 1 }),
    ]);

    expect(screen.queryByText("From yesterday")).toBeNull();
  });

  it("offers a tidy for two devices and writes nothing on Not now", async () => {
    const { user } = setup([
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 1 }),
    ]);

    expect(screen.getByText("Two devices picked for today. Tidy up?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Two devices picked for today. Tidy up?")).toBeNull();
    expect(actions.tidyPicks).not.toHaveBeenCalled();
  });

  it("tidies when the user accepts", async () => {
    const { user } = setup([
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 1 }),
    ]);

    await user.click(screen.getByRole("button", { name: "Tidy" }));

    expect(actions.tidyPicks).toHaveBeenCalledTimes(1);
  });

  describe("while the Tidy offer is up", () => {
    const duplicates = () => [
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 1 }),
    ];

    it("offers no Move up, Move down, or drag handle, because Tidy comes first", () => {
      setup(duplicates());

      expect(screen.getByText("Two devices picked for today. Tidy up?")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Move .* (up|down)$/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
    });

    it("keeps them locked after Not now, since the ranks are still doubled", async () => {
      const { user } = setup(duplicates());

      await user.click(screen.getByRole("button", { name: "Not now" }));

      expect(screen.queryByRole("button", { name: /^Move .* (up|down)$/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
    });

    it("still lets the person complete or remove a pick", () => {
      setup(duplicates());

      expect(screen.getAllByRole("button", { name: /^Mark .* as complete$/ })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /^Remove .* from today$/ })).toHaveLength(2);
    });

    it("brings the controls back once the ranks are clean", () => {
      setup([q1("a", { focusDate: TODAY, focusRank: 1 }), q1("b", { focusDate: TODAY, focusRank: 2 })]);

      expect(screen.getByRole("button", { name: "Move Task a down" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reorder Task a" })).toBeInTheDocument();
    });
  });

  it("moves a pick down and removes it from the row", async () => {
    const { user } = setup([
      q1("a", { focusDate: TODAY, focusRank: 1 }),
      q1("b", { focusDate: TODAY, focusRank: 2 }),
    ]);

    await user.click(screen.getByRole("button", { name: "Move Task a down" }));
    await user.click(screen.getByRole("button", { name: "Remove Task b from today" }));

    expect(actions.movePick).toHaveBeenCalledWith("a", "down", expect.any(Array), expect.any(Date), expect.any(String));
    expect(actions.removeFromToday).toHaveBeenCalledWith("b");
  });

  it("marks Move up on the first row and Move down on the last as unavailable, and keeps them focusable", async () => {
    const { user } = setup([q1("a", { focusDate: TODAY, focusRank: 1 }), q1("b", { focusDate: TODAY, focusRank: 2 })]);
    const up = screen.getByRole("button", { name: "Move Task a up" });

    expect(up).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Move Task b down" })).toHaveAttribute("aria-disabled", "true");
    await user.click(up);
    expect(actions.movePick).not.toHaveBeenCalled();
  });

  it("announces a move in a status region", async () => {
    const { user } = setup([q1("a", { focusDate: TODAY, focusRank: 1 }), q1("b", { focusDate: TODAY, focusRank: 2 })]);

    await user.click(screen.getByRole("button", { name: "Move Task a down" }));

    expect(await screen.findByTestId("today-status")).toHaveTextContent("Moved Task a down");
  });

  it("moves focus to the Today heading after a row is removed", async () => {
    const { user } = setup([q1("a", { focusDate: TODAY, focusRank: 1 })]);

    await user.click(screen.getByRole("button", { name: "Remove Task a from today" }));

    expect(screen.getByRole("heading", { name: "Today" })).toHaveFocus();
    expect(screen.getByTestId("today-status")).toHaveTextContent("Removed Task a from today");
  });

  it("says Couldn't, never Failed, when a write is refused", async () => {
    actions.removeFromToday.mockRejectedValueOnce(new Error("boom"));
    const toast = await import("sonner");
    const spy = vi.spyOn(toast.toast, "error");
    const { user } = setup([q1("a", { focusDate: TODAY, focusRank: 1 })]);

    await user.click(screen.getByRole("button", { name: "Remove Task a from today" }));

    expect(spy).toHaveBeenCalledWith("Couldn't remove that from today. Try again.", expect.anything());
    expect(String(spy.mock.calls[0][0])).not.toMatch(/failed/i);
  });

  it("completes a pick with the row's control", async () => {
    const { user, onToggleComplete } = setup([q1("a", { focusDate: TODAY, focusRank: 1 })]);

    await user.click(screen.getByRole("button", { name: "Mark Task a as complete" }));

    expect(onToggleComplete).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), true);
  });
});
