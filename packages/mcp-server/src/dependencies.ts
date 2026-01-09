/**
 * Dependency validation utilities for task relationships
 * Ports circular dependency detection from frontend lib/dependencies.ts
 */

import type { DecryptedTask } from './types.js';

/**
 * Check if adding a dependency would create a circular dependency
 *
 * Uses BFS (Breadth-First Search) because:
 * 1. BFS finds the shortest path to a cycle (better error messages)
 * 2. BFS is iterative (no stack overflow risk for deep dependency trees)
 * 3. BFS explores all immediate dependencies before going deeper
 *
 * @param taskId - ID of the task that would have the dependency added
 * @param dependencyId - ID of the task to add as a dependency
 * @param allTasks - All tasks in the system
 * @returns true if circular dependency would be created
 */
export function wouldCreateCircularDependency(
  taskId: string,
  dependencyId: string,
  allTasks: DecryptedTask[]
): boolean {
  // Can't depend on itself (trivial cycle)
  if (taskId === dependencyId) {
    return true;
  }

  // Build a map of task dependencies for O(1) lookup during BFS
  const dependencyMap = new Map<string, string[]>();
  allTasks.forEach((task) => {
    dependencyMap.set(task.id, task.dependencies || []);
  });

  // BFS: Check if the dependency task transitively depends on this task
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
 * Validate dependencies array for a task
 * Checks for self-references, missing tasks, and circular dependencies
 *
 * @param taskId - ID of the task (or null for new tasks)
 * @param dependencies - Array of dependency IDs to validate
 * @param allTasks - All tasks in the system
 * @returns Validation result with error details if invalid
 */
export function validateDependencies(
  taskId: string | null,
  dependencies: string[],
  allTasks: DecryptedTask[]
): { valid: boolean; error?: string } {
  // Check for self-reference (only for existing tasks)
  if (taskId && dependencies.includes(taskId)) {
    return { valid: false, error: 'A task cannot depend on itself' };
  }

  // Check that all dependency tasks exist
  const taskIds = new Set(allTasks.map((t) => t.id));
  const missingTasks = dependencies.filter((depId) => !taskIds.has(depId));
  if (missingTasks.length > 0) {
    return {
      valid: false,
      error: `Dependency tasks not found: ${missingTasks.join(', ')}`,
    };
  }

  // Check that dependency tasks are not completed
  const completedDeps = dependencies.filter((depId) => {
    const task = allTasks.find((t) => t.id === depId);
    return task?.completed;
  });
  if (completedDeps.length > 0) {
    const completedTitles = completedDeps
      .map((depId) => allTasks.find((t) => t.id === depId)?.title || depId)
      .join(', ');
    return {
      valid: false,
      error: `Cannot depend on completed tasks: ${completedTitles}`,
    };
  }

  // Check for circular dependencies (only for existing tasks)
  if (taskId) {
    for (const depId of dependencies) {
      if (wouldCreateCircularDependency(taskId, depId, allTasks)) {
        const depTask = allTasks.find((t) => t.id === depId);
        return {
          valid: false,
          error: `Circular dependency detected with "${depTask?.title || depId}"`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Find tasks that would be affected by deleting a task
 * Returns tasks that depend on the task being deleted
 *
 * @param taskId - ID of the task being deleted
 * @param allTasks - All tasks in the system
 * @returns Array of tasks that depend on this task
 */
export function getAffectedByDeletion(
  taskId: string,
  allTasks: DecryptedTask[]
): DecryptedTask[] {
  return allTasks.filter(
    (task) => task.dependencies && task.dependencies.includes(taskId)
  );
}

/**
 * Format dependency validation error for user display
 */
export function formatDependencyError(error: string): string {
  return `❌ Dependency validation failed\n\n${error}\n\nPlease check your task dependencies.`;
}
