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
  updateTask
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

  return {
    isLoading,
    handleSubmit,
    handleDelete,
    handleComplete,
    handleExport,
    handleBulkAddTagsConfirm,
  };
}
