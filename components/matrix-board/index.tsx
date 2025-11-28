"use client";

import { useMemo, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { MatrixEmptyState } from "@/components/matrix-empty-state";
import { AppFooter } from "@/components/app-footer";
import { FilterBar } from "@/components/filter-bar";
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt";
import { Button } from "@/components/ui/button";
import { quadrants } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { useSmartViewShortcuts } from "@/lib/use-smart-view-shortcuts";
import type { FilterCriteria } from "@/lib/filters";
import type { SmartView } from "@/lib/filters";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { extractAvailableTags, getFilteredQuadrants, getVisibleTaskCount } from "@/lib/matrix-filters";
import { useMatrixDialogs } from "@/lib/use-matrix-dialogs";
import { TOAST_DURATION } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useBulkSelection } from "./use-bulk-selection";
import { useTaskOperations } from "./use-task-operations";
import { useSync } from "@/lib/hooks/use-sync";
import { exportTasks } from "@/lib/tasks";
import type { CommandActionHandlers } from "@/lib/command-actions";

import { CommandPalette } from "@/components/command-palette";
import { MatrixDialogs } from "./matrix-dialogs";
import {
  usePinnedSmartViews,
  useToggleCompletedListener,
  useTaskHighlighting,
  useNotificationChecker,
  usePwaNewTaskShortcut,
  useUrlHighlightParam,
  useSmartViewHandlers,
} from "./use-event-handlers";

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
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [activeSmartViewId, setActiveSmartViewId] = useState<string | null>(null);
  const [pinnedSmartViews, setPinnedSmartViews] = useState<SmartView[]>([]);
  const dialogs = useMatrixDialogs();
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();
  const { sensors, handleDragEnd } = useDragAndDrop(handleError);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const taskRefs = useRef<Map<string, HTMLElement>>(new Map());
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { isEnabled: isSyncEnabled } = useSync();

  // Use custom hooks for bulk selection and task operations
  const bulkSelection = useBulkSelection(all, () => dialogs.setBulkTagDialogOpen(true));
  const taskOps = useTaskOperations(
    dialogs.dialogState,
    dialogs.closeDialog,
    showCompleted,
    all,
    bulkSelection.selectedTaskIds,
    bulkSelection.handleClearSelection
  );

  // Enable auto-archive background task
  useAutoArchive();

  // Use extracted event handler hooks
  usePinnedSmartViews(setPinnedSmartViews);
  useToggleCompletedListener(setShowCompleted);
  useTaskHighlighting(setHighlightedTaskId, { taskRefs });
  useNotificationChecker();
  usePwaNewTaskShortcut((state) => dialogs.setDialogState(state));
  useUrlHighlightParam(all.length, setHighlightedTaskId, { taskRefs });

  // Smart view handlers
  const { handleSelectSmartView, handleClearSmartView } = useSmartViewHandlers(
    setFilterCriteria,
    setSearchQuery,
    setActiveSmartViewId
  );

  // Extract all unique tags from tasks
  const availableTags = useMemo(() => extractAvailableTags(all), [all]);

  // Filter and group tasks by quadrant
  const filteredQuadrants = useMemo(
    () => getFilteredQuadrants(all, filterCriteria, searchQuery, showCompleted),
    [all, filterCriteria, searchQuery, showCompleted]
  );

  // Calculate total visible task count
  const visibleCount = getVisibleTaskCount(filteredQuadrants);

  const handleSaveSmartView = () => {
    dialogs.setSaveSmartViewOpen(true);
  };

  const handleSmartViewSaved = () => {
    showToast("Smart View saved successfully", undefined, TOAST_DURATION.SHORT);
  };

  // Smart view keyboard shortcuts (1-9 to select, 0 to clear)
  useSmartViewShortcuts({
    views: pinnedSmartViews,
    onSelectView: handleSelectSmartView,
    onClearView: handleClearSmartView,
    onActiveViewChange: setActiveSmartViewId
  });

  // Command palette handlers
  const commandHandlers: CommandActionHandlers = {
    onNewTask: () => dialogs.setDialogState({ mode: "create" }),
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    onExportTasks: async () => {
      await exportTasks();
      showToast("Tasks exported successfully", undefined, TOAST_DURATION.SHORT);
    },
    onImportTasks: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) await handleImport(file);
      };
      input.click();
    },
    onOpenSettings: () => dialogs.setSettingsOpen(true),
    onOpenHelp: () => dialogs.setHelpOpen(true),
    onViewDashboard: () => router.push("/dashboard"),
    onViewMatrix: () => router.push("/"),
    onViewArchive: () => router.push("/archive"),
    onViewSyncHistory: isSyncEnabled ? () => router.push("/sync-history") : undefined,
    onApplySmartView: (criteria, viewId) => {
      handleSelectSmartView(criteria);
      setActiveSmartViewId(viewId);
    },
    onTriggerSync: isSyncEnabled ? async () => {
      const { getSyncCoordinator } = await import('@/lib/sync/sync-coordinator');
      const coordinator = getSyncCoordinator();
      await coordinator.requestSync('user');
      showToast("Sync triggered", undefined, TOAST_DURATION.SHORT);
    } : undefined,
    onToggleSelectionMode: bulkSelection.handleToggleSelectionMode,
    onClearSelection: bulkSelection.handleClearSelection
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
      {/* Command Palette - Global ⌘K shortcut */}
      <CommandPalette
        handlers={commandHandlers}
        conditions={{
          isSyncEnabled,
          selectionMode: bulkSelection.selectionMode,
          hasSelection: bulkSelection.selectedTaskIds.size > 0
        }}
      />

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
          activeSmartViewId={activeSmartViewId}
          onActiveViewChange={setActiveSmartViewId}
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
                  onDuplicate={taskOps.handleDuplicate}
                  selectionMode={bulkSelection.selectionMode}
                  selectedTaskIds={bulkSelection.selectedTaskIds}
                  onToggleSelect={bulkSelection.handleToggleSelect}
                  taskRefs={taskRefs}
                  highlightedTaskId={highlightedTaskId}
                />
              ))}
            </div>
          )}
        </main>

        <AppFooter />

        {/* All dialogs extracted to separate component */}
        <MatrixDialogs
          // Bulk actions
          bulkTagDialogOpen={dialogs.bulkTagDialogOpen}
          setBulkTagDialogOpen={dialogs.setBulkTagDialogOpen}
          selectedCount={bulkSelection.selectedTaskIds.size}
          onBulkAddTagsConfirm={taskOps.handleBulkAddTagsConfirm}
          onClearSelection={bulkSelection.handleClearSelection}
          onBulkDelete={bulkSelection.handleBulkDelete}
          onBulkComplete={bulkSelection.handleBulkComplete}
          onBulkUncomplete={bulkSelection.handleBulkUncomplete}
          onBulkMoveToQuadrant={bulkSelection.handleBulkMoveToQuadrant}
          onBulkAddTags={bulkSelection.handleBulkAddTags}
          // Share dialog
          taskToShare={dialogs.taskToShare}
          shareTaskDialogOpen={dialogs.shareTaskDialogOpen}
          setShareTaskDialogOpen={dialogs.setShareTaskDialogOpen}
          // Help dialog
          helpOpen={dialogs.helpOpen}
          setHelpOpen={dialogs.setHelpOpen}
          // Import dialog
          importDialogOpen={dialogs.importDialogOpen}
          setImportDialogOpen={dialogs.setImportDialogOpen}
          pendingImportContents={dialogs.pendingImportContents}
          existingTaskCount={all.length}
          onImportComplete={handleImportComplete}
          // Save smart view dialog
          saveSmartViewOpen={dialogs.saveSmartViewOpen}
          setSaveSmartViewOpen={dialogs.setSaveSmartViewOpen}
          filterCriteria={filterCriteria}
          onSmartViewSaved={handleSmartViewSaved}
          // Filter popover
          filterPopoverOpen={dialogs.filterPopoverOpen}
          setFilterPopoverOpen={dialogs.setFilterPopoverOpen}
          onFilterChange={setFilterCriteria}
          onSaveAsSmartView={handleSaveSmartView}
          availableTags={availableTags}
          // Settings dialog
          settingsOpen={dialogs.settingsOpen}
          setSettingsOpen={dialogs.setSettingsOpen}
          showCompleted={showCompleted}
          onToggleCompleted={() => setShowCompleted(!showCompleted)}
          onExport={taskOps.handleExport}
          onImport={handleImport}
          isLoading={taskOps.isLoading}
          // Task form dialog
          dialogState={dialogs.dialogState}
          closeDialog={dialogs.closeDialog}
          taskBeingEdited={taskBeingEdited}
          activeTaskDraft={activeTaskDraft}
          onSubmit={taskOps.handleSubmit}
          onDelete={taskOps.handleDelete}
        />
      </div>
    </DndContext>
  );
}
