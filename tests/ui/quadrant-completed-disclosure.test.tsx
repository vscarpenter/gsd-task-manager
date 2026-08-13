import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuadrantPane } from "@/components/matrix-simplified/quadrant-pane";
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
    />
  );
}

const active = createMockTask({ id: "a", title: "Still to do", urgent: true, important: true });
const done1 = createMockTask({ id: "d1", title: "Finished one", urgent: true, important: true, completed: true });
const done2 = createMockTask({ id: "d2", title: "Finished two", urgent: true, important: true, completed: true });

describe("QuadrantPane completed disclosure", () => {
  it("keeps completed tasks collapsed so they cannot bury the active ones", () => {
    renderPane([active, done1, done2]);

    // Show-completed used to inject every completed card inline, growing the
    // board to ~8,000px and pushing active work off screen.
    expect(screen.getByText("Still to do")).toBeInTheDocument();
    expect(screen.queryByText("Finished one")).not.toBeInTheDocument();
  });

  it("says how many are hidden", () => {
    renderPane([active, done1, done2]);
    expect(screen.getByRole("button", { name: /2 done/i })).toBeInTheDocument();
  });

  it("reveals them on request", async () => {
    const user = userEvent.setup();
    renderPane([active, done1, done2]);

    await user.click(screen.getByRole("button", { name: /2 done/i }));

    // Nothing is hidden permanently — Show-completed asked for these.
    expect(screen.getByText("Finished one")).toBeInTheDocument();
    expect(screen.getByText("Finished two")).toBeInTheDocument();
  });

  it("shows no disclosure when nothing is completed", () => {
    renderPane([active]);
    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();
  });

  it("does not treat a quadrant of only completed tasks as empty", () => {
    renderPane([done1, done2]);

    // "Nothing on fire." would be a claim about the user's workload; the truth
    // is that everything here is finished.
    expect(screen.queryByTestId("quadrant-empty-mark")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 done/i })).toBeInTheDocument();
  });
});
