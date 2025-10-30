import { useState } from "react";
import type { TaskRecord } from "@/lib/types";

/**
 * Dialog state for task form (create/edit mode)
 */
export interface DialogState {
  mode: "create" | "edit";
  task?: TaskRecord;
}

/**
 * Custom hook for managing all dialog states in MatrixBoard
 * Centralizes dialog state management to reduce component complexity
 */
export function useMatrixDialogs() {
  // Task form dialog (create/edit)
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  // Help/User Guide dialog
  const [helpOpen, setHelpOpen] = useState(false);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportContents, setPendingImportContents] = useState<string | null>(null);

  // Filter popover
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  // Save Smart View dialog
  const [saveSmartViewOpen, setSaveSmartViewOpen] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Bulk tag dialog
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);

  // Share task dialog
  const [shareTaskDialogOpen, setShareTaskDialogOpen] = useState(false);
  const [taskToShare, setTaskToShare] = useState<TaskRecord | null>(null);

  // Helper function to close task form dialog
  const closeDialog = () => setDialogState(null);

  // Helper function to open share dialog
  const openShareDialog = (task: TaskRecord) => {
    setTaskToShare(task);
    setShareTaskDialogOpen(true);
  };

  // Helper function to close share dialog
  const closeShareDialog = () => {
    setShareTaskDialogOpen(false);
    setTaskToShare(null);
  };

  return {
    // Task form dialog
    dialogState,
    setDialogState,
    closeDialog,

    // Help dialog
    helpOpen,
    setHelpOpen,

    // Import dialog
    importDialogOpen,
    setImportDialogOpen,
    pendingImportContents,
    setPendingImportContents,

    // Filter popover
    filterPopoverOpen,
    setFilterPopoverOpen,

    // Save Smart View dialog
    saveSmartViewOpen,
    setSaveSmartViewOpen,

    // Settings dialog
    settingsOpen,
    setSettingsOpen,

    // Bulk tag dialog
    bulkTagDialogOpen,
    setBulkTagDialogOpen,

    // Share task dialog
    shareTaskDialogOpen,
    setShareTaskDialogOpen,
    taskToShare,
    setTaskToShare,
    openShareDialog,
    closeShareDialog,
  };
}
