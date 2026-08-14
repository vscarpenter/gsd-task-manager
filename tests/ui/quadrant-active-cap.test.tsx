import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  QuadrantPane,
  ACTIVE_RENDER_CAP,
} from "@/components/matrix-simplified/quadrant-pane";
import { quadrantForTask } from "@/lib/quadrants";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

function renderPane(tasks: TaskRecord[]) {
  return render(
    <QuadrantPane
      meta={quadrantForTask(true, true)}
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

function makeActive(count: number): TaskRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      id: `t${i}`,
      title: `Active task ${i}`,
      urgent: true,
      important: true,
    }),
  );
}

describe("QuadrantPane active-task cap", () => {
  it("renders every card when the quadrant is under the cap", () => {
    renderPane(makeActive(5));

    expect(screen.getByText("Active task 0")).toBeInTheDocument();
    expect(screen.getByText("Active task 4")).toBeInTheDocument();
    expect(screen.queryByTestId("quadrant-more-active")).not.toBeInTheDocument();
  });

  it("renders exactly the cap and defers the rest", () => {
    renderPane(makeActive(ACTIVE_RENDER_CAP + 12));

    // The matrix is the only long-list surface that is not virtualized: every
    // active card in all four panes is real DOM inside a SortableContext.
    // Capping the render keeps a large backlog from turning the board into
    // thousands of nodes.
    expect(screen.getByText("Active task 0")).toBeInTheDocument();
    expect(
      screen.getByText(`Active task ${ACTIVE_RENDER_CAP - 1}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`Active task ${ACTIVE_RENDER_CAP}`),
    ).not.toBeInTheDocument();
  });

  it("says how many are deferred rather than hiding them silently", () => {
    renderPane(makeActive(ACTIVE_RENDER_CAP + 12));

    const more = screen.getByTestId("quadrant-more-active");
    expect(more).toHaveTextContent("12 more");
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals the rest on request", async () => {
    const user = userEvent.setup();
    renderPane(makeActive(ACTIVE_RENDER_CAP + 12));

    await user.click(screen.getByTestId("quadrant-more-active"));

    // Nothing is hidden permanently — the cap is a render budget, not a filter.
    expect(
      screen.getByText(`Active task ${ACTIVE_RENDER_CAP + 11}`),
    ).toBeInTheDocument();
    expect(screen.getByTestId("quadrant-more-active")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps the header count honest about the full total", () => {
    renderPane(makeActive(ACTIVE_RENDER_CAP + 12));

    // The count is what tells the user the quadrant is overloaded. Reporting
    // the rendered subset would hide exactly the problem worth acting on.
    const header = screen.getByTestId("quadrant-header");
    expect(header).toHaveTextContent(String(ACTIVE_RENDER_CAP + 12));
  });
});
