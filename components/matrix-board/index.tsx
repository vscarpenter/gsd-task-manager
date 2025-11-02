"use client";

import { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
import { DndContext } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { MatrixEmptyState } from "@/components/matrix-empty-state";
import { AppFooter } from "@/components/app-footer";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-popover";
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt";
import { SettingsDialog } from "@/components/settings-dialog";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { BulkTagDialog } from "@/components/bulk-tag-dialog";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { quadrants } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import type { FilterCriteria } from "@/lib/filters";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { extractAvailableTags, getFilteredQuadrants, getVisibleTaskCount } from "@/lib/matrix-filters";
import { useMatrixDialogs } from "@/lib/use-matrix-dialogs";
import { notificationChecker } from "@/lib/notification-checker";
import { TOAST_DURATION } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useBulkSelection } from "./use-bulk-selection";
import { useTaskOperations } from "./use-task-operations";

// Import UserGuideDialog normally to avoid chunk loading issues
import { UserGuideDialog } from "@/components/user-guide-dialog";

// Lazy load heavy components
const ImportDialog = lazy(() => import("@/components/import-dialog").then(m => ({ default: m.ImportDialog })));
const TaskForm = lazy(() => import("@/components/task-form").then(m => ({ default: m.TaskForm })));
const SaveSmartViewDialog = lazy(() => import("@/components/save-smart-view-dialog").then(m => ({ default: m.SaveSmartViewDialog })));

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

export function MatrixBoard() {
  const { all } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const dialogs = useMatrixDialogs();
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();
  const { sensors, handleDragEnd } = useDragAndDrop(handleError);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use custom hooks for bulk selection and task operations
  const bulkSelection = useBulkSelection(all);
  const taskOps = useTaskOperations(
    dialogs.dialogState,
    dialogs.closeDialog,
    showCompleted,
    all,
    bulkSelection.selectedTaskIds,
    bulkSelection.handleClearSelection
  );

  // Start notification checker when component mounts
  useEffect(() => {
    notificationChecker.start();
    return () => {
      notificationChecker.stop();
    };
  }, []);

  // Handle PWA shortcut for new task
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-task") {
      dialogs.setDialogState({ mode: "create" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [dialogs]);

  // Extract all unique tags from tasks
  const availableTags = useMemo(() => extractAvailableTags(all), [all]);

  // Filter and group tasks by quadrant
  const filteredQuadrants = useMemo(
    () => getFilteredQuadrants(all, filterCriteria, searchQuery, showCompleted),
    [all, filterCriteria, searchQuery, showCompleted]
  );

  // Calculate total visible task count
  const visibleCount = getVisibleTaskCount(filteredQuadrants);

  const handleSelectSmartView = (criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
    setSearchQuery("");
  };

  const handleSaveSmartView = () => {
    dialogs.setSaveSmartViewOpen(true);
  };

  const handleSmartViewSaved = () => {
    showToast("Smart View saved successfully", undefined, TOAST_DURATION.SHORT);
  };

  const handleImport = async (file: File) => {
    try {
      const contents = await file.text();
      JSON.parse(contents);
      dialogs.setPendingImportContents(contents);
      dialogs.setImportDialogOpen(true);
    } catch (error) {
      handleError(error, {
        action: "PARSE_JSON",
        userMessage: "Invalid JSON format in import file",
        timestamp: new Date().toISOString(),
        metadata: { fileName: file.name }
      });
    }
  };

  const handleImportComplete = () => {
    dialogs.setPendingImportContents(null);
    showToast("Tasks imported successfully", undefined, TOAST_DURATION.SHORT);
  };

  // Handle keyboard shortcuts
  useKeyboardShortcuts(
    {
      onNewTask: () => dialogs.setDialogState({ mode: "create" }),
      onSearch: () => searchInputRef.current?.focus(),
      onHelp: () => dialogs.setHelpOpen(true)
    },
    searchInputRef
  );

  const taskBeingEdited = dialogs.dialogState?.mode === "edit" ? dialogs.dialogState.task : undefined;
  const activeTaskDraft = taskBeingEdited ? toDraft(taskBeingEdited) : undefined;
  const hasTasks = all.length > 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        <NotificationPermissionPrompt />

        <AppHeader
          onNewTask={() => dialogs.setDialogState({ mode: "create" })}
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          searchInputRef={searchInputRef}
          onHelp={() => dialogs.setHelpOpen(true)}
          onOpenSettings={() => dialogs.setSettingsOpen(true)}
          onSelectSmartView={handleSelectSmartView}
          onOpenFilters={() => dialogs.setFilterPopoverOpen(true)}
          currentFilterCriteria={filterCriteria}
          selectionMode={bulkSelection.selectionMode}
          onToggleSelectionMode={bulkSelection.handleToggleSelectionMode}
          selectedCount={bulkSelection.selectedTaskIds.size}
        />

        {/* Active Filter Chips */}
        {hasTasks && (
          <div className="px-6">
            <FilterBar
              criteria={filterCriteria}
              onChange={setFilterCriteria}
            />
          </div>
        )}

        {/* Floating Action Button - Mobile Only */}
        <button
          onClick={() => dialogs.setDialogState({ mode: "create" })}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all hover:bg-accent-hover active:scale-95 md:hidden touch-manipulation"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))"
          }}
          aria-label="Create new task"
        >
          <PlusIcon className="h-6 w-6" />
        </button>

        <main className="px-6 pb-10 md:pb-10" style={{
          paddingBottom: "max(2.5rem, calc(5rem + env(safe-area-inset-bottom)))"
        }}>
          {!hasTasks ? (
            <MatrixEmptyState onCreateTask={() => dialogs.setDialogState({ mode: "create" })} />
          ) : visibleCount === 0 ? (
            <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">No tasks match &ldquo;{searchQuery}&rdquo;.</h2>
              <p className="mt-2 text-sm text-foreground-muted">Try a different search term or clear the filter.</p>
              <Button className="mt-4" variant="subtle" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="matrix-grid">
              {quadrants.map((quadrant) => (
                <MatrixColumn
                  key={quadrant.id}
                  quadrant={quadrant}
                  tasks={filteredQuadrants[quadrant.id] ?? []}
                  allTasks={all}
                  onEdit={(task) => dialogs.setDialogState({ mode: "edit", task })}
                  onDelete={taskOps.handleDelete}
                  onToggleComplete={taskOps.handleComplete}
                  onShare={dialogs.openShareDialog}
                  selectionMode={bulkSelection.selectionMode}
                  selectedTaskIds={bulkSelection.selectedTaskIds}
                  onToggleSelect={bulkSelection.handleToggleSelect}
                />
              ))}
            </div>
          )}
        </main>

        <AppFooter />

        {/* Bulk actions bar */}
        <BulkActionsBar
          selectedCount={bulkSelection.selectedTaskIds.size}
          onClearSelection={bulkSelection.handleClearSelection}
          onBulkDelete={bulkSelection.handleBulkDelete}
          onBulkComplete={bulkSelection.handleBulkComplete}
          onBulkUncomplete={bulkSelection.handleBulkUncomplete}
          onBulkMoveToQuadrant={bulkSelection.handleBulkMoveToQuadrant}
          onBulkAddTags={bulkSelection.handleBulkAddTags}
        />

        {/* Bulk tag dialog */}
        <BulkTagDialog
          open={dialogs.bulkTagDialogOpen}
          onOpenChange={dialogs.setBulkTagDialogOpen}
          onConfirm={taskOps.handleBulkAddTagsConfirm}
          selectedCount={bulkSelection.selectedTaskIds.size}
        />

        {/* Share task dialog */}
        <ShareTaskDialog
          task={dialogs.taskToShare}
          open={dialogs.shareTaskDialogOpen}
          onOpenChange={dialogs.setShareTaskDialogOpen}
        />

        {/* User Guide */}
        <UserGuideDialog open={dialogs.helpOpen} onOpenChange={dialogs.setHelpOpen} />

        {dialogs.importDialogOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <ImportDialog
              open={dialogs.importDialogOpen}
              onOpenChange={dialogs.setImportDialogOpen}
              fileContents={dialogs.pendingImportContents}
              existingTaskCount={all.length}
              onImportComplete={handleImportComplete}
            />
          </Suspense>
        )}

        {dialogs.saveSmartViewOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <SaveSmartViewDialog
              open={dialogs.saveSmartViewOpen}
              onOpenChange={dialogs.setSaveSmartViewOpen}
              criteria={filterCriteria}
              onSaved={handleSmartViewSaved}
            />
          </Suspense>
        )}

        <FilterPopover
          open={dialogs.filterPopoverOpen}
          onOpenChange={dialogs.setFilterPopoverOpen}
          criteria={filterCriteria}
          onChange={setFilterCriteria}
          onSaveAsSmartView={handleSaveSmartView}
          availableTags={availableTags}
        />

        {/* Settings Dialog */}
        <SettingsDialog
          open={dialogs.settingsOpen}
          onOpenChange={dialogs.setSettingsOpen}
          showCompleted={showCompleted}
          onToggleCompleted={() => setShowCompleted(!showCompleted)}
          onExport={taskOps.handleExport}
          onImport={handleImport}
          isLoading={taskOps.isLoading}
        />

        <Dialog open={dialogs.dialogState !== null} onOpenChange={(open) => (open ? null : dialogs.closeDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogs.dialogState?.mode === "edit" ? "Edit task" : "Create task"}</DialogTitle>
            </DialogHeader>
            {dialogs.dialogState !== null && (
              <Suspense fallback={<div className="flex items-center justify-center p-8"><Spinner /></div>}>
                <TaskForm
                  taskId={taskBeingEdited?.id}
                  initialValues={activeTaskDraft}
                  onSubmit={taskOps.handleSubmit}
                  onCancel={dialogs.closeDialog}
                  onDelete={taskBeingEdited ? () => taskOps.handleDelete(taskBeingEdited) : undefined}
                  submitLabel={dialogs.dialogState?.mode === "edit" ? "Update task" : "Add task"}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
