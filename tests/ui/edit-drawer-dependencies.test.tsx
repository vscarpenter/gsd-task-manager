import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DependenciesField,
  findDependencyCycleError,
} from "@/components/matrix-simplified/edit-drawer-dependencies";
import type { TaskRecord } from "@/lib/types";

function makeTask(overrides: Partial<TaskRecord> & { id: string }): TaskRecord {
  return {
    title: overrides.id,
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed: false,
    tags: [],
    subtasks: [],
    dependencies: [],
    recurrence: "none",
    notificationEnabled: false,
    notificationSent: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as TaskRecord;
}

describe("<DependenciesField>", () => {
  it("should_render_chip_with_task_title_for_each_resolvable_dependency", () => {
    const tasks = [
      makeTask({ id: "a", title: "Write spec" }),
      makeTask({ id: "b", title: "Review spec" }),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(
      <DependenciesField taskId="z" dependencies={["a", "b"]} allTasks={tasks} onChange={vi.fn()} />
    );
    expect(screen.getAllByTestId("dep-chip")).toHaveLength(2);
    expect(screen.getByText("Write spec")).toBeInTheDocument();
    expect(screen.getByText("Review spec")).toBeInTheDocument();
  });

  it("should_not_render_chip_for_ghost_dependency_id", () => {
    render(
      <DependenciesField
        taskId="z"
        dependencies={["ghost-1"]}
        allTasks={[makeTask({ id: "z", title: "Ship it" })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByTestId("dep-chip")).toHaveLength(0);
    expect(screen.getByLabelText(/search tasks/i)).toBeInTheDocument();
  });

  it("should_render_chip_for_completed_dependency_so_it_can_be_removed", () => {
    const tasks = [
      makeTask({ id: "a", title: "Done thing", completed: true }),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(<DependenciesField taskId="z" dependencies={["a"]} allTasks={tasks} onChange={vi.fn()} />);
    expect(screen.getByText("Done thing")).toBeInTheDocument();
  });
});

describe("findDependencyCycleError", () => {
  it("should_return_message_naming_the_blocking_task_when_cycle_found", () => {
    // "Alpha" depends on "Beta"; making Beta depend on Alpha closes the loop.
    const tasks = [
      makeTask({ id: "a", title: "Alpha", dependencies: ["b"] }),
      makeTask({ id: "b", title: "Beta" }),
    ];
    expect(findDependencyCycleError("b", ["a"], tasks)).toMatch(/Alpha/);
  });

  it("should_return_null_for_ghost_ids_and_acyclic_dependencies", () => {
    const tasks = [makeTask({ id: "a", title: "Alpha" }), makeTask({ id: "b", title: "Beta" })];
    expect(findDependencyCycleError("b", ["a", "ghost-1"], tasks)).toBeNull();
  });
});
