"use client";

import { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { MatrixEmptyState } from "@/components/matrix-empty-state";
import { AppFooter } from "@/components/app-footer";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-popover";
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt";
import { NotificationSettingsDialog } from "@/components/notification-settings-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { quadrants, quadrantOrder } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { applyFilters } from "@/lib/filters";
import type { FilterCriteria } from "@/lib/filters";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import {
  createTask,
  deleteTask,
  exportToJson,
  moveTaskToQuadrant,
  toggleCompleted,
  updateTask
} from "@/lib/tasks";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
import { DND_CONFIG, TOAST_DURATION } from "@/lib/constants";
import { notificationChecker } from "@/lib/notification-checker";

// Lazy load heavy components
const HelpDialog = lazy(() => import("@/components/help-dialog").then(m => ({ default: m.HelpDialog })));
const ImportDialog = lazy(() => import("@/components/import-dialog").then(m => ({ default: m.ImportDialog })));
const TaskForm = lazy(() => import("@/components/task-form").then(m => ({ default: m.TaskForm })));
const SaveSmartViewDialog = lazy(() => import("@/components/save-smart-view-dialog").then(m => ({ default: m.SaveSmartViewDialog })));

interface DialogState {
  mode: "create" | "edit";
  task?: TaskRecord;
}

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
    notifyBefore: task.notifyBefore,
    notificationEnabled: task.notificationEnabled
  };
}

export function MatrixBoard() {
  const { all } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [saveSmartViewOpen, setSaveSmartViewOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [pendingImportContents, setPendingImportContents] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();

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
      setDialogState({ mode: "create" });
      // Clean up URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Configure sensors for drag-and-drop (mouse + touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DND_CONFIG.POINTER_DISTANCE
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: DND_CONFIG.TOUCH_DELAY,
        tolerance: DND_CONFIG.TOUCH_TOLERANCE
      }
    })
  );

  // Extract all unique tags from tasks
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    all.forEach(task => task.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [all]);

  const filteredQuadrants = useMemo(() => {
    // First apply advanced filters, including completed status
    const criteriaWithSearch: FilterCriteria = {
      ...filterCriteria,
      searchQuery: searchQuery.trim() || undefined,
      status: showCompleted ? 'all' : 'active'
    };
    const filtered = applyFilters(all, criteriaWithSearch);

    // Group filtered tasks by quadrant
    return Object.fromEntries(
      quadrantOrder.map((id) => [id, filtered.filter(task => task.quadrant === id)])
    );
  }, [all, filterCriteria, searchQuery, showCompleted]);

  const visibleCount = useMemo(
    () => quadrantOrder.reduce((total, id) => total + (filteredQuadrants[id]?.length ?? 0), 0),
    [filteredQuadrants]
  );

  const closeDialog = () => setDialogState(null);

  const handleSubmit = async (draft: TaskDraft) => {
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
  };

  const handleDelete = async (task: TaskRecord) => {
    try {
      // Store task data for undo
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
      setPendingImportContents(contents);
      setImportDialogOpen(true);
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
    setPendingImportContents(null);
    showToast("Tasks imported successfully", undefined, TOAST_DURATION.SHORT);
  };

  const handleSelectSmartView = (criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
    setSearchQuery(""); // Clear search when selecting a Smart View
  };

  const handleSaveSmartView = () => {
    setSaveSmartViewOpen(true);
  };

  const handleSmartViewSaved = () => {
    showToast("Smart View saved successfully", undefined, TOAST_DURATION.SHORT);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const taskId = active.id as string;
    const targetQuadrant = over.id as QuadrantId;

    try {
      await moveTaskToQuadrant(taskId, targetQuadrant);
    } catch (error) {
      handleError(error, {
        action: ErrorActions.MOVE_TASK,
        taskId,
        userMessage: ErrorMessages.TASK_MOVE_FAILED,
        timestamp: new Date().toISOString(),
        metadata: { targetQuadrant }
      });
    }
  };

  // Handle keyboard shortcuts
  useKeyboardShortcuts(
    {
      onNewTask: () => setDialogState({ mode: "create" }),
      onSearch: () => searchInputRef.current?.focus(),
      onHelp: () => setHelpOpen(true)
    },
    searchInputRef
  );

  const taskBeingEdited = dialogState?.mode === "edit" ? dialogState.task : undefined;
  const activeTaskDraft = taskBeingEdited ? toDraft(taskBeingEdited) : undefined;

  const hasTasks = all.length > 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        <NotificationPermissionPrompt />

        <AppHeader
          onNewTask={() => setDialogState({ mode: "create" })}
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          onExport={handleExport}
          onImport={handleImport}
          searchInputRef={searchInputRef}
          onHelp={() => setHelpOpen(true)}
          isLoading={isLoading}
          onSelectSmartView={handleSelectSmartView}
          onOpenFilters={() => setFilterPopoverOpen(true)}
          currentFilterCriteria={filterCriteria}
          showCompleted={showCompleted}
          onToggleCompleted={() => setShowCompleted(!showCompleted)}
          onOpenNotifications={() => setNotificationSettingsOpen(true)}
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
          onClick={() => setDialogState({ mode: "create" })}
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
            <MatrixEmptyState onCreateTask={() => setDialogState({ mode: "create" })} />
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
                  onEdit={(task) => setDialogState({ mode: "edit", task })}
                  onDelete={handleDelete}
                  onToggleComplete={handleComplete}
                />
              ))}
            </div>
          )}
        </main>

        <AppFooter />

        {/* Lazy-loaded dialogs with Suspense fallback */}
        {helpOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
          </Suspense>
        )}

        {importDialogOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <ImportDialog
              open={importDialogOpen}
              onOpenChange={setImportDialogOpen}
              fileContents={pendingImportContents}
              existingTaskCount={all.length}
              onImportComplete={handleImportComplete}
            />
          </Suspense>
        )}

        {saveSmartViewOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <SaveSmartViewDialog
              open={saveSmartViewOpen}
              onOpenChange={setSaveSmartViewOpen}
              criteria={filterCriteria}
              onSaved={handleSmartViewSaved}
            />
          </Suspense>
        )}

        <FilterPopover
          open={filterPopoverOpen}
          onOpenChange={setFilterPopoverOpen}
          criteria={filterCriteria}
          onChange={setFilterCriteria}
          onSaveAsSmartView={handleSaveSmartView}
          availableTags={availableTags}
        />

        <NotificationSettingsDialog
          open={notificationSettingsOpen}
          onOpenChange={setNotificationSettingsOpen}
        />

        <Dialog open={dialogState !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogState?.mode === "edit" ? "Edit task" : "Create task"}</DialogTitle>
            </DialogHeader>
            {dialogState !== null && (
              <Suspense fallback={<div className="flex items-center justify-center p-8"><Spinner /></div>}>
                <TaskForm
                  initialValues={activeTaskDraft}
                  onSubmit={handleSubmit}
                  onCancel={closeDialog}
                  onDelete={taskBeingEdited ? () => handleDelete(taskBeingEdited) : undefined}
                  submitLabel={dialogState?.mode === "edit" ? "Update task" : "Add task"}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
