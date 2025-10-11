import Dexie, { Table } from "dexie";
import type { TaskRecord, NotificationSettings } from "@/lib/types";
import type { SmartView } from "@/lib/filters";

class GsdDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;
  smartViews!: Table<SmartView, string>;
  notificationSettings!: Table<NotificationSettings, string>;

  constructor() {
    super("GsdTaskManager");

    // Version 1: Original schema
    this.version(1).stores({
      tasks: "id, quadrant, completed, dueDate"
    });

    // Version 2: Add new fields for enhancements (recurrence, tags, subtasks)
    // We keep the same indexes but add migration to populate defaults
    this.version(2)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have new fields with defaults
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.recurrence === undefined) {
            task.recurrence = "none";
          }
          if (task.tags === undefined) {
            task.tags = [];
          }
          if (task.subtasks === undefined) {
            task.subtasks = [];
          }
        });
      });

    // Version 3: Add indexes for better query performance and fix test issues
    // Add createdAt and updatedAt indexes for sorting and filtering
    this.version(3).stores({
      tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]"
    });

    // Version 4: Add Smart Views table for saved filters
    this.version(4).stores({
      tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]",
      smartViews: "id, name, isBuiltIn, createdAt"
    });

    // Version 5: Add notification fields and settings table
    this.version(5)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have notification fields with defaults
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.notificationEnabled === undefined) {
            task.notificationEnabled = true;
          }
          if (task.notificationSent === undefined) {
            task.notificationSent = false;
          }
        });
      });
  }
}

let dbInstance: GsdDatabase | null = null;

export function getDb(): GsdDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  dbInstance = new GsdDatabase();
  return dbInstance;
}
