import { generateId } from "@/lib/id-generator";
import type { TaskRecord } from "@/lib/types";

/**
 * Regenerate IDs for tasks that conflict with existing IDs
 *
 * Prevents ID collisions when merging imported tasks with existing tasks.
 * Also regenerates subtask IDs to maintain consistency.
 */
export function regenerateConflictingIds(
  tasks: TaskRecord[],
  existingIds: Set<string>
): { tasks: TaskRecord[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();

  const updatedTasks = tasks.map(task => {
    // If ID already exists, regenerate it
    if (existingIds.has(task.id)) {
      const newId = generateId();
      idMap.set(task.id, newId);
      return {
        ...task,
        id: newId,
        // Also regenerate subtask IDs to avoid conflicts
        subtasks: task.subtasks.map(subtask => ({
          ...subtask,
          id: generateId()
        }))
      };
    }
    return task;
  });

  return { tasks: updatedTasks, idMap };
}

/**
 * Update task references (dependencies, parentTaskId) after ID regeneration
 */
export function remapTaskReferences(
  tasks: TaskRecord[],
  idMap: Map<string, string>
): TaskRecord[] {
  if (idMap.size === 0) {
    return tasks;
  }

  return tasks.map(task => {
    const originalDeps = task.dependencies ?? [];
    const updatedDependencies = originalDeps.map(depId => idMap.get(depId) ?? depId);
    const updatedParentTaskId = task.parentTaskId ? (idMap.get(task.parentTaskId) ?? task.parentTaskId) : undefined;

    const dependenciesChanged =
      updatedDependencies.length !== originalDeps.length ||
      updatedDependencies.some((depId, index) => depId !== originalDeps[index]);

    const parentChanged = updatedParentTaskId !== task.parentTaskId;

    if (!dependenciesChanged && !parentChanged) {
      return task;
    }

    return {
      ...task,
      dependencies: updatedDependencies,
      parentTaskId: updatedParentTaskId,
    };
  });
}
