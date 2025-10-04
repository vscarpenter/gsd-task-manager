import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";
import { quadrantOrder } from "@/lib/quadrants";

export interface TaskBuckets {
  all: TaskRecord[];
  byQuadrant: Record<string, TaskRecord[]>;
}

export function useTasks(): TaskBuckets {
  const tasks =
    useLiveQuery(async () => {
      const rows = await db.tasks.toArray();
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, [], []) ?? [];

  const byQuadrant: Record<string, TaskRecord[]> = Object.fromEntries(
    quadrantOrder.map((id) => [id, []])
  );

  for (const task of tasks) {
    if (!byQuadrant[task.quadrant]) {
      byQuadrant[task.quadrant] = [];
    }
    byQuadrant[task.quadrant].push(task);
  }

  return { all: tasks, byQuadrant };
}
