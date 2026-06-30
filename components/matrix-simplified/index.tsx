"use client";

import { useReducer, useRef, useState, useSyncExternalStore } from "react";
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
import { SHOW_COMPLETED_EVENT, readShowCompleted } from "@/lib/preferences/show-completed";
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

/**
 * Client-only hydration gate. Returns `false` during the server render / first
 * client paint and `true` once mounted, without a setState-in-effect. The store
 * never changes, so `subscribe` is a no-op; the snapshot pair drives the gate.
 */
const noopSubscribe = () => () => {};
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Reads the "show completed" preference from localStorage and stays in sync with
 * the `SHOW_COMPLETED_EVENT` broadcast (fired when the toggle changes elsewhere).
 * Implemented as an external store so there is no setState-in-effect for either
 * the initial read or subsequent updates. Server snapshot is `false` to match the
 * static-export first paint and avoid a hydration mismatch.
 */
function subscribeShowCompleted(onChange: () => void) {
  window.addEventListener(SHOW_COMPLETED_EVENT, onChange);
  return () => window.removeEventListener(SHOW_COMPLETED_EVENT, onChange);
}
function useShowCompleted(): boolean {
  return useSyncExternalStore(subscribeShowCompleted, readShowCompleted, () => false);
}

/**
 * Overlay state for the matrix shell. The edit drawer, create drawer, and share
 * dialog are one cohesive concern ("which overlay is open, and with what data"),
 * mutated together across handlers — so they live in a single reducer instead of
 * five independent useState calls.
 */
type OverlayState = {
  editingTask: TaskRecord | null;
  createDrawerOpen: boolean;
  createInitial: Partial<EditDraft> | undefined;
  sharingTask: TaskRecord | null;
};

type OverlayAction =
  | { type: "openEdit"; task: TaskRecord }
  | { type: "closeEdit" }
  | { type: "openCreate"; initial: Partial<EditDraft> | undefined }
  | { type: "closeCreate" }
  | { type: "openShare"; task: TaskRecord }
  | { type: "closeShare" };

const initialOverlayState: OverlayState = {
  editingTask: null,
  createDrawerOpen: false,
  createInitial: undefined,
  sharingTask: null,
};

function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case "openEdit":
      return { ...state, editingTask: action.task };
    case "closeEdit":
      return { ...state, editingTask: null };
    case "openCreate":
      return { ...state, createDrawerOpen: true, createInitial: action.initial };
    case "closeCreate":
      return { ...state, createDrawerOpen: false, createInitial: undefined };
    case "openShare":
      return { ...state, sharingTask: action.task };
    case "closeShare":
      return { ...state, sharingTask: null };
  }
}

// Pure capture/toggle handlers — they close over no component state, so they
// live at module scope (stable identity for memoized children).
async function handleCapture({ title, urgent, important, tags }: CapturePayload): Promise<void> {
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
}

async function handleToggle(task: TaskRecord, completedNext: boolean): Promise<void> {
  try {
    await toggleCompleted(task.id, completedNext);
    if (completedNext) celebrateCompletion();
  } catch {
    toast.error("Failed to update task", { duration: TOAST_DURATION.LONG });
  }
}

export function MatrixSimplified() {
  const { all } = useTasks();
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();
  const { sensors, activeId, handleDragStart, handleDragEnd } = useDragAndDrop(handleError);

  useAutoArchive();
  useNotificationChecker();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const [overlay, dispatchOverlay] = useReducer(overlayReducer, initialOverlayState);
  const { editingTask, createDrawerOpen, createInitial, sharingTask } = overlay;
  const mounted = useIsHydrated();
  const showCompleted = useShowCompleted();

  const clearSearch = () => setSearchQuery("");
  const { smartViewsEnabled, smartViews, activeSmartView, applySmartViewById, clearSmartView } =
    useSmartViews(clearSearch);

  const { visibleTasks, total, completed, overdue } = deriveMatrixView({
    all,
    showCompleted,
    smartViewsEnabled,
    activeSmartView,
    searchQuery,
  });

  const { highlightedTaskId, handleTaskRef, highlightTaskById } = useTaskHighlight(
    visibleTasks,
    clearSearch
  );

  const handleAddInQuadrant = (key: RedesignQuadrantKey) => {
    const meta = quadrantByRdKey(key);
    dispatchOverlay({
      type: "openCreate",
      initial: { title: "", urgent: meta.urgent, important: meta.important, tags: [] },
    });
  };

  const handleDelete = async (task: TaskRecord) => {
    try {
      await deleteTask(task.id);
      // Faithful undo: restore the exact original record (id/timestamps intact).
      handleSuccess("Task deleted", () => restoreTask(task));
    } catch {
      toast.error("Failed to delete task", { duration: TOAST_DURATION.LONG });
    }
  };

  const handleEditOpen = (task: TaskRecord) => dispatchOverlay({ type: "openEdit", task });
  const handleEditClose = () => dispatchOverlay({ type: "closeEdit" });
  const handleShareOpen = (task: TaskRecord) => dispatchOverlay({ type: "openShare", task });
  const handleShareOpenChange = (next: boolean) => {
    if (!next) dispatchOverlay({ type: "closeShare" });
  };

  const handleOpenCreateDrawer = (payload?: CapturePayload) => {
    if (payload) {
      const { cleanTitle, urls } = extractUrlsFromTitle(payload.title);
      dispatchOverlay({
        type: "openCreate",
        initial: {
          title: cleanTitle,
          description: buildDescription("", urls),
          urgent: payload.urgent,
          important: payload.important,
          tags: payload.tags,
        },
      });
    } else {
      dispatchOverlay({ type: "openCreate", initial: undefined });
    }
  };

  useMatrixWindowEvents({
    searchInputRef,
    captureInputRef,
    openCreateDrawer: handleOpenCreateDrawer,
    highlightTaskById,
    applySmartViewById,
  });

  const handleCreateClose = () => dispatchOverlay({ type: "closeCreate" });

  const handleEditSubmit = async (draft: EditDraft, taskId?: string) => {
    try {
      if (taskId) {
        await updateTask(taskId, draft);
        toast.success("Task updated", { duration: TOAST_DURATION.SHORT });
        dispatchOverlay({ type: "closeEdit" });
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
        dispatchOverlay({ type: "closeCreate" });
      }
    } catch {
      toast.error("Failed to save task", { duration: TOAST_DURATION.LONG });
    }
  };

  const activeDragTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  // Header counts — three small inline pills, semantic colors. Overdue
  // pill is conditional on count > 0. Sits on the same baseline as the title
  // (the topbar wraps the caption slot in a flex row).
  const caption = (
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
