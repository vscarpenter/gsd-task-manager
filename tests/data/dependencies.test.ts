import { describe, expect, it } from "vitest";
import {
  wouldCreateCircularDependency,
  getBlockingTasks,
  getBlockedTasks,
  getUncompletedBlockingTasks,
  isTaskBlocked,
  isTaskBlocking,
  getReadyTasks,
  validateDependencies
} from "@/lib/dependencies";
import type { TaskRecord } from "@/lib/types";

describe("Dependencies utility", () => {
  const createTask = (id: string, dependencies: string[] = [], completed = false): TaskRecord => ({
    id,
    title: `Task ${id}`,
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed,
    dueDate: undefined,
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notificationEnabled: true,
    notificationSent: false
  });

  describe("wouldCreateCircularDependency", () => {
    it("should detect self-reference", () => {
      const tasks = [createTask("A")];
      expect(wouldCreateCircularDependency("A", "A", tasks)).toBe(true);
    });

    it("should detect direct circular dependency (A→B, B→A)", () => {
      const tasks = [
        createTask("A", ["B"]),
        createTask("B")
      ];
      expect(wouldCreateCircularDependency("B", "A", tasks)).toBe(true);
    });

    it("should detect indirect circular dependency (A→B→C, C→A)", () => {
      const tasks = [
        createTask("A", ["B"]),
        createTask("B", ["C"]),
        createTask("C")
      ];
      expect(wouldCreateCircularDependency("C", "A", tasks)).toBe(true);
    });

    it("should allow linear dependencies (A→B→C)", () => {
      const tasks = [
        createTask("A", ["B"]),
        createTask("B", ["C"]),
        createTask("C")
      ];
      expect(wouldCreateCircularDependency("A", "C", tasks)).toBe(false);
    });

    it("should allow independent branches", () => {
      const tasks = [
        createTask("A", ["B"]),
        createTask("B"),
        createTask("C", ["D"]),
        createTask("D")
      ];
      expect(wouldCreateCircularDependency("C", "A", tasks)).toBe(false);
    });

    it("should handle complex dependency graph", () => {
      const tasks = [
        createTask("A", ["B", "C"]),
        createTask("B", ["D"]),
        createTask("C", ["D"]),
        createTask("D")
      ];
      // D can't depend on A because A→B→D and A→C→D paths exist
      expect(wouldCreateCircularDependency("D", "A", tasks)).toBe(true);
    });
  });

  describe("getBlockingTasks", () => {
    it("should return tasks that must be completed first", () => {
      const taskA = createTask("A", ["B", "C"]);
      const taskB = createTask("B");
      const taskC = createTask("C");
      const tasks = [taskA, taskB, taskC];

      const blocking = getBlockingTasks(taskA, tasks);
      expect(blocking).toHaveLength(2);
      expect(blocking.map(t => t.id).sort()).toEqual(["B", "C"]);
    });

    it("should return empty array for task with no dependencies", () => {
      const taskA = createTask("A");
      const tasks = [taskA];

      const blocking = getBlockingTasks(taskA, tasks);
      expect(blocking).toHaveLength(0);
    });

    it("should handle missing dependency tasks gracefully", () => {
      const taskA = createTask("A", ["B", "missing"]);
      const taskB = createTask("B");
      const tasks = [taskA, taskB];

      const blocking = getBlockingTasks(taskA, tasks);
      expect(blocking).toHaveLength(1);
      expect(blocking[0].id).toBe("B");
    });
  });

  describe("getBlockedTasks", () => {
    it("should return tasks waiting on this one", () => {
      const taskA = createTask("A");
      const taskB = createTask("B", ["A"]);
      const taskC = createTask("C", ["A"]);
      const taskD = createTask("D", ["B"]); // Not blocked by A directly
      const tasks = [taskA, taskB, taskC, taskD];

      const blocked = getBlockedTasks("A", tasks);
      expect(blocked).toHaveLength(2);
      expect(blocked.map(t => t.id).sort()).toEqual(["B", "C"]);
    });

    it("should return empty array if no tasks depend on this one", () => {
      const taskA = createTask("A");
      const tasks = [taskA];

      const blocked = getBlockedTasks("A", tasks);
      expect(blocked).toHaveLength(0);
    });
  });

  describe("getUncompletedBlockingTasks", () => {
    it("should filter out completed blocking tasks", () => {
      const taskA = createTask("A", ["B", "C"]);
      const taskB = createTask("B", [], true); // Completed
      const taskC = createTask("C", [], false); // Not completed
      const tasks = [taskA, taskB, taskC];

      const uncompleted = getUncompletedBlockingTasks(taskA, tasks);
      expect(uncompleted).toHaveLength(1);
      expect(uncompleted[0].id).toBe("C");
    });

    it("should return empty array if all blockers are completed", () => {
      const taskA = createTask("A", ["B"]);
      const taskB = createTask("B", [], true);
      const tasks = [taskA, taskB];

      const uncompleted = getUncompletedBlockingTasks(taskA, tasks);
      expect(uncompleted).toHaveLength(0);
    });
  });

  describe("isTaskBlocked", () => {
    it("should return true if task has uncompleted dependencies", () => {
      const taskA = createTask("A", ["B"]);
      const taskB = createTask("B", [], false);
      const tasks = [taskA, taskB];

      expect(isTaskBlocked(taskA, tasks)).toBe(true);
    });

    it("should return false if all dependencies are completed", () => {
      const taskA = createTask("A", ["B"]);
      const taskB = createTask("B", [], true);
      const tasks = [taskA, taskB];

      expect(isTaskBlocked(taskA, tasks)).toBe(false);
    });

    it("should return false if task has no dependencies", () => {
      const taskA = createTask("A");
      const tasks = [taskA];

      expect(isTaskBlocked(taskA, tasks)).toBe(false);
    });
  });

  describe("isTaskBlocking", () => {
    it("should return true if other tasks depend on it", () => {
      const taskA = createTask("A");
      const taskB = createTask("B", ["A"]);
      const tasks = [taskA, taskB];

      expect(isTaskBlocking("A", tasks)).toBe(true);
    });

    it("should return false if no tasks depend on it", () => {
      const taskA = createTask("A");
      const tasks = [taskA];

      expect(isTaskBlocking("A", tasks)).toBe(false);
    });
  });

  describe("getReadyTasks", () => {
    it("should return only tasks with no uncompleted dependencies", () => {
      const taskA = createTask("A"); // Ready
      const taskB = createTask("B", ["A"], false); // Blocked by A
      const taskC = createTask("C", [], true); // Completed
      const taskD = createTask("D", ["C"]); // Ready (C is completed)
      const tasks = [taskA, taskB, taskC, taskD];

      const ready = getReadyTasks(tasks, tasks);
      expect(ready).toHaveLength(2);
      expect(ready.map(t => t.id).sort()).toEqual(["A", "D"]);
    });

    it("should exclude completed tasks", () => {
      const taskA = createTask("A", [], true);
      const tasks = [taskA];

      const ready = getReadyTasks(tasks, tasks);
      expect(ready).toHaveLength(0);
    });
  });

  describe("validateDependencies", () => {
    it("should reject self-reference", () => {
      const tasks = [createTask("A")];
      const result = validateDependencies("A", ["A"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot depend on itself");
    });

    it("should reject missing tasks", () => {
      const tasks = [createTask("A")];
      const result = validateDependencies("A", ["missing"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should reject circular dependencies", () => {
      const tasks = [
        createTask("A", ["B"]),
        createTask("B")
      ];
      const result = validateDependencies("B", ["A"], tasks);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Circular dependency");
    });

    it("should accept valid dependencies", () => {
      const tasks = [
        createTask("A"),
        createTask("B"),
        createTask("C")
      ];
      const result = validateDependencies("A", ["B", "C"], tasks);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept empty dependencies array", () => {
      const tasks = [createTask("A")];
      const result = validateDependencies("A", [], tasks);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
