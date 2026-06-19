"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask, deleteTask, restoreTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
import { toast } from "sonner";
import { useTasks } from "@/lib/use-tasks";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/lib/use-notification-checker";
import { TOAST_DURATION } from "@/lib/constants";
import {
  SHOW_COMPLETED_EVENT,
  type ShowCompletedEventDetail,
  readShowCompleted,
} from "@/lib/preferences/show-completed";
import type { TaskRecord } from "@/lib/types";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { TaskCard } from "@/components/task-card";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import { AppShell } from "./app-shell";
import { CaptureBar, type CapturePayload } from "./capture-bar";
import { MatrixGrid } from "./matrix-grid";
import { EditDrawer, type EditDraft } from "./edit-drawer";
import { SmartViewStrip } from "./smart-view-strip";
import { deriveMatrixView } from "./matrix-view";
import { useSmartViews } from "./use-smart-views";
import { useTaskHighlight } from "./use-task-highlight";
import { useMatrixWindowEvents } from "./use-matrix-window-events";

export function MatrixSimplified() {
  const { all } = useTasks();
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();
  const { sensors, activeId, handleDragStart, handleDragEnd } = useDragAndDrop(handleError);

  useAutoArchive();
  useNotificationChecker();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<Partial<EditDraft> | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sharingTask, setSharingTask] = useState<TaskRecord | null>(null);

  const clearSearch = useCallback(() => setSearchQuery(""), []);
  const { smartViewsEnabled, smartViews, activeSmartView, applySmartViewById, clearSmartView } =
    useSmartViews(clearSearch);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- canonical SSR-safe pattern for static export
    setShowCompleted(readShowCompleted());
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ShowCompletedEventDetail>).detail;
      setShowCompleted(Boolean(detail?.show));
    };
    window.addEventListener(SHOW_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(SHOW_COMPLETED_EVENT, handler);
  }, []);

  const { visibleTasks, total, completed, overdue } = useMemo(
    () => deriveMatrixView({ all, showCompleted, smartViewsEnabled, activeSmartView, searchQuery }),
    [activeSmartView, all, showCompleted, smartViewsEnabled, searchQuery]
  );

  const { highlightedTaskId, handleTaskRef, highlightTaskById } = useTaskHighlight(
    visibleTasks,
    clearSearch
  );

  const handleCapture = useCallback(
    async ({ title, urgent, important, tags }: CapturePayload) => {
      try {
        const { cleanTitle, urls } = extractUrlsFromTitle(title);
        await createTask({
          title: cleanTitle,
          description: buildDescription("", urls),
          urgent,
          important,
          tags: tags.length > 0 ? tags : undefined,
        });
        toast.success("Task added", { duration: TOAST_DURATION.SHORT });
      } catch {
        toast.error("Failed to create task", { duration: TOAST_DURATION.LONG });
      }
    },
    []
  );

  const handleAddInQuadrant = useCallback((key: RedesignQuadrantKey) => {
    const meta = quadrantByRdKey(key);
    setCreateInitial({
      title: "",
      urgent: meta.urgent,
      important: meta.important,
      tags: [],
    });
    setCreateDrawerOpen(true);
  }, []);

  const handleToggle = useCallback(
    async (task: TaskRecord, completedNext: boolean) => {
      try {
        await toggleCompleted(task.id, completedNext);
        if (completedNext) celebrateCompletion();
      } catch {
        toast.error("Failed to update task", { duration: TOAST_DURATION.LONG });
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (task: TaskRecord) => {
      try {
        await deleteTask(task.id);
        // Faithful undo: restore the exact original record (id/timestamps intact).
        handleSuccess("Task deleted", () => restoreTask(task));
      } catch {
        toast.error("Failed to delete task", { duration: TOAST_DURATION.LONG });
      }
    },
    [handleSuccess]
  );

  const handleEditOpen = useCallback((task: TaskRecord) => setEditingTask(task), []);
  const handleEditClose = useCallback(() => setEditingTask(null), []);
  const handleShareOpen = useCallback((task: TaskRecord) => setSharingTask(task), []);
  const handleShareOpenChange = useCallback((next: boolean) => {
    if (!next) setSharingTask(null);
  }, []);

  const handleOpenCreateDrawer = useCallback((payload?: CapturePayload) => {
    if (payload) {
      const { cleanTitle, urls } = extractUrlsFromTitle(payload.title);
      setCreateInitial({
        title: cleanTitle,
        description: buildDescription("", urls),
        urgent: payload.urgent,
        important: payload.important,
        tags: payload.tags,
      });
    } else {
      setCreateInitial(undefined);
    }
    setCreateDrawerOpen(true);
  }, []);

  useMatrixWindowEvents({
    searchInputRef,
    captureInputRef,
    openCreateDrawer: handleOpenCreateDrawer,
    highlightTaskById,
    applySmartViewById,
  });

  const handleCreateClose = useCallback(() => {
    setCreateDrawerOpen(false);
    setCreateInitial(undefined);
  }, []);

  const handleEditSubmit = useCallback(
    async (draft: EditDraft, taskId?: string) => {
      try {
        if (taskId) {
          await updateTask(taskId, draft);
          toast.success("Task updated", { duration: TOAST_DURATION.SHORT });
          setEditingTask(null);
        } else {
          const { cleanTitle, urls } = extractUrlsFromTitle(draft.title);
          await createTask({
            title: cleanTitle,
            description: buildDescription(draft.description, urls),
            urgent: draft.urgent,
            important: draft.important,
            dueDate: draft.dueDate,
            tags: draft.tags.length > 0 ? draft.tags : undefined,
          });
          toast.success("Task added", { duration: TOAST_DURATION.SHORT });
          setCreateDrawerOpen(false);
          setCreateInitial(undefined);
        }
      } catch {
        toast.error("Failed to save task", { duration: TOAST_DURATION.LONG });
      }
    },
    []
  );

  const activeDragTask = useMemo(
    () => (activeId ? all.find((t) => t.id === activeId) ?? null : null),
    [activeId, all]
  );

  // Header counts — three small inline pills, semantic colors. Overdue
  // pill is conditional on count > 0. Sits on the same baseline as the title
  // (the topbar wraps the caption slot in a flex row).
  const caption = useMemo(
    () => (
      <>
        <span className="inline-flex items-center rounded-full bg-background-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground">
          {mounted ? `${total - completed} active` : " "}
        </span>
        <span className="inline-flex items-center rounded-full bg-status-success-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-success">
          {mounted ? `${completed} done` : " "}
        </span>
        {mounted && overdue > 0 ? (
          <span className="inline-flex items-center rounded-full bg-status-overdue-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-overdue">
            {overdue} overdue
          </span>
        ) : null}
      </>
    ),
    [completed, mounted, overdue, total]
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <AppShell
        title="GSD Matrix"
        caption={caption}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      >
        <div className="sticky top-[60px] z-10 -mx-4 mb-10 bg-background/85 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-9 sm:mb-12 sm:px-9 sm:py-4">
          <CaptureBar onSubmit={handleCapture} onMoreOptions={handleOpenCreateDrawer} inputRef={captureInputRef} />
          {smartViewsEnabled ? (
            <div className="mt-3">
              <SmartViewStrip
                views={smartViews}
                activeViewId={activeSmartView?.id}
                onSelectView={applySmartViewById}
                onClearView={clearSmartView}
              />
            </div>
          ) : null}
        </div>
        <MatrixGrid
          tasks={visibleTasks}
          allTasks={all}
          onEdit={handleEditOpen}
          onToggleComplete={handleToggle}
          onDelete={handleDelete}
          onShare={handleShareOpen}
          onAddInQuadrant={handleAddInQuadrant}
          highlightedTaskId={highlightedTaskId}
          onTaskRef={handleTaskRef}
        />
      </AppShell>

      <ShareTaskDialog
        task={sharingTask}
        open={Boolean(sharingTask)}
        onOpenChange={handleShareOpenChange}
      />

      <EditDrawer
        open={Boolean(editingTask)}
        task={editingTask}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
      />
      <EditDrawer
        open={createDrawerOpen}
        task={null}
        initialDraft={createInitial}
        onClose={handleCreateClose}
        onSubmit={handleEditSubmit}
      />

      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          <div style={{ cursor: "grabbing" }}>
            <TaskCard
              task={activeDragTask}
              allTasks={all}
              onEdit={() => {}}
              onDelete={() => {}}
              onToggleComplete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
