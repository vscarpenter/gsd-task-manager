/**
 * Touch swipe actions on a task card.
 *
 * One gesture vocabulary with the iOS app: a rightward swipe reveals Complete (a
 * full swipe commits it), a leftward swipe reveals Snooze then Delete. Only a touch
 * pointer starts a swipe; the mouse never sees any of this.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTask } from "@/tests/fixtures";
import { TaskCard } from "@/components/task-card";
import { SwipeableTaskCard } from "@/components/task-card/swipeable-task-card";
import { SWIPE_CONFIG } from "@/lib/constants";
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

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const ROW_WIDTH = 340;
const OPEN_LEADING = SWIPE_CONFIG.BUTTON_WIDTH * SWIPE_CONFIG.OPEN_FRACTION + 10;
const OPEN_TRAILING = -(SWIPE_CONFIG.BUTTON_WIDTH * 2 * SWIPE_CONFIG.OPEN_FRACTION + 10);
const FULL_SWIPE = ROW_WIDTH * SWIPE_CONFIG.FULL_SWIPE_FRACTION + 10;

const touch = { pointerType: "touch", pointerId: 1, isPrimary: true } as const;
const mouse = { pointerType: "mouse", pointerId: 2, isPrimary: true } as const;

function handlers() {
  return {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn(),
    onInspect: vi.fn(),
    onSnooze: vi.fn().mockResolvedValue(undefined),
  };
}

function renderCard(task: TaskRecord, overrides: Partial<ReturnType<typeof handlers>> = {}) {
  const props = { ...handlers(), ...overrides };
  render(<SwipeableTaskCard task={task} allTasks={[task]} {...props} />);
  return props;
}

function surfaceFor(title: string): HTMLElement {
  const row = screen.getAllByTestId("task-card-swipe").find((candidate) =>
    within(candidate).queryByText(title)
  );
  if (!row) throw new Error(`No swipe row for ${title}`);
  return within(row).getByTestId("task-card-swipe-surface");
}

function drag(
  surface: HTMLElement,
  pointer: typeof touch | typeof mouse,
  dx: number,
  dy = 0
) {
  fireEvent.pointerDown(surface, { ...pointer, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(surface, { ...pointer, clientX: 100 + dx / 2, clientY: 100 + dy / 2 });
  fireEvent.pointerMove(surface, { ...pointer, clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(surface, { ...pointer, clientX: 100 + dx, clientY: 100 + dy });
}

describe("TaskCard swipe actions", () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({ width: ROW_WIDTH, height: 80, top: 0, left: 0, right: ROW_WIDTH, bottom: 80, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  it("reveals Complete on a rightward touch swipe and commits it on tap", async () => {
    const task = createMockTask({ title: "Swipe me" });
    const props = renderCard(task);

    drag(surfaceFor("Swipe me"), touch, OPEN_LEADING);

    const complete = screen.getByTestId("swipe-complete");
    expect(complete).toHaveAccessibleName("Complete");
    expect(props.onToggleComplete).not.toHaveBeenCalled();

    await userEvent.click(complete);
    expect(props.onToggleComplete).toHaveBeenCalledWith(task, true);
  });

  it("commits Complete on a full rightward swipe without a tap", () => {
    const task = createMockTask({ title: "Full swipe" });
    const props = renderCard(task);

    drag(surfaceFor("Full swipe"), touch, FULL_SWIPE);

    expect(props.onToggleComplete).toHaveBeenCalledWith(task, true);
    expect(screen.queryByTestId("swipe-complete")).toBeNull();
  });

  it("offers Uncomplete on a completed card", () => {
    renderCard(createMockTask({ title: "Done already", completed: true }));

    drag(surfaceFor("Done already"), touch, OPEN_LEADING);

    expect(screen.getByTestId("swipe-complete")).toHaveAccessibleName("Uncomplete");
  });

  it("reveals Snooze then Delete on a leftward touch swipe", async () => {
    const task = createMockTask({ title: "Trailing" });
    const props = renderCard(task);

    drag(surfaceFor("Trailing"), touch, OPEN_TRAILING);

    const strip = screen.getByTestId("swipe-trailing");
    const buttons = within(strip).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("data-testid"))).toEqual([
      "swipe-snooze",
      "swipe-delete",
    ]);

    await userEvent.click(buttons[0]);
    expect(props.onSnooze).toHaveBeenCalledWith(task.id, SWIPE_CONFIG.SNOOZE_MINUTES);
  });

  it("deletes through the same handler the menu uses", async () => {
    const task = createMockTask({ title: "Delete me" });
    const props = renderCard(task);

    drag(surfaceFor("Delete me"), touch, OPEN_TRAILING);
    await userEvent.click(screen.getByTestId("swipe-delete"));

    expect(props.onDelete).toHaveBeenCalledWith(task);
  });

  it("never commits on a full leftward swipe", () => {
    const task = createMockTask({ title: "No full delete" });
    const props = renderCard(task);

    drag(surfaceFor("No full delete"), touch, -ROW_WIDTH);

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onSnooze).not.toHaveBeenCalled();
    expect(screen.getByTestId("swipe-delete")).toBeInTheDocument();
  });

  it("ignores a mouse drag of the same shape", () => {
    const props = renderCard(createMockTask({ title: "Mouse" }));

    drag(surfaceFor("Mouse"), mouse, FULL_SWIPE);

    expect(screen.queryByTestId("swipe-complete")).toBeNull();
    expect(props.onToggleComplete).not.toHaveBeenCalled();
  });

  it("releases a vertical-dominant drag to the scroller", () => {
    renderCard(createMockTask({ title: "Scrolling" }));
    const surface = surfaceFor("Scrolling");

    fireEvent.pointerDown(surface, { ...touch, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { ...touch, clientX: 104, clientY: 140 });
    fireEvent.pointerMove(surface, { ...touch, clientX: 220, clientY: 150 });
    fireEvent.pointerUp(surface, { ...touch, clientX: 220, clientY: 150 });

    expect(screen.queryByTestId("swipe-complete")).toBeNull();
  });

  it("closes a short swipe back to rest", () => {
    renderCard(createMockTask({ title: "Short" }));

    drag(surfaceFor("Short"), touch, 20);

    expect(screen.queryByTestId("swipe-complete")).toBeNull();
  });

  it("keeps one row open at a time", () => {
    const first = createMockTask({ id: "a", title: "First row" });
    const second = createMockTask({ id: "b", title: "Second row" });
    const props = handlers();
    render(
      <>
        <SwipeableTaskCard task={first} allTasks={[first, second]} {...props} />
        <SwipeableTaskCard task={second} allTasks={[first, second]} {...props} />
      </>
    );

    drag(surfaceFor("First row"), touch, OPEN_TRAILING);
    expect(screen.getAllByTestId("swipe-trailing")).toHaveLength(1);

    drag(surfaceFor("Second row"), touch, OPEN_TRAILING);
    const strips = screen.getAllByTestId("swipe-trailing");
    expect(strips).toHaveLength(1);
    expect(strips[0].closest("[data-testid='task-card-swipe']")).toContainElement(
      screen.getByText("Second row")
    );
  });

  it("closes an open row on tap instead of acting on the card", async () => {
    const props = renderCard(createMockTask({ title: "Tap to close" }));

    drag(surfaceFor("Tap to close"), touch, OPEN_TRAILING);
    await userEvent.click(screen.getByRole("button", { name: "View details for Tap to close" }));

    expect(props.onInspect).not.toHaveBeenCalled();
    expect(screen.queryByTestId("swipe-trailing")).toBeNull();
  });

  it("still opens when the browser refuses pointer capture for the pointer id", () => {
    // Firefox throws NotFoundError for a pointer that is not active, which is what a
    // synthetic event is and what a pointer released mid-gesture can be.
    const original = HTMLElement.prototype.setPointerCapture;
    HTMLElement.prototype.setPointerCapture = () => {
      throw new DOMException("Invalid pointer id", "NotFoundError");
    };
    const pageError = vi.fn();
    window.addEventListener("error", pageError);
    try {
      renderCard(createMockTask({ title: "Capture refused" }));
      drag(surfaceFor("Capture refused"), touch, OPEN_TRAILING);
      expect(screen.getByTestId("swipe-trailing")).toBeInTheDocument();
      expect(pageError).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("error", pageError);
      HTMLElement.prototype.setPointerCapture = original;
    }
  });

  it("renders no swipe surface on the plain card", () => {
    const task = createMockTask({ title: "Archive card" });
    render(<TaskCard task={task} allTasks={[task]} {...handlers()} />);

    expect(screen.queryByTestId("task-card-swipe")).toBeNull();
  });
});
