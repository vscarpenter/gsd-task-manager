import { useState, useCallback } from "react";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
import { TOAST_DURATION } from "@/lib/constants";
import {
  createTask,
  deleteTask,
  exportToJson,
  toggleCompleted,
  updateTask,
  duplicateTask,
  snoozeTask,
  startTimeTracking,
  stopTimeTracking
} from "@/lib/tasks";
import * as bulkOps from "@/lib/bulk-operations";

function toDraft(task: TaskRecord): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    urgent: task.urgent,
    important: task.important,
    dueDate: task.dueDate,
    recurrence: task.recurrence,
    tags: task.tags,
    subtasks: task.subtasks,
    dependencies: task.dependencies,
    notifyBefore: task.notifyBefore,
    notificationEnabled: task.notificationEnabled
  };
}

interface DialogState {
  mode: "create" | "edit";
  task?: TaskRecord;
}

/**
 * Custom hook for managing task CRUD operations
 * Handles create, update, delete, complete, export, and import operations
 */
export function useTaskOperations(
  dialogState: DialogState | null,
  closeDialog: () => void,
  showCompleted: boolean,
  allTasks: TaskRecord[],
  selectedTaskIds: Set<string>,
  handleClearSelection: () => void
) {
  const { showToast } = useToast();
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (draft: TaskDraft) => {
    setIsLoading(true);
    try {
      if (dialogState?.mode === "edit" && dialogState.task) {
        await updateTask(dialogState.task.id, draft);
      } else {
        await createTask(draft);
      }
      closeDialog();
    } catch (error) {
      handleError(error, {
        action: dialogState?.mode === "edit" ? ErrorActions.UPDATE_TASK : ErrorActions.CREATE_TASK,
        taskId: dialogState?.task?.id,
        userMessage: ErrorMessages.TASK_SAVE_FAILED,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }, [dialogState, closeDialog, handleError]);

  const handleDelete = useCallback(async (task: TaskRecord) => {
    try {
      const taskData = { ...task };
      await deleteTask(task.id);
      closeDialog();

      handleSuccess(
        `Deleted "${task.title}"`,
        async () => {
          await createTask(toDraft(taskData));
        },
        TOAST_DURATION.LONG
      );
    } catch (error) {
      handleError(error, {
        action: ErrorActions.DELETE_TASK,
        taskId: task.id,
        userMessage: ErrorMessages.TASK_DELETE_FAILED,
        timestamp: new Date().toISOString()
      });
    }
  }, [closeDialog, handleSuccess, handleError]);

  const handleComplete = useCallback(async (task: TaskRecord, completed: boolean) => {
    try {
      await toggleCompleted(task.id, completed);

      if (completed && !showCompleted) {
        showToast(
          `"${task.title}" completed. Click 👁️ to view completed tasks`,
          undefined,
          TOAST_DURATION.LONG
        );
      }
    } catch (error) {
      handleError(error, {
        action: ErrorActions.TOGGLE_TASK,
        taskId: task.id,
        userMessage: ErrorMessages.TASK_UPDATE_FAILED,
        timestamp: new Date().toISOString()
      });
    }
  }, [showCompleted, showToast, handleError]);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const json = await exportToJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gsd-tasks-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error, {
        action: ErrorActions.EXPORT_TASKS,
        userMessage: ErrorMessages.EXPORT_FAILED,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);


  const handleBulkAddTagsConfirm = useCallback(async (tags: string[]) => {
    await bulkOps.bulkAddTags(
      tags,
      selectedTaskIds,
      allTasks,
      toDraft,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  }, [selectedTaskIds, allTasks, handleClearSelection, showToast, handleError]);

  const handleDuplicate = useCallback(async (task: TaskRecord) => {
    try {
      await duplicateTask(task.id);
      showToast(
        `"${task.title}" duplicated successfully`,
        undefined,
        TOAST_DURATION.SHORT
      );
    } catch (error) {
      handleError(error, {
        action: ErrorActions.CREATE_TASK,
        taskId: task.id,
        userMessage: "Failed to duplicate task",
        timestamp: new Date().toISOString()
      });
    }
  }, [showToast, handleError]);

  const handleSnooze = useCallback(async (taskId: string, minutes: number) => {
    try {
      await snoozeTask(taskId, minutes);
      if (minutes === 0) {
        showToast("Snooze cleared", undefined, TOAST_DURATION.SHORT);
      } else {
        const label = minutes < 60
          ? `${minutes} minutes`
          : minutes < 1440
            ? `${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''}`
            : `${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''}`;
        showToast(`Notifications snoozed for ${label}`, undefined, TOAST_DURATION.SHORT);
      }
    } catch (error) {
      handleError(error, {
        action: "SNOOZE_TASK",
        taskId,
        userMessage: "Failed to snooze task",
        timestamp: new Date().toISOString()
      });
    }
  }, [showToast, handleError]);

  const handleStartTimer = useCallback(async (taskId: string) => {
    try {
      await startTimeTracking(taskId);
      showToast("Timer started", undefined, TOAST_DURATION.SHORT);
    } catch (error) {
      handleError(error, {
        action: "START_TIMER",
        taskId,
        userMessage: "Failed to start timer",
        timestamp: new Date().toISOString()
      });
    }
  }, [showToast, handleError]);

  const handleStopTimer = useCallback(async (taskId: string) => {
    try {
      const task = await stopTimeTracking(taskId);
      const runningEntry = task.timeEntries?.find(e => e.endedAt && !task.timeEntries?.some(other => other.startedAt > e.startedAt));
      if (runningEntry?.endedAt) {
        const start = new Date(runningEntry.startedAt).getTime();
        const end = new Date(runningEntry.endedAt).getTime();
        const minutes = Math.round((end - start) / 60000);
        const label = minutes < 60
          ? `${minutes} min`
          : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        showToast(`Timer stopped: ${label}`, undefined, TOAST_DURATION.SHORT);
      } else {
        showToast("Timer stopped", undefined, TOAST_DURATION.SHORT);
      }
    } catch (error) {
      handleError(error, {
        action: "STOP_TIMER",
        taskId,
        userMessage: "Failed to stop timer",
        timestamp: new Date().toISOString()
      });
    }
  }, [showToast, handleError]);

  return {
    isLoading,
    handleSubmit,
    handleDelete,
    handleComplete,
    handleExport,
    handleBulkAddTagsConfirm,
    handleDuplicate,
    handleSnooze,
    handleStartTimer,
    handleStopTimer,
  };
}
