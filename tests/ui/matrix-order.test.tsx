import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatrixGrid } from "@/components/matrix-simplified/matrix-grid";
import { createMockTask } from "@/tests/fixtures";

describe("MatrixGrid order", () => {
  it("puts the earlier due instant first, whatever offset it was written in", () => {
    const pane = { urgent: true, important: true, quadrant: "urgent-important" } as const;
    const tasks = [
      createMockTask({ id: "later", title: "Due later", ...pane, dueDate: "2026-10-19T20:00:00.000-05:00" }),
      createMockTask({ id: "earlier", title: "Due earlier", ...pane, dueDate: "2026-10-19T22:00:00.000Z" }),
    ];

    render(
      <MatrixGrid
        tasks={tasks}
        allTasks={tasks}
        onEdit={vi.fn()}
        onToggleComplete={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onAddInQuadrant={vi.fn()}
      />,
    );

    const earlier = screen.getAllByText("Due earlier")[0];
    const later = screen.getAllByText("Due later")[0];
    expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
