import {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  bulkUpdateTasks,
  type CreateTaskInput,
  type UpdateTaskInput,
  type BulkOperation,
} from '../../write-ops.js';
import type { GsdConfig } from '../../tools.js';

/**
 * Write operation tool handlers for modifying task data
 */

export async function handleCreateTask(config: GsdConfig, args: CreateTaskInput) {
  const newTask = await createTask(config, args);
  return {
    content: [
      {
        type: 'text' as const,
        text: `✅ Task created successfully!\n\n${JSON.stringify(newTask, null, 2)}`,
      },
    ],
  };
}

export async function handleUpdateTask(config: GsdConfig, args: UpdateTaskInput) {
  const updatedTask = await updateTask(config, args);
  return {
    content: [
      {
        type: 'text' as const,
        text: `✅ Task updated successfully!\n\n${JSON.stringify(updatedTask, null, 2)}`,
      },
    ],
  };
}

export async function handleCompleteTask(config: GsdConfig, args: { id: string; completed: boolean }) {
  const updatedTask = await completeTask(config, args.id, args.completed);
  return {
    content: [
      {
        type: 'text' as const,
        text: `✅ Task marked as ${args.completed ? 'complete' : 'incomplete'}!\n\n${JSON.stringify(updatedTask, null, 2)}`,
      },
    ],
  };
}

export async function handleDeleteTask(config: GsdConfig, args: { id: string }) {
  await deleteTask(config, args.id);
  return {
    content: [
      {
        type: 'text' as const,
        text: `✅ Task deleted successfully!\n\nTask ID: ${args.id}`,
      },
    ],
  };
}

export async function handleBulkUpdateTasks(
  config: GsdConfig,
  args: { taskIds: string[]; operation: BulkOperation; maxTasks?: number }
) {
  const result = await bulkUpdateTasks(config, args.taskIds, args.operation, { maxTasks: args.maxTasks });

  let message = `✅ Bulk operation completed!\n\n`;
  message += `Updated: ${result.updated} task(s)\n`;
  if (result.errors.length > 0) {
    message += `\nErrors (${result.errors.length}):\n`;
    result.errors.forEach((err, idx) => {
      message += `${idx + 1}. ${err}\n`;
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: message,
      },
    ],
  };
}
