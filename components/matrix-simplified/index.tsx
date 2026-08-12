"use client";

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { DndContext, closestCorners } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask, deleteTask, restoreTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
import { toast } from "sonner";
import { useTasks } from "@/lib/use-tasks";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { ErrorActions, logError } from "@/lib/error-logger";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/lib/use-notification-checker";
import { TOAST_DURATION } from "@/lib/constants";
import { SHOW_COMPLETED_EVENT, readShowCompleted } from "@/lib/preferences/show-completed";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import { AppShell } from "./app-shell";
import { CaptureBar, type CapturePayload } from "./capture-bar";
import { DragLayer } from "./drag-layer";
import { MatrixGrid } from "./matrix-grid";
import { MatrixGridSkeleton } from "./matrix-grid-skeleton";
import { EditDrawer, type EditDraft } from "./edit-drawer";
import { SmartViewStrip } from "./smart-view-strip";
import { deriveMatrixView } from "./matrix-view";
import { useSmartViews } from "./use-smart-views";
import { useTaskHighlight } from "./use-task-highlight";
import { useMatrixWindowEvents } from "./use-matrix-window-events";
import { MatrixIntro } from "./matrix-intro";
import { deriveIntroStats, introDateLabel, introMessage } from "./intro-copy";
import { TaskDetailSheet } from "./task-detail-sheet";

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
  viewingTaskId: string | null;
  createDrawerOpen: boolean;
  createInitial: Partial<EditDraft> | undefined;
  sharingTask: TaskRecord | null;
};

type OverlayAction =
  | { type: "openEdit"; task: TaskRecord }
  | { type: "closeEdit" }
  | { type: "openInspect"; taskId: string }
  | { type: "closeInspect" }
  | { type: "openCreate"; initial: Partial<EditDraft> | undefined }
  | { type: "closeCreate" }
  | { type: "openShare"; task: TaskRecord }
  | { type: "closeShare" };

const initialOverlayState: OverlayState = {
  editingTask: null,
  viewingTaskId: null,
  createDrawerOpen: false,
  createInitial: undefined,
  sharingTask: null,
};

function reportTaskMutationError(
  error: unknown,
  action: string,
  userMessage: string,
  taskId?: string
): void {
  logError(error, {
    action,
    taskId,
    userMessage,
    timestamp: new Date().toISOString(),
  });
  toast.error(userMessage, { duration: TOAST_DURATION.LONG });
}

function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case "openEdit":
      return { ...state, editingTask: action.task };
    case "closeEdit":
      return { ...state, editingTask: null };
    case "openInspect":
      return { ...state, viewingTaskId: action.taskId };
    case "closeInspect":
      return { ...state, viewingTaskId: null };
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
  } catch (error) {
    reportTaskMutationError(error, ErrorActions.CREATE_TASK, "Failed to create task");
  }
}

async function handleToggle(task: TaskRecord, completedNext: boolean): Promise<void> {
  try {
    await toggleCompleted(task.id, completedNext);
    if (completedNext) celebrateCompletion();
  } catch (error) {
    reportTaskMutationError(
      error,
      ErrorActions.TOGGLE_TASK,
      "Failed to update task",
      task.id
    );
  }
}

export function MatrixSimplified() {
  const { all, isLoading } = useTasks();
  const { handleError, handleSuccess } = useErrorHandlerWithUndo();
  const { sensors, activeId, statusMessage, announcements, handleDragStart, handleDragEnd } =
    useDragAndDrop(handleError);

  useAutoArchive();
  useNotificationChecker();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const quadrantNodesRef = useRef<Partial<Record<RedesignQuadrantKey, HTMLElement>>>({});
  const pendingQuadrantRef = useRef<RedesignQuadrantKey | null>(null);

  const [overlay, dispatchOverlay] = useReducer(overlayReducer, initialOverlayState);
  const { editingTask, viewingTaskId, createDrawerOpen, createInitial, sharingTask } = overlay;
  const viewingTask = viewingTaskId
    ? all.find((task) => task.id === viewingTaskId) ?? null
    : null;
  const mounted = useIsHydrated();
  const showCompleted = useShowCompleted();

  useEffect(() => {
    if (viewingTaskId && !isLoading && !viewingTask) {
      // Reconcile an inspector whose backing task was deleted or removed by sync.
      dispatchOverlay({ type: "closeInspect" });
    }
  }, [isLoading, viewingTask, viewingTaskId]);

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

  const focusQuadrant = useCallback((key: RedesignQuadrantKey) => {
    const target = quadrantNodesRef.current[key];
    if (!target) {
      pendingQuadrantRef.current = key;
      return;
    }
    pendingQuadrantRef.current = null;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, []);

  const handleQuadrantRef = useCallback(
    (key: RedesignQuadrantKey, element: HTMLElement | null) => {
      if (element) quadrantNodesRef.current[key] = element;
      else delete quadrantNodesRef.current[key];
      if (element && pendingQuadrantRef.current === key) focusQuadrant(key);
    },
    [focusQuadrant]
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
    } catch (error) {
      reportTaskMutationError(
        error,
        ErrorActions.DELETE_TASK,
        "Failed to delete task",
        task.id
      );
    }
  };

  const handleEditOpen = (task: TaskRecord) => dispatchOverlay({ type: "openEdit", task });
  const handleEditClose = () => dispatchOverlay({ type: "closeEdit" });
  const handleInspectOpen = (task: TaskRecord) =>
    dispatchOverlay({ type: "openInspect", taskId: task.id });
  const handleInspectClose = () => dispatchOverlay({ type: "closeInspect" });
  const handleShareOpen = (task: TaskRecord) => dispatchOverlay({ type: "openShare", task });
  const handleShareOpenChange = (next: boolean) => {
    if (!next) dispatchOverlay({ type: "closeShare" });
  };

  const handleOpenCreateDrawer = (payload?: CapturePayload | TaskDraft) => {
    if (payload) {
      if ("description" in payload) {
        dispatchOverlay({
          type: "openCreate",
          initial: {
            title: payload.title,
            description: payload.description,
            urgent: payload.urgent,
            important: payload.important,
            tags: payload.tags ?? [],
          },
        });
        return;
      }

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
    focusQuadrant,
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
          dependencies: draft.dependencies.length > 0 ? draft.dependencies : undefined,
        });
        toast.success("Task added", { duration: TOAST_DURATION.SHORT });
        dispatchOverlay({ type: "closeCreate" });
      }
    } catch (error) {
      reportTaskMutationError(
        error,
        taskId ? ErrorActions.UPDATE_TASK : ErrorActions.CREATE_TASK,
        "Failed to save task",
        taskId
      );
    }
  };

  const activeDragTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;
  const activeScheduleCount = all.reduce(
    (count, task) => count + (!task.completed && !task.urgent && task.important ? 1 : 0),
    0
  );
  // Intro briefing: date + state reading render only after hydration so the
  // prerendered static export never bakes in a build-time date or an empty-board
  // message computed before IndexedDB has loaded.
  const introReady = mounted && !isLoading;
  const introStats = introReady
    ? deriveIntroStats(all, new Date().toISOString().slice(0, 10))
    : null;

  // Header counts — three small inline pills, semantic colors. Overdue
  // pill is conditional on count > 0. Sits on the same baseline as the title
  // (the topbar wraps the caption slot in a flex row).
  const caption = (
    <>
      <span className="inline-flex items-center rounded-full bg-background-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground">
        {mounted ? `${total - completed} active` : " "}
      </span>
      <span className="inline-flex items-center rounded-full bg-status-success-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-success-ink">
        {mounted ? `${completed} done` : " "}
      </span>
      {mounted && overdue > 0 ? (
        <span className="inline-flex items-center rounded-full bg-status-overdue-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-status-overdue-ink">
          {overdue} overdue
        </span>
    ) : null}
    </>
  );

  return (
    <DndContext
      sensors={sensors}
      // Cards and quadrant panes are both droppables. The default
      // rectIntersection favours whichever rect overlaps, which made pointer
      // drops depend on exactly where the cursor landed; closestCorners picks
      // the nearest target consistently and the handler resolves it either way.
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <AppShell
        title="GSD Matrix"
        titleAsLabel
        mainClassName="max-w-[1540px] pb-48 md:pb-6"
        caption={caption}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      >
        <MatrixIntro
          dateLabel={mounted ? introDateLabel(new Date()) : null}
          message={introStats ? introMessage(introStats) : null}
          scheduleCount={mounted && !isLoading ? activeScheduleCount : null}
          onFocusSchedule={() => focusQuadrant("q2")}
        />
        <div
          data-testid="mobile-capture-dock"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 bg-topbar py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:sticky md:bottom-auto md:left-auto md:right-auto md:top-[60px] md:-mx-9 md:mb-4 md:px-9 md:py-4"
        >
          <CaptureBar onSubmit={handleCapture} onMoreOptions={handleOpenCreateDrawer} inputRef={captureInputRef} />
        </div>
        {smartViewsEnabled ? (
          <div className="mb-4">
            <SmartViewStrip
              views={smartViews}
              activeViewId={activeSmartView?.id}
              onSelectView={applySmartViewById}
              onClearView={clearSmartView}
            />
          </div>
        ) : null}
        {isLoading ? (
          <MatrixGridSkeleton />
        ) : (
          <MatrixGrid
            tasks={visibleTasks}
            allTasks={all}
            onEdit={handleEditOpen}
            onInspect={handleInspectOpen}
            onToggleComplete={handleToggle}
            onDelete={handleDelete}
            onShare={handleShareOpen}
            onAddInQuadrant={handleAddInQuadrant}
            highlightedTaskId={highlightedTaskId}
            onTaskRef={handleTaskRef}
            onQuadrantRef={handleQuadrantRef}
          />
        )}
      </AppShell>

      <ShareTaskDialog
        task={sharingTask}
        open={Boolean(sharingTask)}
        onOpenChange={handleShareOpenChange}
      />

      <TaskDetailSheet
        open={Boolean(viewingTask)}
        task={viewingTask}
        allTasks={all}
        onClose={handleInspectClose}
        onEdit={handleEditOpen}
      />

      <EditDrawer
        open={Boolean(editingTask)}
        task={editingTask}
        allTasks={all}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
      />
      <EditDrawer
        open={createDrawerOpen}
        task={null}
        initialDraft={createInitial}
        allTasks={all}
        onClose={handleCreateClose}
        onSubmit={handleEditSubmit}
      />

      <DragLayer task={activeDragTask} statusMessage={statusMessage} />
    </DndContext>
  );
}
