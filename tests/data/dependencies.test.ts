import { describe, expect, it } from "vitest";
import {
  wouldCreateCircularDependency,
  getBlockingTasks,
  getBlockedTasks,
  getUncompletedBlockingTasks,
  isTaskBlocked,
  isTaskBlocking,
  getReadyTasks,
  validateDependencies,
} from "@/lib/dependencies";
import { createMockTask } from "@/tests/fixtures";

/**
 * Helper to create a task with specific id, dependencies, and completion status.
 * Uses createMockTask from fixtures for consistency.
 */
function taskWith(
  id: string,
  dependencies: string[] = [],
  completed = false
) {
  return createMockTask({
    id,
    title: `Task ${id}`,
    dependencies,
    completed,
    completedAt: completed ? new Date().toISOString() : undefined,
  });
}

describe("Dependencies utility", () => {
  describe("wouldCreateCircularDependency", () => {
    it("should_detect_self_reference", () => {
      const tasks = [taskWith("A")];
      expect(wouldCreateCircularDependency("A", "A", tasks)).toBe(true);
    });

    it("should_detect_direct_cycle_A_depends_on_B_and_B_depends_on_A", () => {
      const tasks = [taskWith("A", ["B"]), taskWith("B")];
      expect(wouldCreateCircularDependency("B", "A", tasks)).toBe(true);
    });

    it("should_detect_transitive_cycle_A_to_B_to_C_to_A", () => {
      const tasks = [
        taskWith("A", ["B"]),
        taskWith("B", ["C"]),
        taskWith("C"),
      ];
      expect(wouldCreateCircularDependency("C", "A", tasks)).toBe(true);
    });

    it("should_allow_linear_chain_without_cycle", () => {
      const tasks = [
        taskWith("A", ["B"]),
        taskWith("B", ["C"]),
        taskWith("C"),
      ];
      // Adding A -> C is fine (already transitive)
      expect(wouldCreateCircularDependency("A", "C", tasks)).toBe(false);
    });

    it("should_allow_independent_branches", () => {
      const tasks = [
        taskWith("A", ["B"]),
        taskWith("B"),
        taskWith("C", ["D"]),
        taskWith("D"),
      ];
      expect(wouldCreateCircularDependency("C", "A", tasks)).toBe(false);
    });

    it("should_handle_missing_tasks_gracefully", () => {
      // dependencyId references a task not in the array
      const tasks = [taskWith("A")];
      expect(
        wouldCreateCircularDependency("A", "nonexistent", tasks)
      ).toBe(false);
    });

    it("should_handle_tasks_with_missing_dependency_references", () => {
      // Task B references a dependency "ghost" that doesn't exist in allTasks
      const tasks = [taskWith("A"), taskWith("B", ["ghost"])];
      expect(wouldCreateCircularDependency("A", "B", tasks)).toBe(false);
    });

    it("should_detect_cycle_in_diamond_shaped_graph", () => {
      const tasks = [
        taskWith("A", ["B", "C"]),
        taskWith("B", ["D"]),
        taskWith("C", ["D"]),
        taskWith("D"),
      ];
      // D -> A would create D -> A -> B -> D and D -> A -> C -> D
      expect(wouldCreateCircularDependency("D", "A", tasks)).toBe(true);
    });
  });

  describe("getBlockingTasks", () => {
    it("should_return_tasks_that_must_be_completed_first", () => {
      const taskA = taskWith("A", ["B", "C"]);
      const taskB = taskWith("B");
      const taskC = taskWith("C");
      const tasks = [taskA, taskB, taskC];

      const blocking = getBlockingTasks(taskA, tasks);
      expect(blocking).toHaveLength(2);
      expect(blocking.map((t) => t.id).sort()).toEqual(["B", "C"]);
    });

    it("should_return_empty_array_when_no_dependencies", () => {
      const taskA = taskWith("A");
      expect(getBlockingTasks(taskA, [taskA])).toHaveLength(0);
    });

    it("should_filter_out_missing_dependency_tasks", () => {
      const taskA = taskWith("A", ["B", "missing"]);
      const taskB = taskWith("B");
      const tasks = [taskA, taskB];

      const blocking = getBlockingTasks(taskA, tasks);
      expect(blocking).toHaveLength(1);
      expect(blocking[0].id).toBe("B");
    });
  });

  describe("getBlockedTasks", () => {
    it("should_return_tasks_that_depend_on_given_task", () => {
      const taskA = taskWith("A");
      const taskB = taskWith("B", ["A"]);
      const taskC = taskWith("C", ["A"]);
      const taskD = taskWith("D", ["B"]); // Not directly blocked by A
      const tasks = [taskA, taskB, taskC, taskD];

      const blocked = getBlockedTasks("A", tasks);
      expect(blocked).toHaveLength(2);
      expect(blocked.map((t) => t.id).sort()).toEqual(["B", "C"]);
    });

    it("should_return_empty_array_when_no_tasks_depend_on_it", () => {
      const taskA = taskWith("A");
      expect(getBlockedTasks("A", [taskA])).toHaveLength(0);
    });
  });

  describe("getUncompletedBlockingTasks", () => {
    it("should_filter_out_completed_blockers", () => {
      const taskA = taskWith("A", ["B", "C"]);
      const taskB = taskWith("B", [], true); // completed
      const taskC = taskWith("C", [], false); // not completed
      const tasks = [taskA, taskB, taskC];

      const uncompleted = getUncompletedBlockingTasks(taskA, tasks);
      expect(uncompleted).toHaveLength(1);
      expect(uncompleted[0].id).toBe("C");
    });

    it("should_return_empty_when_all_blockers_completed", () => {
      const taskA = taskWith("A", ["B"]);
      const taskB = taskWith("B", [], true);
      const tasks = [taskA, taskB];

      expect(getUncompletedBlockingTasks(taskA, tasks)).toHaveLength(0);
    });

    it("should_return_empty_when_task_has_no_dependencies", () => {
      const taskA = taskWith("A");
      expect(getUncompletedBlockingTasks(taskA, [taskA])).toHaveLength(0);
    });
  });

  describe("isTaskBlocked", () => {
    it("should_return_true_when_uncompleted_dependencies_exist", () => {
      const taskA = taskWith("A", ["B"]);
      const taskB = taskWith("B", [], false);
      expect(isTaskBlocked(taskA, [taskA, taskB])).toBe(true);
    });

    it("should_return_false_when_all_dependencies_completed", () => {
      const taskA = taskWith("A", ["B"]);
      const taskB = taskWith("B", [], true);
      expect(isTaskBlocked(taskA, [taskA, taskB])).toBe(false);
    });

    it("should_return_false_when_no_dependencies", () => {
      const taskA = taskWith("A");
      expect(isTaskBlocked(taskA, [taskA])).toBe(false);
    });
  });

  describe("isTaskBlocking", () => {
    it("should_return_true_when_other_tasks_depend_on_it", () => {
      const taskA = taskWith("A");
      const taskB = taskWith("B", ["A"]);
      expect(isTaskBlocking("A", [taskA, taskB])).toBe(true);
    });

    it("should_return_false_when_no_tasks_depend_on_it", () => {
      const taskA = taskWith("A");
      expect(isTaskBlocking("A", [taskA])).toBe(false);
    });
  });

  describe("getReadyTasks", () => {
    it("should_return_tasks_with_no_uncompleted_dependencies", () => {
      const taskA = taskWith("A"); // ready
      const taskB = taskWith("B", ["A"], false); // blocked by A
      const taskC = taskWith("C", [], true); // completed
      const taskD = taskWith("D", ["C"]); // ready (C is completed)
      const tasks = [taskA, taskB, taskC, taskD];

      const ready = getReadyTasks(tasks, tasks);
      expect(ready).toHaveLength(2);
      expect(ready.map((t) => t.id).sort()).toEqual(["A", "D"]);
    });

    it("should_exclude_completed_tasks", () => {
      const taskA = taskWith("A", [], true);
      expect(getReadyTasks([taskA], [taskA])).toHaveLength(0);
    });

    it("should_return_all_when_no_dependencies_exist", () => {
      const taskA = taskWith("A");
      const taskB = taskWith("B");
      const tasks = [taskA, taskB];

      const ready = getReadyTasks(tasks, tasks);
      expect(ready).toHaveLength(2);
    });
  });

  describe("validateDependencies", () => {
    it("should_reject_self_reference", () => {
      const tasks = [taskWith("A")];
      const result = validateDependencies("A", ["A"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot depend on itself");
    });

    it("should_reject_missing_tasks", () => {
      const tasks = [taskWith("A")];
      const result = validateDependencies("A", ["missing"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.error).toContain("missing");
    });

    it("should_reject_circular_dependencies", () => {
      const tasks = [taskWith("A", ["B"]), taskWith("B")];
      const result = validateDependencies("B", ["A"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Circular dependency");
    });

    it("should_accept_valid_dependencies", () => {
      const tasks = [taskWith("A"), taskWith("B"), taskWith("C")];
      const result = validateDependencies("A", ["B", "C"], tasks);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should_accept_empty_dependencies", () => {
      const tasks = [taskWith("A")];
      const result = validateDependencies("A", [], tasks);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should_report_multiple_missing_tasks", () => {
      const tasks = [taskWith("A")];
      const result = validateDependencies("A", ["x", "y"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("x");
      expect(result.error).toContain("y");
    });
  });
});
