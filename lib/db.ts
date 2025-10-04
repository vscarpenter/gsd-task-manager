import Dexie, { Table } from "dexie";
import type { TaskRecord } from "@/lib/types";

class GsdDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;

  constructor() {
    super("GsdTaskManager");
    this.version(1).stores({
      tasks: "id, quadrant, completed, dueDate"
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
