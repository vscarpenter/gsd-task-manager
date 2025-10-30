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
import { useToast } from "@/components/ui/toast";
import { quadrants, quadrantOrder } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import type { FilterCriteria } from "@/lib/filters";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import {
  createTask,
  deleteTask,
  exportToJson,
  toggleCompleted,
  updateTask
} from "@/lib/tasks";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
import { TOAST_DURATION } from "@/lib/constants";
import { notificationChecker } from "@/lib/notification-checker";
import * as bulkOps from "@/lib/bulk-operations";
import { useMatrixDialogs } from "@/lib/use-matrix-dialogs";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { extractAvailableTags, getFilteredQuadrants, getVisibleTaskCount } from "@/lib/matrix-filters";

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
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();
  const { sensors, handleDragEnd } = useDragAndDrop(handleError);
  const [isLoading, setIsLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Start notification checker when component mounts
  useEffect(() => {
    notificationChecker.start(); // Uses default interval from constants

    return () => {
      notificationChecker.stop();
    };
  }, []);

  // Handle PWA shortcut for new task
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-task") {
      dialogs.setDialogState({ mode: "create" });
      // Clean up URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [dialogs]);

  // Auto-enable selection mode when first task is selected
  useEffect(() => {
    if (selectedTaskIds.size > 0 && !selectionMode) {
      setSelectionMode(true);
    }
  }, [selectedTaskIds.size, selectionMode]);

  // Extract all unique tags from tasks
  const availableTags = useMemo(() => extractAvailableTags(all), [all]);

  // Filter and group tasks by quadrant
  const filteredQuadrants = useMemo(
    () => getFilteredQuadrants(all, filterCriteria, searchQuery, showCompleted),
    [all, filterCriteria, searchQuery, showCompleted]
  );

  // Calculate total visible task count
  const visibleCount = getVisibleTaskCount(filteredQuadrants);

  const handleSubmit = async (draft: TaskDraft) => {
    setIsLoading(true);
    try {
      if (dialogs.dialogState?.mode === "edit" && dialogs.dialogState.task) {
        await updateTask(dialogs.dialogState.task.id, draft);
      } else {
        await createTask(draft);
      }
      dialogs.closeDialog();
    } catch (error) {
      handleError(error, {
        action: dialogs.dialogState?.mode === "edit" ? ErrorActions.UPDATE_TASK : ErrorActions.CREATE_TASK,
        taskId: dialogs.dialogState?.task?.id,
        userMessage: ErrorMessages.TASK_SAVE_FAILED,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (task: TaskRecord) => {
    try {
      // Store task data for undo
      const taskData = { ...task };

      await deleteTask(task.id);
      dialogs.closeDialog();

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
  };

  const handleComplete = async (task: TaskRecord, completed: boolean) => {
    try {
      await toggleCompleted(task.id, completed);

      // Show helpful toast when completing a task (only if completed tasks are hidden)
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
  };

  const handleExport = async () => {
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
  };

  const handleImport = async (file: File) => {
    try {
      const contents = await file.text();
      // Validate JSON format before showing dialog
      JSON.parse(contents);
      dialogs.setPendingImportContents(contents);
      dialogs.setImportDialogOpen(true);
    } catch (error) {
      handleError(error, {
        action: ErrorActions.PARSE_JSON,
        userMessage: ErrorMessages.IMPORT_INVALID_FORMAT,
        timestamp: new Date().toISOString(),
        metadata: { fileName: file.name }
      });
    }
  };

  const handleImportComplete = () => {
    dialogs.setPendingImportContents(null);
    showToast("Tasks imported successfully", undefined, TOAST_DURATION.SHORT);
  };

  const handleSelectSmartView = (criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
    setSearchQuery(""); // Clear search when selecting a Smart View
  };

  const handleSaveSmartView = () => {
    dialogs.setSaveSmartViewOpen(true);
  };

  const handleSmartViewSaved = () => {
    showToast("Smart View saved successfully", undefined, TOAST_DURATION.SHORT);
  };

  // Bulk operation handlers
  const handleToggleSelect = (task: TaskRecord) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    bulkOps.clearSelection(setSelectedTaskIds, setSelectionMode);
  };

  const handleToggleSelectionMode = () => {
    bulkOps.toggleSelectionMode(selectionMode, handleClearSelection, setSelectionMode);
  };

  const handleBulkDelete = async () => {
    await bulkOps.bulkDelete(
      selectedTaskIds,
      all,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  };

  const handleBulkComplete = async () => {
    await bulkOps.bulkComplete(
      selectedTaskIds,
      all,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  };

  const handleBulkUncomplete = async () => {
    await bulkOps.bulkUncomplete(
      selectedTaskIds,
      all,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  };

  const handleBulkMoveToQuadrant = async (quadrantId: QuadrantId) => {
    await bulkOps.bulkMoveToQuadrant(
      selectedTaskIds,
      all,
      quadrantId,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
  };

  const handleBulkAddTags = () => {
    dialogs.setBulkTagDialogOpen(true);
  };

  const handleBulkAddTagsConfirm = async (tagsToAdd: string[]) => {
    await bulkOps.bulkAddTags(
      tagsToAdd,
      selectedTaskIds,
      all,
      toDraft,
      (message) => {
        handleClearSelection();
        showToast(message, undefined, TOAST_DURATION.SHORT);
      },
      handleError
    );
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
          selectionMode={selectionMode}
          onToggleSelectionMode={handleToggleSelectionMode}
          selectedCount={selectedTaskIds.size}
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
              <Button className="mt-4" variant="subtle" onClick={() => setSearchQuery("")}
              >
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
                  onDelete={handleDelete}
                  onToggleComplete={handleComplete}
                  onShare={dialogs.openShareDialog}
                  selectionMode={selectionMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}
        </main>

        <AppFooter />

        {/* Bulk actions bar */}
        <BulkActionsBar
          selectedCount={selectedTaskIds.size}
          onClearSelection={handleClearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkComplete={handleBulkComplete}
          onBulkUncomplete={handleBulkUncomplete}
          onBulkMoveToQuadrant={handleBulkMoveToQuadrant}
          onBulkAddTags={handleBulkAddTags}
        />

        {/* Bulk tag dialog */}
        <BulkTagDialog
          open={dialogs.bulkTagDialogOpen}
          onOpenChange={dialogs.setBulkTagDialogOpen}
          onConfirm={handleBulkAddTagsConfirm}
          selectedCount={selectedTaskIds.size}
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
          onExport={handleExport}
          onImport={handleImport}
          isLoading={isLoading}
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
                  onSubmit={handleSubmit}
                  onCancel={dialogs.closeDialog}
                  onDelete={taskBeingEdited ? () => handleDelete(taskBeingEdited) : undefined}
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
