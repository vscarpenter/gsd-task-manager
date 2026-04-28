"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask, deleteTask } from "@/lib/tasks";
import { useTasks } from "@/lib/use-tasks";
import { useToast } from "@/components/ui/toast";
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
import type { RedesignQuadrantKey } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { AppShell } from "./app-shell";
import { CaptureBar, type CapturePayload } from "./capture-bar";
import { MatrixGrid } from "./matrix-grid";
import { EditDrawer, type EditDraft } from "./edit-drawer";

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

function filterTasks(tasks: TaskRecord[], query: string): TaskRecord[] {
  if (!query.trim()) return tasks;
  const q = query.trim().toLowerCase();
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
  const { showToast } = useToast();
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
  const [showCompleted, setShowCompleted] = useState<boolean>(readShowCompleted);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ShowCompletedEventDetail>).detail;
      setShowCompleted(Boolean(detail?.show));
    };
    window.addEventListener(SHOW_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(SHOW_COMPLETED_EVENT, handler);
  }, []);

  // PWA shortcut: ?action=new-task → focus capture bar (not drawer)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-task") {
      setTimeout(() => captureInputRef.current?.focus(), 50);
      params.delete("action");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
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

  const visibleTasks = useMemo(() => {
    const base = showCompleted ? all : all.filter((t) => !t.completed);
    return filterTasks(base, searchQuery);
  }, [all, searchQuery, showCompleted]);
  const total = all.length;
  const completed = all.filter((t) => t.completed).length;
  const overdue = all.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    return t.dueDate < new Date().toISOString().slice(0, 10);
  }).length;

  const handleCapture = useCallback(
    async ({ title, urgent, important, tags }: CapturePayload) => {
      try {
        await createTask({
          title,
          description: "",
          urgent,
          important,
          tags: tags.length > 0 ? tags : undefined,
        });
        showToast("Task added", undefined, TOAST_DURATION.SHORT);
      } catch {
        showToast("Failed to create task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleAddInQuadrant = useCallback((_key: RedesignQuadrantKey) => {
    captureInputRef.current?.focus();
  }, []);

  const handleToggle = useCallback(
    async (task: TaskRecord, completedNext: boolean) => {
      try {
        await toggleCompleted(task.id, completedNext);
      } catch {
        showToast("Failed to update task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleDelete = useCallback(
    async (task: TaskRecord) => {
      try {
        await deleteTask(task.id);
      } catch {
        showToast("Failed to delete task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleEditOpen = useCallback((task: TaskRecord) => setEditingTask(task), []);
  const handleEditClose = useCallback(() => setEditingTask(null), []);

  const handleOpenCreateDrawer = useCallback((payload?: CapturePayload) => {
    setCreateInitial(
      payload
        ? { title: payload.title, urgent: payload.urgent, important: payload.important, tags: payload.tags }
        : undefined
    );
    setCreateDrawerOpen(true);
  }, []);

  const handleCreateClose = useCallback(() => {
    setCreateDrawerOpen(false);
    setCreateInitial(undefined);
  }, []);

  const handleEditSubmit = useCallback(
    async (draft: EditDraft, taskId?: string) => {
      try {
        if (taskId) {
          await updateTask(taskId, draft);
          showToast("Task updated", undefined, TOAST_DURATION.SHORT);
          setEditingTask(null);
        } else {
          await createTask({
            title: draft.title,
            description: draft.description,
            urgent: draft.urgent,
            important: draft.important,
            dueDate: draft.dueDate,
            tags: draft.tags.length > 0 ? draft.tags : undefined,
          });
          showToast("Task added", undefined, TOAST_DURATION.SHORT);
          setCreateDrawerOpen(false);
          setCreateInitial(undefined);
        }
      } catch {
        showToast("Failed to save task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const activeDragTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  const caption = (
    <>
      <span>
        <strong className="font-semibold text-foreground">{total - completed}</strong> active
      </span>
      <span className="text-foreground-muted/60">·</span>
      <span>
        <strong className="font-semibold text-foreground">{completed}</strong> done
      </span>
      {overdue > 0 ? (
        <>
          <span className="text-foreground-muted/60">·</span>
          <span style={{ color: "#c2410c" }}>{overdue} overdue</span>
        </>
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
        <div className="sticky top-[60px] z-10 mb-4 -mx-4 bg-background px-4 py-2 sm:static sm:m-0 sm:bg-transparent sm:p-0 sm:pb-4">
          <CaptureBar onSubmit={handleCapture} onMoreOptions={handleOpenCreateDrawer} inputRef={captureInputRef} />
        </div>
        <MatrixGrid
          tasks={visibleTasks}
          onEdit={handleEditOpen}
          onToggleComplete={handleToggle}
          onDelete={handleDelete}
          onAddInQuadrant={handleAddInQuadrant}
        />
      </AppShell>

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
