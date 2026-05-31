"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask, deleteTask } from "@/lib/tasks";
import { celebrateCompletion } from "@/lib/confetti";
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
import { parseShareCaptureParams } from "@/lib/share-capture";
import { toast } from "sonner";
import { useTasks } from "@/lib/use-tasks";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/lib/use-notification-checker";
import { TOAST_DURATION } from "@/lib/constants";
import { applyFilters, type SmartView } from "@/lib/filters";
import {
  SHOW_COMPLETED_EVENT,
  type ShowCompletedEventDetail,
  readShowCompleted,
} from "@/lib/preferences/show-completed";
import {
  APPLY_SMART_VIEW_EVENT,
  HIGHLIGHT_TASK_EVENT,
  NEW_TASK_EVENT,
  type ApplySmartViewEventDetail,
} from "@/lib/use-shell-command-handlers";
import {
  APP_PREFERENCES_EVENT,
  getAppPreferences,
  getSmartView,
  getSmartViews,
  type AppPreferencesEventDetail,
} from "@/lib/smart-views";
import type { TaskRecord } from "@/lib/types";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { TaskCard } from "@/components/task-card";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import { AppShell } from "./app-shell";
import { CaptureBar, type CapturePayload } from "./capture-bar";
import { MatrixGrid } from "./matrix-grid";
import { EditDrawer, type EditDraft } from "./edit-drawer";
import { SmartViewStrip } from "./smart-view-strip";

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

function filterTasks(tasks: TaskRecord[], trimmedQuery: string): TaskRecord[] {
  if (!trimmedQuery) return tasks;
  const q = trimmedQuery.toLowerCase();
  return tasks.filter((t) => {
    const hay = [
      t.title,
      t.description ?? "",
      (t.tags ?? []).join(" "),
      (t.subtasks ?? []).map((s) => s.title).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function MatrixSimplified() {
  const { all } = useTasks();
  const { handleError } = useErrorHandlerWithUndo();
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
  const [smartViewsEnabled, setSmartViewsEnabled] = useState(false);
  const [smartViews, setSmartViews] = useState<SmartView[]>([]);
  const [activeSmartView, setActiveSmartView] = useState<SmartView | null>(null);
  const [sharingTask, setSharingTask] = useState<TaskRecord | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const taskRefs = useRef(new Map<string, HTMLElement>());
  const clearHighlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- canonical SSR-safe pattern for static export
    setShowCompleted(readShowCompleted());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSmartViewPreference = async () => {
      const preferences = await getAppPreferences();
      if (!cancelled) {
        setSmartViewsEnabled(preferences.smartViewsEnabled);
      }
    };

    loadSmartViewPreference().catch(() => {
      if (!cancelled) {
        setSmartViewsEnabled(false);
      }
    });

    const onPreferencesChange = (event: Event) => {
      const preferences = (event as CustomEvent<AppPreferencesEventDetail>).detail?.preferences;
      if (!preferences) return;
      setSmartViewsEnabled(preferences.smartViewsEnabled);
      if (!preferences.smartViewsEnabled) {
        setActiveSmartView(null);
      }
    };

    window.addEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    };
  }, []);

  useEffect(() => {
    if (!smartViewsEnabled) return;

    let cancelled = false;
    getSmartViews()
      .then((views) => {
        if (!cancelled) {
          setSmartViews(views);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSmartViews([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [smartViewsEnabled]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ShowCompletedEventDetail>).detail;
      setShowCompleted(Boolean(detail?.show));
    };
    window.addEventListener(SHOW_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(SHOW_COMPLETED_EVENT, handler);
  }, []);

  // URL-driven actions: PWA shortcut focuses the capture bar; bookmarklet
  // (`?action=capture&title=…&url=…&tags=…`) materializes a task in the
  // Eliminate quadrant. Both clean their params off the URL afterward.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (!action) return;

    if (action === "new-task") {
      setTimeout(() => captureInputRef.current?.focus(), 50);
    } else if (action === "capture") {
      const draft = parseShareCaptureParams(params);
      if (draft) {
        createTask(draft)
          .then(() => toast.success("Task captured", { duration: TOAST_DURATION.SHORT }))
          .catch(() => toast.error("Failed to capture task", { duration: TOAST_DURATION.LONG }));
      }
    } else {
      return;
    }

    ["action", "title", "url", "tags"].forEach((k) => params.delete(k));
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, []);

  // Global "/" focuses search; "n" handled by CaptureBar; "?" opens help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("gsd:open-help"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleTaskRef = useCallback((taskId: string, element: HTMLElement | null) => {
    if (element) {
      taskRefs.current.set(taskId, element);
    } else {
      taskRefs.current.delete(taskId);
    }
  }, []);

  const scrollTaskIntoView = useCallback((taskId: string) => {
    const node = taskRefs.current.get(taskId);
    if (!node) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    node.focus({ preventScroll: true });
  }, []);

  const highlightTaskById = useCallback((taskId: string) => {
    if (!taskId) return;

    setSearchQuery("");
    setHighlightedTaskId(taskId);

    if (clearHighlightTimerRef.current) {
      window.clearTimeout(clearHighlightTimerRef.current);
    }
    clearHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedTaskId((current) => (current === taskId ? null : current));
      clearHighlightTimerRef.current = null;
    }, 3500);
  }, []);

  const applySmartViewById = useCallback(async (viewId: string) => {
    const view = await getSmartView(viewId);
    if (!view) {
      toast.error("Smart view not found", { duration: TOAST_DURATION.SHORT });
      return;
    }
    setSearchQuery("");
    setActiveSmartView(view);
  }, []);

  const handleClearSmartView = useCallback(() => {
    setActiveSmartView(null);
  }, []);

  useEffect(() => {
    return () => {
      if (clearHighlightTimerRef.current) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
    };
  }, []);

  const trimmedSearchQuery = searchQuery.trim();
  const { visibleTasks, total, completed, overdue } = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    let completedCount = 0;
    let overdueCount = 0;
    const activeTasks: TaskRecord[] = [];

    for (const task of all) {
      if (task.completed) {
        completedCount += 1;
      } else {
        activeTasks.push(task);
        if (task.dueDate && task.dueDate < todayIso) {
          overdueCount += 1;
        }
      }
    }

    const effectiveSmartView = smartViewsEnabled ? activeSmartView : null;
    const base = effectiveSmartView ? all : showCompleted ? all : activeTasks;
    const smartViewTasks = effectiveSmartView
      ? applyFilters(base, effectiveSmartView.criteria, all)
      : base;
    return {
      visibleTasks: filterTasks(smartViewTasks, trimmedSearchQuery),
      total: all.length,
      completed: completedCount,
      overdue: overdueCount,
    };
  }, [activeSmartView, all, showCompleted, smartViewsEnabled, trimmedSearchQuery]);

  useEffect(() => {
    if (!highlightedTaskId) return;

    const frame = window.requestAnimationFrame(() => {
      scrollTaskIntoView(highlightedTaskId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedTaskId, scrollTaskIntoView, visibleTasks]);

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
      } catch {
        toast.error("Failed to delete task", { duration: TOAST_DURATION.LONG });
      }
    },
    []
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("highlight");
    const smartViewId = params.get("smartView");
    if (!taskId && !smartViewId) return;

    const frame = window.requestAnimationFrame(() => {
      if (taskId) {
        highlightTaskById(taskId);
      }
      if (smartViewId) {
        void applySmartViewById(smartViewId);
      }
    });
    params.delete("highlight");
    params.delete("smartView");
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    return () => window.cancelAnimationFrame(frame);
  }, [applySmartViewById, highlightTaskById]);

  useEffect(() => {
    const openNewTask = () => handleOpenCreateDrawer();
    const highlightTask = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId) {
        highlightTaskById(taskId);
      }
    };
    const applySmartView = (event: Event) => {
      const viewId = (event as CustomEvent<ApplySmartViewEventDetail>).detail?.viewId;
      if (viewId) {
        void applySmartViewById(viewId);
      }
    };

    window.addEventListener(NEW_TASK_EVENT, openNewTask);
    window.addEventListener(HIGHLIGHT_TASK_EVENT, highlightTask);
    window.addEventListener(APPLY_SMART_VIEW_EVENT, applySmartView);
    window.addEventListener("highlightTask", highlightTask);
    return () => {
      window.removeEventListener(NEW_TASK_EVENT, openNewTask);
      window.removeEventListener(HIGHLIGHT_TASK_EVENT, highlightTask);
      window.removeEventListener(APPLY_SMART_VIEW_EVENT, applySmartView);
      window.removeEventListener("highlightTask", highlightTask);
    };
  }, [applySmartViewById, handleOpenCreateDrawer, highlightTaskById]);

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
                onClearView={handleClearSmartView}
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
