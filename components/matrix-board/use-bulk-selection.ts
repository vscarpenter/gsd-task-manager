import { useState, useEffect, useCallback } from "react";
import type { TaskRecord, QuadrantId } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { TOAST_DURATION } from "@/lib/constants";
import * as bulkOps from "@/lib/bulk-operations";

/**
 * Custom hook for managing bulk selection and bulk operations
 * Handles selection mode, selected task IDs, and bulk action callbacks
 */
export function useBulkSelection(
  allTasks: TaskRecord[],
  onOpenBulkTagDialog: () => void
) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();

  // Auto-enable selection mode when first task is selected
  useEffect(() => {
    if (selectedTaskIds.size > 0 && !selectionMode) {
      setSelectionMode(true);
    }
  }, [selectedTaskIds.size, selectionMode]);

  const handleToggleSelect = useCallback((task: TaskRecord) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    bulkOps.clearSelection(setSelectedTaskIds, setSelectionMode);
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    bulkOps.toggleSelectionMode(selectionMode, handleClearSelection, setSelectionMode);
  }, [selectionMode, handleClearSelection]);

  const handleBulkDelete = useCallback(async () => {
    await bulkOps.bulkDelete(
      selectedTaskIds,
      allTasks,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  }, [selectedTaskIds, allTasks, handleClearSelection, showToast, handleError]);

  const handleBulkComplete = useCallback(async () => {
    await bulkOps.bulkComplete(
      selectedTaskIds,
      allTasks,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  }, [selectedTaskIds, allTasks, handleClearSelection, showToast, handleError]);

  const handleBulkUncomplete = useCallback(async () => {
    await bulkOps.bulkUncomplete(
      selectedTaskIds,
      allTasks,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  }, [selectedTaskIds, allTasks, handleClearSelection, showToast, handleError]);

  const handleBulkMoveToQuadrant = useCallback(async (quadrantId: QuadrantId) => {
    await bulkOps.bulkMoveToQuadrant(
      selectedTaskIds,
      allTasks,
      quadrantId,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  }, [selectedTaskIds, allTasks, handleClearSelection, showToast, handleError]);

  const handleBulkAddTags = useCallback(() => {
    onOpenBulkTagDialog();
  }, [onOpenBulkTagDialog]);

  return {
    selectionMode,
    selectedTaskIds,
    handleToggleSelect,
    handleClearSelection,
    handleToggleSelectionMode,
    handleBulkDelete,
    handleBulkComplete,
    handleBulkUncomplete,
    handleBulkMoveToQuadrant,
    handleBulkAddTags,
  };
}
