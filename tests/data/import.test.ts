import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { importTasks, exportTasks, createTask, listTasks, clearTasks } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import type { ImportPayload, TaskDraft } from "@/lib/types";

describe("Import functionality", () => {
  // Clean up database before and after each test
  beforeEach(async () => {
    // Ensure database is initialized by accessing it
    await getDb();
    await clearTasks();
  });

  afterEach(async () => {
    await clearTasks();
  });

  const createSampleTask = (overrides?: Partial<TaskDraft>): TaskDraft => ({
    title: "Sample task",
    description: "Test description",
    urgent: true,
    important: false,
    recurrence: "none",
    tags: [],
    subtasks: [],
    ...overrides
  });

  describe("Replace mode", () => {
    it("should clear existing tasks and add imported tasks", async () => {
      // Create some existing tasks
      await createTask(createSampleTask({ title: "Existing task 1" }));
      await createTask(createSampleTask({ title: "Existing task 2" }));

      const existing = await listTasks();
      expect(existing).toHaveLength(2);

      // Create import payload with different tasks
      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "import-1",
            title: "Imported task",
            description: "",
            urgent: false,
            important: true,
            quadrant: "not-urgent-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: [],
            subtasks: [],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      // Import with replace mode
      await importTasks(importPayload, "replace");

      const afterImport = await listTasks();
      expect(afterImport).toHaveLength(1);
      expect(afterImport[0].title).toBe("Imported task");
      expect(afterImport[0].id).toBe("import-1");
    });

    it("should handle empty existing tasks", async () => {
      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "task-1",
            title: "First task",
            description: "",
            urgent: true,
            important: true,
            quadrant: "urgent-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: [],
            subtasks: [],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(importPayload, "replace");

      const tasks = await listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("First task");
    });
  });

  describe("Merge mode", () => {
    it("should keep existing tasks and add imported tasks", async () => {
      // Create existing task
      await createTask(createSampleTask({ title: "Existing task" }));

      const existing = await listTasks();
      expect(existing).toHaveLength(1);
      const existingId = existing[0].id;

      // Import with merge mode
      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "imported-1",
            title: "Imported task",
            description: "",
            urgent: false,
            important: true,
            quadrant: "not-urgent-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: ["imported"],
            subtasks: [],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(importPayload, "merge");

      const afterImport = await listTasks();
      expect(afterImport).toHaveLength(2);

      const titles = afterImport.map(t => t.title).sort();
      expect(titles).toEqual(["Existing task", "Imported task"]);

      // Verify existing task still has original ID
      const existingTask = afterImport.find(t => t.title === "Existing task");
      expect(existingTask?.id).toBe(existingId);
    });

    it("should regenerate IDs for duplicate imports", async () => {
      // Create existing task with known ID
      const existingPayload: ImportPayload = {
        tasks: [
          {
            id: "duplicate-id",
            title: "Existing task",
            description: "",
            urgent: true,
            important: false,
            quadrant: "urgent-not-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: [],
            subtasks: [
              {
                id: "subtask-1234",
                title: "Existing subtask",
                completed: false
              }
            ],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(existingPayload, "replace");

      // Import task with same ID in merge mode
      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "duplicate-id",
            title: "Imported task with duplicate ID",
            description: "",
            urgent: false,
            important: true,
            quadrant: "not-urgent-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: [],
            subtasks: [
              {
                id: "subtask-5678",
                title: "Imported subtask",
                completed: false
              }
            ],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(importPayload, "merge");

      const afterImport = await listTasks();
      expect(afterImport).toHaveLength(2);

      // Verify IDs are different
      const ids = afterImport.map(t => t.id);
      expect(new Set(ids).size).toBe(2); // No duplicate IDs

      // Verify both tasks exist with different IDs
      const existingTask = afterImport.find(t => t.title === "Existing task");
      const importedTask = afterImport.find(t => t.title === "Imported task with duplicate ID");

      expect(existingTask).toBeDefined();
      expect(importedTask).toBeDefined();
      expect(existingTask?.id).toBe("duplicate-id"); // Original keeps ID
      expect(importedTask?.id).not.toBe("duplicate-id"); // Duplicate gets new ID

      // Verify subtask IDs were also regenerated
      expect(importedTask?.subtasks[0].id).not.toBe("subtask-5678");
      expect(existingTask?.subtasks[0].id).toBe("subtask-1234");
    });

    it("should handle empty existing tasks", async () => {
      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "task-1",
            title: "First imported task",
            description: "",
            urgent: true,
            important: true,
            quadrant: "urgent-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "none",
            tags: [],
            subtasks: [],
          notificationEnabled: true,
          notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(importPayload, "merge");

      const tasks = await listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("First imported task");
    });

    it("should preserve tags and subtasks during merge", async () => {
      // Create existing task with tags
      await createTask(createSampleTask({
        title: "Existing with features",
        tags: ["existing-tag"],
        subtasks: [{ id: "sub-1234", title: "Existing subtask", completed: false }]
      }));

      const importPayload: ImportPayload = {
        tasks: [
          {
            id: "imported-with-features",
            title: "Imported with features",
            description: "",
            urgent: false,
            important: false,
            quadrant: "not-urgent-not-important",
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrence: "weekly",
            tags: ["imported-tag", "another-tag"],
            subtasks: [
              { id: "sub-5678", title: "Imported subtask 1", completed: false },
              { id: "sub-9012", title: "Imported subtask 2", completed: true }
            ],
            notificationEnabled: true,
            notificationSent: false
          }
        ],
        exportedAt: new Date().toISOString(),
        version: "1.0.0"
      };

      await importTasks(importPayload, "merge");

      const tasks = await listTasks();
      expect(tasks).toHaveLength(2);

      const existingTask = tasks.find(t => t.title === "Existing with features");
      const importedTask = tasks.find(t => t.title === "Imported with features");

      // Verify existing task features preserved
      expect(existingTask?.tags).toEqual(["existing-tag"]);
      expect(existingTask?.subtasks).toHaveLength(1);
      expect(existingTask?.subtasks[0].title).toBe("Existing subtask");

      // Verify imported task features preserved
      expect(importedTask?.tags).toEqual(["imported-tag", "another-tag"]);
      expect(importedTask?.subtasks).toHaveLength(2);
      expect(importedTask?.recurrence).toBe("weekly");
    });
  });

  describe("Round-trip export/import", () => {
    it("should preserve all task data through export and import", async () => {
      // Create tasks with all features
      await createTask(createSampleTask({
        title: "Complex task",
        description: "With description",
        urgent: true,
        important: true,
        dueDate: new Date("2025-12-31").toISOString(),
        recurrence: "monthly",
        tags: ["tag1", "tag2"],
        subtasks: [
          { id: "st1-1234", title: "Subtask 1", completed: true },
          { id: "st2-5678", title: "Subtask 2", completed: false }
        ]
      }));

      // Export
      const exported = await exportTasks();

      // Clear and re-import
      await clearTasks();
      await importTasks(exported, "replace");

      // Verify data preserved
      const tasks = await listTasks();
      expect(tasks).toHaveLength(1);

      const task = tasks[0];
      expect(task.title).toBe("Complex task");
      expect(task.description).toBe("With description");
      expect(task.urgent).toBe(true);
      expect(task.important).toBe(true);
      expect(task.recurrence).toBe("monthly");
      expect(task.tags).toEqual(["tag1", "tag2"]);
      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks[0].completed).toBe(true);
      expect(task.subtasks[1].completed).toBe(false);
    });
  });
});
