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
 * All handlers support dry-run mode for previewing changes
 */

export async function handleCreateTask(config: GsdConfig, args: CreateTaskInput) {
  const result = await createTask(config, args);

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be created (not saved):\n\n`;
    message += JSON.stringify(result.task, null, 2);
    if (result.validation.warnings.length > 0) {
      message += `\n\n⚠️ Warnings:\n`;
      result.validation.warnings.forEach((w) => {
        message += `  - ${w}\n`;
      });
    }
    message += `\n\nTo create this task, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task created successfully!\n\n${JSON.stringify(result.task, null, 2)}`;
    if (result.validation.warnings.length > 0) {
      message += `\n\n⚠️ Warnings:\n`;
      result.validation.warnings.forEach((w) => {
        message += `  - ${w}\n`;
      });
    }
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

export async function handleUpdateTask(config: GsdConfig, args: UpdateTaskInput) {
  const result = await updateTask(config, args);

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be updated (not saved):\n\n`;
    if (result.changes.length > 0) {
      message += `Changes:\n`;
      result.changes.forEach((c) => {
        message += `  - ${c}\n`;
      });
    } else {
      message += `No changes detected.\n`;
    }
    message += `\nResulting task:\n${JSON.stringify(result.task, null, 2)}`;
    if (result.validation.warnings.length > 0) {
      message += `\n\n⚠️ Warnings:\n`;
      result.validation.warnings.forEach((w) => {
        message += `  - ${w}\n`;
      });
    }
    message += `\n\nTo apply changes, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task updated successfully!\n\n`;
    if (result.changes.length > 0) {
      message += `Changes applied:\n`;
      result.changes.forEach((c) => {
        message += `  - ${c}\n`;
      });
      message += `\n`;
    }
    message += JSON.stringify(result.task, null, 2);
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

export async function handleCompleteTask(
  config: GsdConfig,
  args: { id: string; completed: boolean; dryRun?: boolean }
) {
  const result = await completeTask(config, args.id, args.completed, { dryRun: args.dryRun });

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be marked as ${args.completed ? 'complete' : 'incomplete'} (not saved):\n\n`;
    message += JSON.stringify(result.task, null, 2);
    message += `\n\nTo apply this change, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task marked as ${args.completed ? 'complete' : 'incomplete'}!\n\n${JSON.stringify(result.task, null, 2)}`;
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

export async function handleDeleteTask(config: GsdConfig, args: { id: string; dryRun?: boolean }) {
  const result = await deleteTask(config, args.id, { dryRun: args.dryRun });

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be deleted (not deleted):\n\n`;
    message += `Task: "${result.taskTitle}" (${result.taskId})\n`;

    if (result.affectedTasks.length > 0) {
      message += `\n⚠️ The following tasks depend on this task and would be affected:\n`;
      result.affectedTasks.forEach((title) => {
        message += `  - ${title}\n`;
      });
    }
    message += `\nTo delete this task, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task deleted successfully!\n\n`;
    message += `Deleted: "${result.taskTitle}" (${result.taskId})`;

    if (result.affectedTasks.length > 0) {
      message += `\n\n⚠️ Note: The following tasks had this task as a dependency:\n`;
      result.affectedTasks.forEach((title) => {
        message += `  - ${title}\n`;
      });
      message += `\nThese tasks may need their dependencies updated.`;
    }
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
