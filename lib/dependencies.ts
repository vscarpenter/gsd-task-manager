import type { TaskRecord } from "@/lib/types";

/**
 * Check if adding a dependency would create a circular dependency
 * @param taskId - ID of the task that would have the dependency added
 * @param dependencyId - ID of the task to add as a dependency
 * @param allTasks - All tasks in the system
 * @returns true if circular dependency would be created
 */
export function wouldCreateCircularDependency(
  taskId: string,
  dependencyId: string,
  allTasks: TaskRecord[]
): boolean {
  // Can't depend on itself
  if (taskId === dependencyId) {
    return true;
  }

  // Build a map of task dependencies for quick lookup
  const dependencyMap = new Map<string, string[]>();
  allTasks.forEach(task => {
    dependencyMap.set(task.id, task.dependencies || []);
  });

  // Check if the dependency task (or any of its dependencies) already depends on this task
  const visited = new Set<string>();
  const queue: string[] = [dependencyId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // If we found a path back to the original task, it's circular
    if (currentId === taskId) {
      return true;
    }

    // Add all dependencies of the current task to the queue
    const deps = dependencyMap.get(currentId) || [];
    queue.push(...deps);
  }

  return false;
}

/**
 * Get all tasks that the given task depends on (blocking tasks)
 * @param task - The task to check
 * @param allTasks - All tasks in the system
 * @returns Array of tasks that must be completed before this task
 */
export function getBlockingTasks(task: TaskRecord, allTasks: TaskRecord[]): TaskRecord[] {
  if (!task.dependencies || task.dependencies.length === 0) {
    return [];
  }

  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  return task.dependencies
    .map(depId => taskMap.get(depId))
    .filter((t): t is TaskRecord => t !== undefined);
}

/**
 * Get all tasks that depend on the given task (blocked tasks)
 * @param taskId - ID of the task to check
 * @param allTasks - All tasks in the system
 * @returns Array of tasks that are blocked by this task
 */
export function getBlockedTasks(taskId: string, allTasks: TaskRecord[]): TaskRecord[] {
  return allTasks.filter(task =>
    task.dependencies && task.dependencies.includes(taskId)
  );
}

/**
 * Get uncompleted tasks that are blocking this task
 * @param task - The task to check
 * @param allTasks - All tasks in the system
 * @returns Array of uncompleted blocking tasks
 */
export function getUncompletedBlockingTasks(task: TaskRecord, allTasks: TaskRecord[]): TaskRecord[] {
  return getBlockingTasks(task, allTasks).filter(t => !t.completed);
}

/**
 * Check if a task is blocked (has uncompleted dependencies)
 * @param task - The task to check
 * @param allTasks - All tasks in the system
 * @returns true if task has uncompleted dependencies
 */
export function isTaskBlocked(task: TaskRecord, allTasks: TaskRecord[]): boolean {
  return getUncompletedBlockingTasks(task, allTasks).length > 0;
}

/**
 * Check if a task is blocking other tasks (other tasks depend on it)
 * @param taskId - ID of the task to check
 * @param allTasks - All tasks in the system
 * @returns true if other tasks depend on this one
 */
export function isTaskBlocking(taskId: string, allTasks: TaskRecord[]): boolean {
  return getBlockedTasks(taskId, allTasks).length > 0;
}

/**
 * Get all tasks that are ready to work on (no uncompleted dependencies)
 * @param tasks - Tasks to filter
 * @param allTasks - All tasks in the system for dependency lookup
 * @returns Array of tasks with no blocking dependencies
 */
export function getReadyTasks(tasks: TaskRecord[], allTasks: TaskRecord[]): TaskRecord[] {
  return tasks.filter(task => !task.completed && !isTaskBlocked(task, allTasks));
}

/**
 * Validate dependencies array (no self-references, all tasks exist)
 * @param taskId - ID of the task
 * @param dependencies - Array of dependency IDs
 * @param allTasks - All tasks in the system
 * @returns Object with valid flag and error message if invalid
 */
export function validateDependencies(
  taskId: string,
  dependencies: string[],
  allTasks: TaskRecord[]
): { valid: boolean; error?: string } {
  // Check for self-reference
  if (dependencies.includes(taskId)) {
    return { valid: false, error: "A task cannot depend on itself" };
  }

  // Check that all dependency tasks exist
  const taskIds = new Set(allTasks.map(t => t.id));
  const missingTasks = dependencies.filter(depId => !taskIds.has(depId));
  if (missingTasks.length > 0) {
    return {
      valid: false,
      error: `Dependency tasks not found: ${missingTasks.join(", ")}`
    };
  }

  // Check for circular dependencies
  for (const depId of dependencies) {
    if (wouldCreateCircularDependency(taskId, depId, allTasks)) {
      const depTask = allTasks.find(t => t.id === depId);
      return {
        valid: false,
        error: `Circular dependency detected with "${depTask?.title || depId}"`
      };
    }
  }

  return { valid: true };
}
