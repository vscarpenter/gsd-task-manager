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

  it("should_list_matching_candidates_when_typing_and_cap_at_eight", async () => {
    const user = userEvent.setup();
    const tasks = [
      ...Array.from({ length: 12 }, (_, i) => makeTask({ id: `t${i}`, title: `Report ${i}` })),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(<DependenciesField taskId="z" dependencies={[]} allTasks={tasks} onChange={vi.fn()} />);
    await user.type(screen.getByLabelText(/search tasks/i), "report");
    expect(screen.getAllByTestId("dep-suggestion")).toHaveLength(8);
  });

  it("should_add_id_and_clear_query_when_suggestion_clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tasks = [makeTask({ id: "a", title: "Draft report" }), makeTask({ id: "z", title: "Ship it" })];
    render(<DependenciesField taskId="z" dependencies={[]} allTasks={tasks} onChange={onChange} />);
    const input = screen.getByLabelText(/search tasks/i) as HTMLInputElement;
    await user.type(input, "draft");
    await user.click(screen.getByTestId("dep-suggestion"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
    expect(input.value).toBe("");
  });

  it("should_exclude_self_selected_completed_and_circular_candidates", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "self", title: "Self task" }),
      makeTask({ id: "picked", title: "Picked task" }),
      makeTask({ id: "done", title: "Done task", completed: true }),
      makeTask({ id: "cyc", title: "Cycle task", dependencies: ["self"] }),
      makeTask({ id: "ok", title: "Ok task" }),
    ];
    render(
      <DependenciesField taskId="self" dependencies={["picked"]} allTasks={tasks} onChange={vi.fn()} />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "task");
    const suggestions = screen.getAllByTestId("dep-suggestion").map((b) => b.textContent);
    expect(suggestions).toEqual(["Ok task"]);
  });

  it("should_exclude_transitively_circular_candidate", async () => {
    const user = userEvent.setup();
    // Alpha → Beta → Gamma; editing Gamma, adding Alpha would close the loop.
    const tasks = [
      makeTask({ id: "a", title: "Alpha", dependencies: ["b"] }),
      makeTask({ id: "b", title: "Beta", dependencies: ["c"] }),
      makeTask({ id: "c", title: "Gamma" }),
    ];
    render(<DependenciesField taskId="c" dependencies={[]} allTasks={tasks} onChange={vi.fn()} />);
    await user.type(screen.getByLabelText(/search tasks/i), "alpha");
    expect(screen.queryAllByTestId("dep-suggestion")).toHaveLength(0);
    expect(screen.getByText(/no matching tasks/i)).toBeInTheDocument();
  });

  it("should_remove_only_targeted_id_and_preserve_ghost_ids_on_remove", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tasks = [makeTask({ id: "a", title: "Alpha" }), makeTask({ id: "z", title: "Ship it" })];
    render(
      <DependenciesField taskId="z" dependencies={["ghost-1", "a"]} allTasks={tasks} onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: "Remove dependency Alpha" }));
    expect(onChange).toHaveBeenCalledWith(["ghost-1"]);
  });

  it("should_not_submit_enclosing_form_when_enter_pressed_in_search", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DependenciesField
          dependencies={[]}
          allTasks={[makeTask({ id: "a", title: "Alpha" })]}
          onChange={vi.fn()}
        />
      </form>
    );
    await user.type(screen.getByLabelText(/search tasks/i), "alp{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should_allow_adding_candidates_in_create_mode_without_task_id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DependenciesField
        dependencies={[]}
        allTasks={[makeTask({ id: "a", title: "Alpha" })]}
        onChange={onChange}
      />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "alp");
    await user.click(screen.getByTestId("dep-suggestion"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("should_disable_search_input_with_caption_at_max_dependencies", () => {
    const deps = Array.from({ length: 50 }, (_, i) => `d${i}`);
    render(<DependenciesField taskId="z" dependencies={deps} allTasks={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/search tasks/i)).toBeDisabled();
    expect(screen.getByText(/dependency limit/i)).toBeInTheDocument();
  });

  it("should_show_no_matching_tasks_message_when_query_has_no_candidates", async () => {
    const user = userEvent.setup();
    render(
      <DependenciesField
        taskId="z"
        dependencies={[]}
        allTasks={[makeTask({ id: "z", title: "Ship it" })]}
        onChange={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "anything");
    expect(screen.getByText(/no matching tasks/i)).toBeInTheDocument();
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
