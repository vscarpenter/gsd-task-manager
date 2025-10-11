"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { logError, getUserErrorMessage } from "@/lib/error-logger";
import type { ErrorContext } from "@/lib/error-logger";

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
export function useErrorHandler() {
  const { showToast } = useToast();

  const handleError = useCallback(
    (error: unknown, context: ErrorContext) => {
      // Log the error with full context
      logError(error, context);

      // Show user-friendly error message
      const userMessage = getUserErrorMessage(error, context.userMessage);
      showToast(userMessage, undefined, 5000);
    },
    [showToast]
  );

  return handleError;
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
export function useErrorHandlerWithUndo() {
  const { showToast } = useToast();

  const handleError = useCallback(
    (error: unknown, context: ErrorContext) => {
      logError(error, context);
      const userMessage = getUserErrorMessage(error, context.userMessage);
      showToast(userMessage, undefined, 5000);
    },
    [showToast]
  );

  const handleSuccess = useCallback(
    (message: string, undoAction: () => Promise<void>, duration = 5000) => {
      showToast(
        message,
        {
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
              showToast('Failed to undo operation', undefined, 3000);
            }
          }
        },
        duration
      );
    },
    [showToast]
  );

  return { handleError, handleSuccess };
}
