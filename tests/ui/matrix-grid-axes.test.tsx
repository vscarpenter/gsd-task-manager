import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatrixGrid } from "@/components/matrix-simplified/matrix-grid";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: vi.fn(),
}));

function renderGrid() {
  return render(
    <MatrixGrid
      tasks={[]}
      allTasks={[]}
      onEdit={vi.fn()}
      onToggleComplete={vi.fn()}
      onDelete={vi.fn()}
      onShare={vi.fn()}
      onAddInQuadrant={vi.fn()}
    />
  );
}

/**
 * The two axes are the whole argument of an Eisenhower matrix, and until now a
 * reader had to infer them from four quadrant hints. jsdom has no layout and
 * evaluates no container queries, so these assert the class contract that
 * hides the frame in the single-column stack rather than the rendered geometry.
 */
describe("MatrixGrid — axis labels", () => {
  it("names both ends of the urgency and importance axes", () => {
    renderGrid();

    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("Not urgent")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByText("Not important")).toBeInTheDocument();
  });

  it("speaks in the kicker voice and stays out of the accessibility tree", () => {
    renderGrid();
    const columns = screen.getByTestId("matrix-axis-columns");
    const rows = screen.getByTestId("matrix-axis-rows");

    expect(columns).toHaveAttribute("aria-hidden", "true");
    expect(rows).toHaveAttribute("aria-hidden", "true");
    // The panes already carry `aria-label="… quadrant"`; repeating the axes
    // would make a screen reader announce urgency twice per pane.
    expect(screen.getByText("Urgent").className).toContain("kicker");
  });

  it("hides the label frame below the container width that produces two columns", () => {
    renderGrid();

    for (const testId of ["matrix-axis-columns", "matrix-axis-rows", "matrix-axis-corner"]) {
      const node = screen.getByTestId(testId);
      expect(node.className).toContain("hidden");
      expect(node.className).toContain("@min-[696px]:");
    }
  });

  it("keeps the labels inside the grid's own container scope, not the viewport", () => {
    const { container } = renderGrid();
    const scope = container.querySelector(".\\@container");
    const frame = screen.getByTestId("matrix-axis-frame");

    expect(scope).toContainElement(frame);
    expect(frame).toContainElement(screen.getByTestId("matrix-grid"));
    expect(frame.className).toContain("@min-[696px]:grid-cols-[22px_minmax(0,1fr)]");
  });
});
