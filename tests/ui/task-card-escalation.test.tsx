import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { TaskCard } from "@/components/task-card";
import { ESCALATION_WINDOW_KEY, writeEscalationWindow } from "@/lib/preferences/escalation-window";
import type { TaskRecord } from "@/lib/types";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: () => "" } } }));

function dueInDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    title: "File the report",
    description: "",
    urgent: false,
    important: true,
    quadrant: "not-urgent-important",
    completed: false,
    dueDate: dueInDays(1),
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    notificationEnabled: true,
    notificationSent: false,
    ...overrides,
  };
}

const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onToggleComplete: vi.fn() };

function renderCard(task: TaskRecord, onMarkUrgent = vi.fn()) {
  render(<TaskCard task={task} allTasks={[task]} {...handlers} onMarkUrgent={onMarkUrgent} />);
  return onMarkUrgent;
}

describe("TaskCard escalation", () => {
  beforeEach(() => window.localStorage.removeItem(ESCALATION_WINDOW_KEY));
  afterEach(() => window.localStorage.removeItem(ESCALATION_WINDOW_KEY));

  it("tags a Schedule task due tomorrow with its accessible name", () => {
    renderCard(makeTask());
    const tag = screen.getByTestId("task-card-escalating-tag");
    expect(tag).toHaveTextContent("Escalating");
    expect(tag).toHaveAccessibleName("Escalating: due tomorrow, not marked urgent.");
    expect(tag.style.color).toBe("var(--q1-ink)");
  });

  it("keeps the spec's accessible name for a task with a due time", () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(15, 30, 0, 0);
    renderCard(makeTask({ dueDate: date.toISOString() }));
    expect(screen.getByTestId("task-card-escalating-tag")).toHaveAccessibleName(
      "Escalating: due tomorrow, not marked urgent."
    );
  });

  it("uses the Delegate ink for an Eliminate task", () => {
    renderCard(makeTask({ important: false, quadrant: "not-urgent-not-important" }));
    expect(screen.getByTestId("task-card-escalating-tag").style.color).toBe("var(--q3-ink)");
  });

  it.each([
    ["an urgent task", { urgent: true, quadrant: "urgent-important" as const }],
    ["a task with no due date", { dueDate: undefined }],
    ["a completed task", { completed: true }],
    ["a task due outside the window", { dueDate: dueInDays(5) }],
  ])("does not tag %s", (_label, overrides) => {
    renderCard(makeTask(overrides));
    expect(screen.queryByTestId("task-card-escalating-tag")).toBeNull();
    expect(screen.queryByRole("button", { name: /mark urgent/i })).toBeNull();
  });

  it("removes the tag when the setting is Off, live", () => {
    renderCard(makeTask());
    expect(screen.getByTestId("task-card-escalating-tag")).toBeInTheDocument();
    act(() => writeEscalationWindow(null));
    expect(screen.queryByTestId("task-card-escalating-tag")).toBeNull();
  });

  it("server-renders the default window without touching the browser", () => {
    const task = makeTask();
    const html = renderToString(<TaskCard task={task} allTasks={[task]} {...handlers} />);
    expect(html).toContain("Escalating: due tomorrow, not marked urgent.");
  });

  it("widens with the setting", () => {
    window.localStorage.setItem(ESCALATION_WINDOW_KEY, "7");
    renderCard(makeTask({ dueDate: dueInDays(5) }));
    expect(screen.getByTestId("task-card-escalating-tag")).toBeInTheDocument();
  });

  it("offers Mark urgent on the hover icons with the destination hint", async () => {
    const onMarkUrgent = renderCard(makeTask());
    const button = screen.getByRole("button", { name: "Mark urgent, moves to Do First" });
    await userEvent.click(button);
    expect(onMarkUrgent).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
  });

  it("offers Mark urgent in the more-actions menu with the Delegate hint", async () => {
    const onMarkUrgent = renderCard(makeTask({ important: false, quadrant: "not-urgent-not-important" }));
    await userEvent.click(screen.getByTestId("task-card-menu"));
    expect(screen.getByText("Moves to Delegate")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("mark-urgent-menu"));
    expect(onMarkUrgent).toHaveBeenCalledTimes(1);
  });
});

describe("TaskCard escalation across midnight", () => {
  beforeEach(() => {
    window.localStorage.removeItem(ESCALATION_WINDOW_KEY);
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 29, 23, 30, 0));
  });
  afterEach(() => vi.useRealTimers());

  const dueNov2 = () => new Date(2026, 10, 1, 12, 0, 0).toISOString();

  it("adds the tag when the local day rolls over while the card stays mounted", () => {
    renderCard(makeTask({ dueDate: dueNov2() }));
    expect(screen.queryByTestId("task-card-escalating-tag")).toBeNull();
    act(() => vi.advanceTimersByTime(31 * 60 * 1000));
    expect(screen.getByTestId("task-card-escalating-tag")).toHaveAccessibleName(
      "Escalating: due in 2 days, not marked urgent."
    );
  });

  it("re-evaluates when a suspended tab becomes visible again", () => {
    renderCard(makeTask({ dueDate: dueNov2() }));
    vi.setSystemTime(new Date(2026, 9, 31, 9, 0, 0));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByTestId("task-card-escalating-tag")).toHaveAccessibleName(
      "Escalating: due tomorrow, not marked urgent."
    );
  });
});
