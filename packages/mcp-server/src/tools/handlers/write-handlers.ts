import {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  bulkUpdateTasks,
  type CreateTaskInput,
  type UpdateTaskInput,
  type BulkOperation,
  type DeleteTaskResult,
} from '../../write-ops.js';
import type { GsdConfig } from '../../tools.js';
import type { Task } from '../../types.js';
import type { McpToolResponse } from './types.js';

function formatWriteWarnings(warnings: string[]): string {
  if (warnings.length === 0) return '';
  return `\n\n⚠️ Warnings:\n${warnings.map((warning) => `  - ${warning}\n`).join('')}`;
}

function formatRecurringInstance(instance: Task | undefined, dryRun: boolean): string {
  if (!instance) return '';
  const summary = dryRun ? 'The next recurring instance would be created' : 'Next recurring instance created';
  return `\n\n${summary}:\n\n${JSON.stringify(instance, null, 2)}`;
}

export async function handleCreateTask(config: GsdConfig, args: CreateTaskInput): Promise<McpToolResponse> {
  const result = await createTask(config, args);

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be created (not saved):\n\n`;
    message += JSON.stringify(result.task, null, 2);
    message += formatWriteWarnings(result.validation.warnings);
    message += `\n\nTo create this task, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task created successfully!\n\n${JSON.stringify(result.task, null, 2)}`;
    message += formatWriteWarnings(result.validation.warnings);
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

export async function handleUpdateTask(config: GsdConfig, args: UpdateTaskInput): Promise<McpToolResponse> {
  const result = await updateTask(config, args);

  let message = result.dryRun
    ? '🔍 DRY RUN - Task would be updated (not saved):\n\n'
    : '✅ Task updated successfully!\n\n';
  if (result.changes.length > 0) {
    message += result.dryRun ? 'Changes:\n' : 'Changes applied:\n';
    for (const change of result.changes) message += `  - ${change}\n`;
    if (!result.dryRun) message += '\n';
  } else if (result.dryRun) {
    message += 'No changes detected.\n';
  }
  if (result.dryRun) message += '\nResulting task:\n';
  message += JSON.stringify(result.task, null, 2);
  message += formatRecurringInstance(result.recurringInstance, result.dryRun);
  message += formatWriteWarnings(result.validation.warnings);
  if (result.dryRun) message += `\n\nTo apply changes, remove dryRun or set it to false.`;

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
): Promise<McpToolResponse> {
  const result = await completeTask(config, args.id, args.completed, { dryRun: args.dryRun });

  let message: string;
  if (result.dryRun) {
    message = `🔍 DRY RUN - Task would be marked as ${args.completed ? 'complete' : 'incomplete'} (not saved):\n\n`;
    message += JSON.stringify(result.task, null, 2);
    message += formatRecurringInstance(result.recurringInstance, true);
    message += `\n\nTo apply this change, remove dryRun or set it to false.`;
  } else {
    message = `✅ Task marked as ${args.completed ? 'complete' : 'incomplete'}!\n\n${JSON.stringify(result.task, null, 2)}`;
    message += formatRecurringInstance(result.recurringInstance, false);
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

function formatDeletePreview(result: DeleteTaskResult): string {
  let message = `🔍 DRY RUN - Task would be deleted (not deleted):\n\n`;
  message += `Task: "${result.taskTitle}" (${result.taskId})\n`;

  if (result.affectedTasks.length > 0) {
    message += `\n⚠️ The following tasks depend on this task and would be affected:\n`;
    result.affectedTasks.forEach((title) => {
      message += `  - ${title}\n`;
    });
  }
  return message + `\nTo delete this task, pass dryRun=false explicitly.`;
}

function formatDeleteOutcome(result: DeleteTaskResult): string {
  let message = result.partial
    ? `⚠️ Task deleted; dependency cleanup is incomplete.\n\n`
    : `✅ Task deleted successfully!\n\n`;
  message += `Deleted: "${result.taskTitle}" (${result.taskId})`;

  if (result.affectedTasks.length > 0) {
    message += `\n\nCleaned dangling dependency references on ${result.dependenciesCleaned} of ${result.affectedTasks.length} dependent task(s):\n`;
    result.affectedTasks.forEach((title) => {
      message += `  - ${title}\n`;
    });
  }
  if (result.conflicts.length > 0) {
    message += `\n\nConflicts: ${result.conflicts.join(', ')} (changed during cleanup)`;
  }
  if (result.errors.length > 0) {
    message += `\n\nCleanup errors:\n${result.errors.join('\n')}`;
  }
  return message;
}

/** `expectedStamps` is what a person confirmed deleting (see delete-confirmation.ts). */
export async function handleDeleteTask(
  config: GsdConfig,
  args: { id: string; dryRun?: boolean },
  expectedStamps?: Record<string, string>
): Promise<McpToolResponse> {
  const result = await deleteTask(config, args.id, { dryRun: args.dryRun, expectedStamps });
  const text = result.dryRun ? formatDeletePreview(result) : formatDeleteOutcome(result);

  return {
    ...(result.partial ? { isError: true } : {}),
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

type BulkResult = Awaited<ReturnType<typeof bulkUpdateTasks>>;

function formatBulkCounts(result: BulkResult, futureTense: boolean): string {
  const updated = result.updated > 0
    ? `${futureTense ? 'Would update' : 'Updated'}: ${result.updated} task(s)\n`
    : '';
  const deleted = result.deleted > 0
    ? `${futureTense ? 'Would delete' : 'Deleted'}: ${result.deleted} task(s)\n`
    : '';
  return updated + deleted;
}

function formatBulkIssues(result: BulkResult): string {
  const errors = result.errors.length > 0
    ? `\nErrors (${result.errors.length}):\n${result.errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}\n`
    : '';
  const conflicts = result.conflicts.length > 0
    ? `\nConflicts (${result.conflicts.length} skipped — task changed during bulk operation):\n${result.conflicts.map((id, index) => `${index + 1}. ${id} (re-fetch and retry if you still want to apply the change)`).join('\n')}\n`
    : '';
  return errors + conflicts;
}

function formatBulkMessage(result: BulkResult, isPartial: boolean): string {
  if (result.dryRun) {
    const affected = result.updated + result.deleted;
    return `🔍 DRY RUN - Bulk operation would affect ${affected} task(s) (not saved):\n\n` +
      formatBulkCounts(result, true) +
      `\nTo apply changes, set dryRun to false.` +
      formatBulkIssues(result);
  }
  const headline = isPartial
    ? `⚠️ Bulk operation partially completed.\n\n`
    : `✅ Bulk operation completed!\n\n`;
  return headline + formatBulkCounts(result, false) + formatBulkIssues(result);
}

export async function handleBulkUpdateTasks(
  config: GsdConfig,
  args: { taskIds: string[]; operation: BulkOperation; dryRun?: boolean },
  expectedStamps?: Record<string, string>
): Promise<McpToolResponse> {
  const result = await bulkUpdateTasks(config, args.taskIds, args.operation, {
    dryRun: args.dryRun,
    expectedStamps,
  });
  const isPartial = result.errors.length > 0 || result.conflicts.length > 0;

  return {
    content: [
      {
        type: 'text' as const,
        text: formatBulkMessage(result, isPartial),
      },
    ],
    ...(isPartial ? { isError: true } : {}),
  };
}
