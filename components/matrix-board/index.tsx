"use client";

import { useMemo, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { FilterBar } from "@/components/filter-bar";
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt";
import { CommandPalette } from "@/components/command-palette";
import { quadrants } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { useSmartViewShortcuts } from "@/lib/use-smart-view-shortcuts";
import type { FilterCriteria, SmartView } from "@/lib/filters";
import { toDraft } from "@/lib/types";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { extractAvailableTags, getFilteredQuadrants, getVisibleTaskCount } from "@/lib/matrix-filters";
import { useMatrixDialogs } from "@/lib/use-matrix-dialogs";
import { TOAST_DURATION } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useBulkSelection } from "./use-bulk-selection";
import { useTaskOperations } from "./use-task-operations";
import { useCommandHandlers } from "./use-command-handlers";
import { MatrixDialogs } from "./matrix-dialogs";
import { MatrixContent } from "./matrix-content";
import { TaskDragOverlay } from "./task-drag-overlay";
import {
  usePinnedSmartViews,
  useToggleCompletedListener,
  useTaskHighlighting,
  useNotificationChecker,
  usePwaNewTaskShortcut,
  useUrlHighlightParam,
  useSmartViewHandlers,
} from "./use-event-handlers";

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
  const { sensors, activeId, handleDragStart, handleDragEnd } = useDragAndDrop(handleError);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const taskRefs = useRef<Map<string, HTMLElement>>(new Map());

  const bulkSelection = useBulkSelection(all, () => dialogs.setBulkTagDialogOpen(true));
  const taskOps = useTaskOperations(
    dialogs.dialogState,
    dialogs.closeDialog,
    showCompleted,
    all,
    bulkSelection.selectedTaskIds,
    bulkSelection.handleClearSelection
  );

  const { commandHandlers, isSyncEnabled, handleImport, handleImportComplete } = useCommandHandlers({
    openCreateDialog: () => dialogs.setDialogState({ mode: "create" }),
    openSettingsDialog: () => dialogs.setSettingsOpen(false),
    openHelpDialog: () => dialogs.setHelpOpen(true),
    openImportDialog: (contents) => {
      dialogs.setPendingImportContents(contents);
      dialogs.setImportDialogOpen(true);
    },
    selectionMode: bulkSelection.selectionMode,
    hasSelection: bulkSelection.selectedTaskIds.size > 0,
    onToggleSelectionMode: bulkSelection.handleToggleSelectionMode,
    onClearSelection: bulkSelection.handleClearSelection,
    onSelectSmartView: (criteria) => {
      setFilterCriteria(criteria);
      setSearchQuery("");
    },
    onSetActiveSmartViewId: setActiveSmartViewId,
  });

  // Background hooks
  useAutoArchive();
  usePinnedSmartViews(setPinnedSmartViews);
  useToggleCompletedListener(setShowCompleted);
  useTaskHighlighting(setHighlightedTaskId, { taskRefs });
  useNotificationChecker();
  usePwaNewTaskShortcut((state) => dialogs.setDialogState(state));
  useUrlHighlightParam(all.length, setHighlightedTaskId, { taskRefs });

  const { handleSelectSmartView, handleClearSmartView } = useSmartViewHandlers(
    setFilterCriteria, setSearchQuery, setActiveSmartViewId
  );

  useSmartViewShortcuts({
    views: pinnedSmartViews,
    onSelectView: handleSelectSmartView,
    onClearView: handleClearSmartView,
    onActiveViewChange: setActiveSmartViewId
  });

  useKeyboardShortcuts(
    {
      onNewTask: () => dialogs.setDialogState({ mode: "create" }),
      onSearch: () => searchInputRef.current?.focus(),
      onHelp: () => dialogs.setHelpOpen(true)
    },
    searchInputRef
  );

  // Derived state
  const availableTags = useMemo(() => extractAvailableTags(all), [all]);
  const filteredQuadrants = useMemo(
    () => getFilteredQuadrants(all, filterCriteria, searchQuery, showCompleted),
    [all, filterCriteria, searchQuery, showCompleted]
  );
  const visibleCount = getVisibleTaskCount(filteredQuadrants);
  const isDoFirstEmpty = (filteredQuadrants["urgent-important"] ?? []).length === 0;
  const hasTasks = all.length > 0;
  const taskBeingEdited = dialogs.dialogState?.mode === "edit" ? dialogs.dialogState.task : undefined;
  const activeTaskDraft = taskBeingEdited ? toDraft(taskBeingEdited) : undefined;
  const activeDragTask = activeId ? all.find(t => t.id === activeId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
          isDoFirstEmpty={hasTasks && isDoFirstEmpty}
        />

        {hasTasks && (
          <div className="px-6">
            <FilterBar criteria={filterCriteria} onChange={setFilterCriteria} />
          </div>
        )}

        <MatrixContent
          hasTasks={hasTasks}
          isDoFirstEmpty={isDoFirstEmpty}
          visibleCount={visibleCount}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery("")}
          onCreateTask={() => dialogs.setDialogState({ mode: "create" })}
          filteredQuadrants={filteredQuadrants}
          allTasks={all}
          onEdit={(task) => dialogs.setDialogState({ mode: "edit", task })}
          onDelete={taskOps.handleDelete}
          onToggleComplete={taskOps.handleComplete}
          onShare={dialogs.openShareDialog}
          onDuplicate={taskOps.handleDuplicate}
          onSnooze={taskOps.handleSnooze}
          onStartTimer={taskOps.handleStartTimer}
          onStopTimer={taskOps.handleStopTimer}
          selectionMode={bulkSelection.selectionMode}
          selectedTaskIds={bulkSelection.selectedTaskIds}
          onToggleSelect={bulkSelection.handleToggleSelect}
          taskRefs={taskRefs}
          highlightedTaskId={highlightedTaskId}
        />

        <AppFooter />

        <MatrixDialogs
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
          taskToShare={dialogs.taskToShare}
          shareTaskDialogOpen={dialogs.shareTaskDialogOpen}
          setShareTaskDialogOpen={dialogs.setShareTaskDialogOpen}
          helpOpen={dialogs.helpOpen}
          setHelpOpen={dialogs.setHelpOpen}
          importDialogOpen={dialogs.importDialogOpen}
          setImportDialogOpen={dialogs.setImportDialogOpen}
          pendingImportContents={dialogs.pendingImportContents}
          existingTaskCount={all.length}
          onImportComplete={handleImportComplete}
          saveSmartViewOpen={dialogs.saveSmartViewOpen}
          setSaveSmartViewOpen={dialogs.setSaveSmartViewOpen}
          filterCriteria={filterCriteria}
          onSmartViewSaved={() => showToast("Smart View saved successfully", undefined, TOAST_DURATION.SHORT)}
          filterPopoverOpen={dialogs.filterPopoverOpen}
          setFilterPopoverOpen={dialogs.setFilterPopoverOpen}
          onFilterChange={setFilterCriteria}
          onSaveAsSmartView={() => dialogs.setSaveSmartViewOpen(true)}
          availableTags={availableTags}
          settingsOpen={dialogs.settingsOpen}
          setSettingsOpen={dialogs.setSettingsOpen}
          showCompleted={showCompleted}
          onToggleCompleted={() => setShowCompleted(!showCompleted)}
          onExport={taskOps.handleExport}
          onImport={handleImport}
          isLoading={taskOps.isLoading}
          dialogState={dialogs.dialogState}
          closeDialog={dialogs.closeDialog}
          taskBeingEdited={taskBeingEdited}
          activeTaskDraft={activeTaskDraft}
          onSubmit={taskOps.handleSubmit}
          onDelete={taskOps.handleDelete}
        />
      </div>

      <TaskDragOverlay activeTask={activeDragTask} />
    </DndContext>
  );
}
