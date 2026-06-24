"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { logError, getUserErrorMessage } from "@/lib/error-logger";
import type { ErrorContext } from "@/lib/error-logger";
import { TOAST_DURATION } from "@/lib/constants";

/**
 * Hook for consistent error handling across the application
 *
 * Usage:
 * ```typescript
 * const handleError = useErrorHandler();
 *
 * try {
 *   await deleteTask(taskId);
 * } catch (error) {
 *   handleError(error, {
 *     action: ErrorActions.DELETE_TASK,
 *     taskId,
 *     userMessage: ErrorMessages.TASK_DELETE_FAILED
 *   });
 * }
 * ```
 */
export function useErrorHandler(): (error: unknown, context: ErrorContext) => void {
  return useCallback((error: unknown, context: ErrorContext) => {
    logError(error, context);
    const userMessage = getUserErrorMessage(error, context.userMessage);
    toast.error(userMessage, { duration: TOAST_DURATION.LONG });
  }, []);
}

/**
 * Hook for operations with undo functionality
 *
 * Usage:
 * ```typescript
 * const { handleError, handleSuccess } = useErrorHandlerWithUndo();
 *
 * try {
 *   await deleteTask(taskId);
 *   handleSuccess('Task deleted', async () => {
 *     await createTask(taskData);
 *   });
 * } catch (error) {
 *   handleError(error, { ... });
 * }
 * ```
 */
export function useErrorHandlerWithUndo(): {
  handleError: (error: unknown, context: ErrorContext) => void;
  handleSuccess: (message: string, undoAction: () => Promise<void>, duration?: number) => void;
} {
  const handleError = useCallback((error: unknown, context: ErrorContext) => {
    logError(error, context);
    const userMessage = getUserErrorMessage(error, context.userMessage);
    toast.error(userMessage, { duration: TOAST_DURATION.LONG });
  }, []);

  const handleSuccess = useCallback(
    (message: string, undoAction: () => Promise<void>, duration: number = TOAST_DURATION.LONG) => {
      toast(message, {
        duration,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await undoAction();
            } catch (error) {
              logError(error, {
                action: 'undo_operation',
                userMessage: 'Failed to undo operation',
                timestamp: new Date().toISOString()
              });
              toast.error('Failed to undo operation', { duration: TOAST_DURATION.SHORT });
            }
          },
        },
      });
    },
    []
  );

  return { handleError, handleSuccess };
}
