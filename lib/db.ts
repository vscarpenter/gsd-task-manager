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

export const db = new GsdDatabase();
