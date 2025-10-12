import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  listTasks,
  createTask,
  updateTask,
  toggleCompleted,
  deleteTask,
  moveTaskToQuadrant,
  clearTasks,
  toggleSubtask,
  addSubtask,
  deleteSubtask
} from "@/lib/tasks";
import { getDb } from "@/lib/db";
import type { TaskDraft } from "@/lib/types";

describe("Task CRUD operations", () => {
  beforeEach(async () => {
    await getDb();
    await clearTasks();
  });

  afterEach(async () => {
    await clearTasks();
  });

  const createSampleTask = (overrides?: Partial<TaskDraft>): TaskDraft => ({
    title: "Test task",
    description: "Test description",
    urgent: true,
    important: true,
    recurrence: "none",
    tags: [],
    subtasks: [],
      dependencies: [],
    ...overrides
  });

  describe("listTasks", () => {
    it("should return empty array when no tasks exist", async () => {
      const tasks = await listTasks();
      expect(tasks).toEqual([]);
    });

    it("should return all tasks ordered by createdAt descending", async () => {
      await createTask(createSampleTask({ title: "Task 1" }));
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      await createTask(createSampleTask({ title: "Task 2" }));
      await new Promise(resolve => setTimeout(resolve, 10));
      await createTask(createSampleTask({ title: "Task 3" }));

      const tasks = await listTasks();
      expect(tasks).toHaveLength(3);
      // Should be newest first
      expect(tasks[0].title).toBe("Task 3");
      expect(tasks[1].title).toBe("Task 2");
      expect(tasks[2].title).toBe("Task 1");
    });
  });

  describe("createTask", () => {
    it("should create a task with all required fields", async () => {
      const draft: TaskDraft = createSampleTask({
        title: "New task",
        description: "Task description",
        urgent: false,
        important: true
      });

      const created = await createTask(draft);

      expect(created.id).toBeDefined();
      expect(created.id).toHaveLength(12);
      expect(created.title).toBe("New task");
      expect(created.description).toBe("Task description");
      expect(created.urgent).toBe(false);
      expect(created.important).toBe(true);
      expect(created.quadrant).toBe("not-urgent-important");
      expect(created.completed).toBe(false);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
      expect(created.recurrence).toBe("none");
      expect(created.tags).toEqual([]);
      expect(created.subtasks).toEqual([]);
    });

    it("should create task with tags and subtasks", async () => {
      const draft: TaskDraft = createSampleTask({
        tags: ["work", "urgent"],
        subtasks: [
          { id: "sub1", title: "Subtask 1", completed: false },
          { id: "sub2", title: "Subtask 2", completed: true }
        ]
      });

      const created = await createTask(draft);

      expect(created.tags).toEqual(["work", "urgent"]);
      expect(created.subtasks).toHaveLength(2);
      expect(created.subtasks[0].title).toBe("Subtask 1");
      expect(created.subtasks[1].completed).toBe(true);
    });

    it("should create task with due date and recurrence", async () => {
      const dueDate = new Date("2025-12-31").toISOString();
      const draft: TaskDraft = createSampleTask({
        dueDate,
        recurrence: "weekly"
      });

      const created = await createTask(draft);

      expect(created.dueDate).toBe(dueDate);
      expect(created.recurrence).toBe("weekly");
    });

    it("should assign correct quadrant based on urgent and important flags", async () => {
      const testCases = [
        { urgent: true, important: true, expected: "urgent-important" },
        { urgent: false, important: true, expected: "not-urgent-important" },
        { urgent: true, important: false, expected: "urgent-not-important" },
        { urgent: false, important: false, expected: "not-urgent-not-important" }
      ];

      for (const testCase of testCases) {
        const draft = createSampleTask({
          title: `${testCase.urgent}-${testCase.important}`,
          urgent: testCase.urgent,
          important: testCase.important
        });
        const created = await createTask(draft);
        expect(created.quadrant).toBe(testCase.expected);
      }
    });
  });

  describe("updateTask", () => {
    it("should update task fields", async () => {
      const task = await createTask(createSampleTask({ title: "Original" }));

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateTask(task.id, {
        title: "Updated",
        description: "New description"
      });

      expect(updated.id).toBe(task.id);
      expect(updated.title).toBe("Updated");
      expect(updated.description).toBe("New description");
      expect(updated.updatedAt).not.toBe(task.updatedAt);
    });

    it("should update quadrant when urgent/important flags change", async () => {
      const task = await createTask(createSampleTask({ urgent: true, important: true }));
      expect(task.quadrant).toBe("urgent-important");

      const updated = await updateTask(task.id, {
        urgent: false,
        important: true
      });

      expect(updated.quadrant).toBe("not-urgent-important");
    });

    it("should throw error for non-existent task", async () => {
      await expect(updateTask("nonexistent", { title: "Updated" })).rejects.toThrow("Task nonexistent not found");
    });

    it("should update tags and subtasks", async () => {
      const task = await createTask(createSampleTask());

      const updated = await updateTask(task.id, {
        tags: ["new-tag"],
        subtasks: [{ id: "newsub", title: "New subtask", completed: false }]
      });

      expect(updated.tags).toEqual(["new-tag"]);
      expect(updated.subtasks).toHaveLength(1);
      expect(updated.subtasks[0].title).toBe("New subtask");
    });
  });

  describe("toggleCompleted", () => {
    it("should mark task as completed", async () => {
      const task = await createTask(createSampleTask());
      expect(task.completed).toBe(false);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await toggleCompleted(task.id, true);

      expect(updated.completed).toBe(true);
      expect(updated.updatedAt).not.toBe(task.updatedAt);
    });

    it("should mark task as incomplete", async () => {
      const task = await createTask(createSampleTask());
      await toggleCompleted(task.id, true);

      const updated = await toggleCompleted(task.id, false);

      expect(updated.completed).toBe(false);
    });

    it("should create new instance for recurring task when completed", async () => {
      const dueDate = new Date("2025-01-01").toISOString();
      const task = await createTask(createSampleTask({
        title: "Recurring task",
        recurrence: "daily",
        dueDate
      }));

      await toggleCompleted(task.id, true);

      const allTasks = await listTasks();
      expect(allTasks).toHaveLength(2);

      const completedTask = allTasks.find(t => t.id === task.id);
      const newTask = allTasks.find(t => t.id !== task.id);

      expect(completedTask?.completed).toBe(true);
      expect(newTask?.completed).toBe(false);
      expect(newTask?.title).toBe("Recurring task");
      expect(newTask?.recurrence).toBe("daily");
      expect(newTask?.parentTaskId).toBe(task.id);
    });

    it("should calculate next due date for daily recurrence", async () => {
      const dueDate = new Date("2025-01-01T00:00:00.000Z");
      const task = await createTask(createSampleTask({
        recurrence: "daily",
        dueDate: dueDate.toISOString()
      }));

      await toggleCompleted(task.id, true);

      const allTasks = await listTasks();
      const newTask = allTasks.find(t => t.id !== task.id);

      expect(newTask?.dueDate).toBeDefined();
      const nextDue = new Date(newTask!.dueDate!);
      const original = new Date(dueDate);
      // Check the next due date is 1 day later
      expect(nextDue.getTime() - original.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it("should calculate next due date for weekly recurrence", async () => {
      const dueDate = new Date("2025-01-01T00:00:00.000Z");
      const task = await createTask(createSampleTask({
        recurrence: "weekly",
        dueDate: dueDate.toISOString()
      }));

      await toggleCompleted(task.id, true);

      const allTasks = await listTasks();
      const newTask = allTasks.find(t => t.id !== task.id);

      expect(newTask?.dueDate).toBeDefined();
      const nextDue = new Date(newTask!.dueDate!);
      const original = new Date(dueDate);
      // Check the next due date is 7 days later
      expect(nextDue.getTime() - original.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should calculate next due date for monthly recurrence", async () => {
      const dueDate = new Date("2025-01-15T00:00:00.000Z");
      const task = await createTask(createSampleTask({
        recurrence: "monthly",
        dueDate: dueDate.toISOString()
      }));

      await toggleCompleted(task.id, true);

      const allTasks = await listTasks();
      const newTask = allTasks.find(t => t.id !== task.id);

      expect(newTask?.dueDate).toBeDefined();
      const nextDue = new Date(newTask!.dueDate!);
      const original = new Date(dueDate);
      // Month should increase by 1
      expect(nextDue.getMonth()).toBe((original.getMonth() + 1) % 12);
      expect(nextDue.getDate()).toBe(original.getDate());
    });

    it("should reset subtasks to uncompleted in new recurring instance", async () => {
      const task = await createTask(createSampleTask({
        recurrence: "daily",
        subtasks: [
          { id: "sub1", title: "Subtask 1", completed: true },
          { id: "sub2", title: "Subtask 2", completed: false }
        ]
      }));

      await toggleCompleted(task.id, true);

      const allTasks = await listTasks();
      const newTask = allTasks.find(t => t.id !== task.id);

      expect(newTask?.subtasks).toHaveLength(2);
      expect(newTask?.subtasks[0].completed).toBe(false);
      expect(newTask?.subtasks[1].completed).toBe(false);
    });

    it("should throw error for non-existent task", async () => {
      await expect(toggleCompleted("nonexistent", true)).rejects.toThrow("Task nonexistent not found");
    });
  });

  describe("deleteTask", () => {
    it("should delete task", async () => {
      const task = await createTask(createSampleTask());
      const tasks = await listTasks();
      expect(tasks).toHaveLength(1);

      await deleteTask(task.id);

      const afterDelete = await listTasks();
      expect(afterDelete).toHaveLength(0);
    });

    it("should not throw error when deleting non-existent task", async () => {
      await expect(deleteTask("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("moveTaskToQuadrant", () => {
    it("should move task to different quadrant", async () => {
      const task = await createTask(createSampleTask({
        urgent: true,
        important: true
      }));
      expect(task.quadrant).toBe("urgent-important");

      const moved = await moveTaskToQuadrant(task.id, "not-urgent-important");

      expect(moved.quadrant).toBe("not-urgent-important");
      expect(moved.urgent).toBe(false);
      expect(moved.important).toBe(true);
    });

    it("should throw error for non-existent task", async () => {
      await expect(moveTaskToQuadrant("nonexistent", "urgent-important")).rejects.toThrow("Task nonexistent not found");
    });
  });

  describe("Subtask operations", () => {
    describe("addSubtask", () => {
      it("should add subtask to task", async () => {
        const task = await createTask(createSampleTask());

        const updated = await addSubtask(task.id, "New subtask");

        expect(updated.subtasks).toHaveLength(1);
        expect(updated.subtasks[0].title).toBe("New subtask");
        expect(updated.subtasks[0].completed).toBe(false);
        expect(updated.subtasks[0].id).toHaveLength(12);
      });

      it("should throw error for non-existent task", async () => {
        await expect(addSubtask("nonexistent", "Subtask")).rejects.toThrow("Task nonexistent not found");
      });
    });

    describe("toggleSubtask", () => {
      it("should toggle subtask completion", async () => {
        const task = await createTask(createSampleTask({
          subtasks: [{ id: "sub1", title: "Subtask", completed: false }]
        }));

        const updated = await toggleSubtask(task.id, "sub1", true);

        expect(updated.subtasks[0].completed).toBe(true);
      });

      it("should throw error for non-existent task", async () => {
        await expect(toggleSubtask("nonexistent", "sub1", true)).rejects.toThrow("Task nonexistent not found");
      });
    });

    describe("deleteSubtask", () => {
      it("should delete subtask from task", async () => {
        const task = await createTask(createSampleTask({
          subtasks: [
            { id: "sub1", title: "Subtask 1", completed: false },
            { id: "sub2", title: "Subtask 2", completed: false }
          ]
        }));

        const updated = await deleteSubtask(task.id, "sub1");

        expect(updated.subtasks).toHaveLength(1);
        expect(updated.subtasks[0].id).toBe("sub2");
      });

      it("should throw error for non-existent task", async () => {
        await expect(deleteSubtask("nonexistent", "sub1")).rejects.toThrow("Task nonexistent not found");
      });
    });
  });

  describe("clearTasks", () => {
    it("should clear all tasks", async () => {
      await createTask(createSampleTask({ title: "Task 1" }));
      await createTask(createSampleTask({ title: "Task 2" }));
      expect(await listTasks()).toHaveLength(2);

      await clearTasks();

      expect(await listTasks()).toHaveLength(0);
    });
  });
});
