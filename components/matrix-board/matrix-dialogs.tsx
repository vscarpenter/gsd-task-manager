"use client";

import { lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { UserGuideDialog } from "@/components/user-guide-dialog";
import { FilterPopover } from "@/components/filter-popover";
import { SettingsDialog } from "@/components/settings-dialog";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { BulkTagDialog } from "@/components/bulk-tag-dialog";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import type { FilterCriteria } from "@/lib/filters";
import type { QuadrantId } from "@/lib/types";

// Lazy load heavy components
const ImportDialog = lazy(() =>
  import("@/components/import-dialog").then((m) => ({ default: m.ImportDialog }))
);
const TaskForm = lazy(() =>
  import("@/components/task-form").then((m) => ({ default: m.TaskForm }))
);
const SaveSmartViewDialog = lazy(() =>
  import("@/components/save-smart-view-dialog").then((m) => ({
    default: m.SaveSmartViewDialog,
  }))
);

interface DialogState {
  mode: "create" | "edit";
  task?: TaskRecord;
}

interface MatrixDialogsProps {
  // Bulk actions
  bulkTagDialogOpen: boolean;
  setBulkTagDialogOpen: (open: boolean) => void;
  selectedCount: number;
  onBulkAddTagsConfirm: (tags: string[]) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkComplete: () => void;
  onBulkUncomplete: () => void;
  onBulkMoveToQuadrant: (quadrant: QuadrantId) => void;
  onBulkAddTags: () => void;

  // Share dialog
  taskToShare: TaskRecord | null;
  shareTaskDialogOpen: boolean;
  setShareTaskDialogOpen: (open: boolean) => void;

  // Help dialog
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;

  // Import dialog
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  pendingImportContents: string | null;
  existingTaskCount: number;
  onImportComplete: () => void;

  // Save smart view dialog
  saveSmartViewOpen: boolean;
  setSaveSmartViewOpen: (open: boolean) => void;
  filterCriteria: FilterCriteria;
  onSmartViewSaved: () => void;

  // Filter popover
  filterPopoverOpen: boolean;
  setFilterPopoverOpen: (open: boolean) => void;
  onFilterChange: (criteria: FilterCriteria) => void;
  onSaveAsSmartView: () => void;
  availableTags: string[];

  // Settings dialog
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  isLoading: boolean;

  // Task form dialog
  dialogState: DialogState | null;
  closeDialog: () => void;
  taskBeingEdited?: TaskRecord;
  activeTaskDraft?: TaskDraft;
  onSubmit: (draft: TaskDraft) => void;
  onDelete?: (task: TaskRecord) => void;
}

export function MatrixDialogs(props: MatrixDialogsProps) {
  return (
    <>
      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedCount={props.selectedCount}
        onClearSelection={props.onClearSelection}
        onBulkDelete={props.onBulkDelete}
        onBulkComplete={props.onBulkComplete}
        onBulkUncomplete={props.onBulkUncomplete}
        onBulkMoveToQuadrant={props.onBulkMoveToQuadrant}
        onBulkAddTags={props.onBulkAddTags}
      />

      {/* Bulk tag dialog */}
      <BulkTagDialog
        open={props.bulkTagDialogOpen}
        onOpenChange={props.setBulkTagDialogOpen}
        onConfirm={props.onBulkAddTagsConfirm}
        selectedCount={props.selectedCount}
      />

      {/* Share task dialog */}
      <ShareTaskDialog
        task={props.taskToShare}
        open={props.shareTaskDialogOpen}
        onOpenChange={props.setShareTaskDialogOpen}
      />

      {/* User Guide */}
      <UserGuideDialog open={props.helpOpen} onOpenChange={props.setHelpOpen} />

      {/* Import Dialog */}
      {props.importDialogOpen && (
        <Suspense fallback={<div className="sr-only">Loading...</div>}>
          <ImportDialog
            open={props.importDialogOpen}
            onOpenChange={props.setImportDialogOpen}
            fileContents={props.pendingImportContents}
            existingTaskCount={props.existingTaskCount}
            onImportComplete={props.onImportComplete}
          />
        </Suspense>
      )}

      {/* Save Smart View Dialog */}
      {props.saveSmartViewOpen && (
        <Suspense fallback={<div className="sr-only">Loading...</div>}>
          <SaveSmartViewDialog
            open={props.saveSmartViewOpen}
            onOpenChange={props.setSaveSmartViewOpen}
            criteria={props.filterCriteria}
            onSaved={props.onSmartViewSaved}
          />
        </Suspense>
      )}

      {/* Filter Popover */}
      <FilterPopover
        open={props.filterPopoverOpen}
        onOpenChange={props.setFilterPopoverOpen}
        criteria={props.filterCriteria}
        onChange={props.onFilterChange}
        onSaveAsSmartView={props.onSaveAsSmartView}
        availableTags={props.availableTags}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={props.settingsOpen}
        onOpenChange={props.setSettingsOpen}
        showCompleted={props.showCompleted}
        onToggleCompleted={props.onToggleCompleted}
        onExport={props.onExport}
        onImport={props.onImport}
        isLoading={props.isLoading}
      />

      {/* Task Form Dialog */}
      <Dialog
        open={props.dialogState !== null}
        onOpenChange={(open) => (open ? null : props.closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {props.dialogState?.mode === "edit" ? "Edit task" : "Create task"}
            </DialogTitle>
          </DialogHeader>
          {props.dialogState !== null && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center p-8">
                  <Spinner />
                </div>
              }
            >
              <TaskForm
                taskId={props.taskBeingEdited?.id}
                initialValues={props.activeTaskDraft}
                onSubmit={props.onSubmit}
                onCancel={props.closeDialog}
                onDelete={
                  props.taskBeingEdited
                    ? () => props.onDelete?.(props.taskBeingEdited!)
                    : undefined
                }
                submitLabel={props.dialogState?.mode === "edit" ? "Update task" : "Add task"}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
