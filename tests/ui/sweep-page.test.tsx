import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SweepPage from "@/components/weekly-sweep/sweep-page";
import { SWEEP_LAST_SWEPT_KEY, readLastSwept } from "@/lib/preferences/weekly-sweep";
import { createMockTask } from "@/tests/fixtures";

const mocks = vi.hoisted(() => ({
  tasks: [] as unknown[],
  push: vi.fn(),
  setDueDay: vi.fn(async () => true),
  completeTask: vi.fn(async () => true),
}));

vi.mock("@/lib/use-tasks", () => ({ useTasks: () => ({ all: mocks.tasks, isLoading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/sweep" }));
vi.mock("@/components/matrix-simplified/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/weekly-sweep/sweep-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/weekly-sweep/sweep-actions")>()),
  setDueDay: mocks.setDueDay,
  completeTask: mocks.completeTask,
}));

const NOW = new Date();
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const overdue = (id: string) => createMockTask({ id, title: `Task ${id}`, dueDate: daysAgo(5), updatedAt: daysAgo(1), urgent: false, important: false });
const BANNED = /behind|neglected|still|missed|forgot|streak|score/i;

describe("SweepPage", () => {
  beforeEach(() => {
    localStorage.removeItem(SWEEP_LAST_SWEPT_KEY);
    Object.values(mocks).forEach((m) => typeof m === "function" && "mockClear" in m && m.mockClear());
    mocks.tasks = [overdue("a"), overdue("b")];
  });

  it("shows one card with its reason line and a position line", () => {
    render(<SweepPage />);

    expect(screen.getByRole("article", { name: "Task a" })).toBeInTheDocument();
    expect(screen.getByText("Due date passed")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2");
  });

  it("Skip goes to the next card and writes nothing", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByRole("article", { name: "Task b" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 of 2");
    expect(mocks.completeTask).not.toHaveBeenCalled();
    expect(readLastSwept()).toBeNull();
  });

  it("an action runs the existing path and moves on", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "Complete" }));

    expect(mocks.completeTask).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), expect.any(Function));
    expect(await screen.findByRole("article", { name: "Task b" })).toBeInTheDocument();
  });

  it("New date offers presets and a date picker, then runs the edit", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "New date" }));
    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(mocks.setDueDay).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(Function));
  });

  it("ends on That's the sweep with a way to pick today's top three, and stamps", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByRole("heading", { name: "That's the sweep." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick today's top three" })).toHaveAttribute("href", "/?pickToday=1");
    expect(readLastSwept()).not.toBeNull();
  });

  describe("the end offer follows top three's free slot", () => {
    const today = new Intl.DateTimeFormat("en-CA").format(new Date());
    const pick = (id: string, rank: number) =>
      createMockTask({ id, title: `Pick ${id}`, urgent: true, important: true, updatedAt: daysAgo(0), focusDate: today, focusRank: rank });

    async function sweepToTheEnd(tasks: unknown[]) {
      mocks.tasks = tasks;
      const user = userEvent.setup();
      render(<SweepPage />);
      await user.click(screen.getByRole("button", { name: "Skip" }));
    }

    it("offers Pick today's top three while today has a free slot", async () => {
      await sweepToTheEnd([overdue("a"), pick("p1", 1)]);

      expect(screen.getByRole("heading", { name: "That's the sweep." })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Pick today's top three" })).toBeInTheDocument();
    });

    it("ends on That's the sweep alone when today is full", async () => {
      await sweepToTheEnd([overdue("a"), pick("p1", 1), pick("p2", 2), pick("p3", 3)]);

      expect(screen.getByRole("heading", { name: "That's the sweep." })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Pick today's top three" })).toBeNull();
      expect(screen.getByRole("link", { name: "Back to the matrix" })).toBeInTheDocument();
    });

    it("counts a completed pick as a free slot again", async () => {
      await sweepToTheEnd([overdue("a"), { ...pick("p1", 1), completed: true }, pick("p2", 2), pick("p3", 3)]);

      expect(screen.getByRole("link", { name: "Pick today's top three" })).toBeInTheDocument();
    });
  });

  it("moves focus to the end screen heading so it is announced", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByRole("heading", { name: "That's the sweep." })).toHaveFocus();
  });

  it("opens the New date panel as a labelled group, focuses it, and Escape closes it", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);
    const trigger = screen.getByRole("button", { name: "New date" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("group", { name: "Choose a new date" });
    expect(within(group).getByRole("button", { name: "Today" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Choose a new date" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("Done stamps this device and goes back to the matrix", async () => {
    const user = userEvent.setup();
    render(<SweepPage />);

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(readLastSwept()).not.toBeNull();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("with nothing to do says so at once and stamps nothing", () => {
    mocks.tasks = [createMockTask({ id: "fresh", updatedAt: daysAgo(0) })];

    render(<SweepPage />);

    expect(screen.getByRole("heading", { name: "That's the sweep." })).toBeInTheDocument();
    expect(readLastSwept()).toBeNull();
  });

  it("uses none of the banned words and counts nothing beyond the position line", async () => {
    const { container } = render(<SweepPage />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(BANNED);
    const position = within(container).getByRole("status").textContent ?? "";
    expect(text.replace(position, "").match(/\d+ (tasks?|cards?|left|remaining)/i)).toBeNull();
  });
});
