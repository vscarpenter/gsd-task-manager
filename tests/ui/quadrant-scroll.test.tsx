import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { MatrixGrid } from "@/components/matrix-simplified/matrix-grid";
import { QuadrantPane } from "@/components/matrix-simplified/quadrant-pane";
import { quadrantForTask } from "@/lib/quadrants";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";


function makeActive(count: number): TaskRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({ id: `t${i}`, title: `Task ${i}`, urgent: false, important: false }),
  );
}

function renderPane(tasks: TaskRecord[]) {
  return render(
    <QuadrantPane
      meta={quadrantForTask(false, false)}
      tasks={tasks}
      allTasks={tasks}
      onEdit={vi.fn()}
      onToggleComplete={vi.fn()}
      onDelete={vi.fn()}
      onShare={vi.fn()}
      onAddInQuadrant={vi.fn()}
    />,
  );
}

/**
 * The 2x2 grid used to let its tallest pane set the row height, so an
 * overloaded Eliminate pushed the other three quadrants' content off screen.
 * Now the grid is bounded by the viewport and each pane scrolls its own list,
 * so all four headers and counts stay on screen at once.
 *
 * jsdom has no layout and evaluates no container queries, so these assert the
 * class contract rather than rendered geometry.
 */
describe("QuadrantPane — scrolls its own list", () => {
  it("keeps the header pinned and makes the list the scroll container", () => {
    renderPane(makeActive(12));

    const header = screen.getByTestId("quadrant-header");
    expect(header.className).toContain("shrink-0");

    const list = screen.getByTestId("quadrant-list");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("min-h-0");
    expect(list.className).toContain("flex-1");
  });

  it("keeps an explicit floor so the pane sizes to its cell, not its content", () => {
    renderPane(makeActive(12));

    // An explicit min-height disables the grid item's automatic minimum size
    // (the min-content floor), which is what let a long list stretch its row.
    const pane = screen.getByTestId("quadrant-q4");
    expect(pane.className).toMatch(/\bmin-h-\[280px\]/);
    expect(pane.className).toContain("overflow-hidden");
  });
});

describe("MatrixGrid — viewport-bound rows", () => {
  it("sizes both rows as equal shares of the available height at 2x2 widths", () => {
    render(
      <MatrixGrid
        tasks={[]}
        allTasks={[]}
        onEdit={vi.fn()}
        onToggleComplete={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onAddInQuadrant={vi.fn()}
      />,
    );

    const grid = screen.getByTestId("matrix-grid");
    // minmax(0,1fr) rather than plain 1fr: 1fr has an implicit min-content
    // floor, which is exactly the "tallest pane wins" behavior being removed.
    expect(grid.className).toContain("@min-[696px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(grid.className).toContain("min-h-0");

    const frame = screen.getByTestId("matrix-axis-frame");
    expect(frame.className).toContain("@min-[696px]:grid-rows-[auto_minmax(0,1fr)]");
    expect(frame.className).toContain("min-h-0");
  });
});

describe("QuadrantPane — overflow fade tracks the content, not the container", () => {
  it("observes the list content so the fade re-samples when cards change height", () => {
    // At 2x2 widths the list container has a fixed size, so observing it
    // never fires when its content grows or shrinks ("N more", a task moving
    // into the done disclosure). The hook has to watch the content instead.
    const observed: Element[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(el: Element) { observed.push(el); }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      renderPane(makeActive(3));
      const list = screen.getByTestId("quadrant-list");
      const content = screen.getByTestId("quadrant-list-content");
      expect(content.parentElement).toBe(list);
      expect(observed).toContain(content);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});

describe("MatrixGridSkeleton — fills the stage like the real grid", () => {
  it("takes the stage's remaining height so panes do not jump when data lands", async () => {
    const { MatrixGridSkeleton } = await import("@/components/matrix-simplified/matrix-grid-skeleton");
    render(<MatrixGridSkeleton />);
    const skeleton = screen.getByTestId("matrix-grid-skeleton");
    expect(skeleton.className).toContain("flex-1");
    expect(skeleton.className).toContain("min-h-0");
  });
});
