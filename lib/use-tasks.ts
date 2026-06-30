import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { storedTaskRecordSchema } from "@/lib/schema";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";
import { quadrantOrder } from "@/lib/quadrants";

const logger = createLogger("DB");

export interface TaskBuckets {
  all: TaskRecord[];
  byQuadrant: Record<string, TaskRecord[]>;
  isLoading: boolean;
}

/**
 * Validate records read back from IndexedDB and drop any that are corrupt so
 * malformed data never reaches the UI. Uses the lenient (strip) record schema,
 * which keeps records carrying harmless legacy fields and only quarantines
 * genuinely invalid ones (wrong types, missing fields, bad enums).
 */
export function keepValidTaskRecords(rows: TaskRecord[]): TaskRecord[] {
  return rows.filter((task) => {
    const parsed = storedTaskRecordSchema.safeParse(task);
    if (parsed.success) {
      return true;
    }
    logger.warn("Quarantined corrupt task record", {
      taskId: task?.id,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
    return false;
  });
}

export function useTasks(): TaskBuckets {
  const result = useLiveQuery(async () => {
    if (typeof window === "undefined") {
      return [] as TaskRecord[];
    }
    const db = getDb();
    const rows = await db.tasks.toArray();
    const valid = keepValidTaskRecords(rows);
    return valid.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [], []);

  const isLoading = result === undefined;
  const tasks = result ?? [];

  const byQuadrant: Record<string, TaskRecord[]> = Object.fromEntries(
    quadrantOrder.map((id) => [id, []])
  );

  for (const task of tasks) {
    if (!byQuadrant[task.quadrant]) {
      byQuadrant[task.quadrant] = [];
    }
    byQuadrant[task.quadrant].push(task);
  }

  return { all: tasks, byQuadrant, isLoading };
}
