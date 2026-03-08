import { listTasks } from './list-tasks.js';
import type { GsdConfig, Task } from '../types.js';

/**
 * Get a single task by ID
 * Fetches all tasks and filters to find the specific task
 */
export async function getTask(config: GsdConfig, taskId: string): Promise<Task> {
  const tasks = await listTasks(config);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
}
