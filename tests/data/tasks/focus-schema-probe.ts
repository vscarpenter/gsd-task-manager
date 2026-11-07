import { storedTaskRecordSchema } from "@/lib/schema";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

/** What `useTasks` does to each stored row. */
export function useTasksSchemaProbe(overrides: Partial<TaskRecord>): TaskRecord | undefined {
  return storedTaskRecordSchema.safeParse(createMockTask(overrides)).data as TaskRecord | undefined;
}
