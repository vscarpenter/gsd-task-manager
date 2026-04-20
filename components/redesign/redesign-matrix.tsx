"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask } from "@/lib/tasks";
import { useTasks } from "@/lib/use-tasks";
import type { TaskRecord } from "@/lib/types";
import type { RedesignQuadrantKey } from "@/lib/quadrants";
import { quadrantByRdKey } from "@/lib/quadrants";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/components/matrix-board/use-event-handlers";
import { TOAST_DURATION } from "@/lib/constants";
import { RedesignShell, type RedesignView } from "./redesign-shell";
import { ViewFocus } from "./view-focus";
import { ViewEditorial } from "./view-editorial";
import { CanvasPillPreview, ViewCanvas } from "./view-canvas";
import { QuickAdd } from "./quick-add";
import { ComposerDrawer } from "./composer-drawer";
import { HelpDrawer } from "./help-drawer";
import { TaskCard } from "./task-card";

const VIEW_STORAGE_KEY = "gsd:redesign-view";

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function filterTasks(tasks: TaskRecord[], query: string): TaskRecord[] {
  if (!query.trim()) return tasks;
  const q = query.trim().toLowerCase();
  return tasks.filter((t) => {
    const hay =
      t.title.toLowerCase() +
      " " +
      t.description.toLowerCase() +
      " " +
      t.tags.join(" ").toLowerCase() +
      " " +
      t.subtasks.map((s) => s.title).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function RedesignMatrix() {
  const { all } = useTasks();
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();
  const { sensors, activeId, handleDragStart, handleDragEnd } = useDragAndDrop(handleError);

  // Background lifecycle hooks preserved from the legacy MatrixBoard —
  // without these, auto-archive stops running and due-date notifications
  // stop firing for users who had those features enabled.
  useAutoArchive();
  useNotificationChecker();

  const [view, setView] = useState<RedesignView>("focus");
  const [composerOpen, setComposerOpen] = useState(false);
  const [presetQuadrant, setPresetQuadrant] = useState<RedesignQuadrantKey | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as RedesignView | null;
    if (stored === "focus" || stored === "editorial" || stored === "canvas") {
      setView(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        setPresetQuadrant(null);
        setEditingTask(null);
        setComposerOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "1") {
        setView("focus");
      } else if (e.key === "2") {
        setView("editorial");
      } else if (e.key === "3") {
        setView("canvas");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Support PWA manifest shortcut (?action=new-task) and dashboard drill-in URLs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "new-task") {
      setPresetQuadrant(null);
      setEditingTask(null);
      setComposerOpen(true);
      params.delete("action");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  const visibleTasks = useMemo(() => filterTasks(all, searchQuery), [all, searchQuery]);

  const handleToggle = useCallback(
    async (task: TaskRecord, completed: boolean) => {
      try {
        await toggleCompleted(task.id, completed);
      } catch {
        showToast("Failed to update task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleOpenTask = useCallback((task: TaskRecord) => {
    setEditingTask(task);
    setPresetQuadrant(null);
    setComposerOpen(true);
  }, []);

  const openComposer = useCallback((key?: RedesignQuadrantKey) => {
    setPresetQuadrant(key ?? null);
    setEditingTask(null);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setEditingTask(null);
  }, []);

  const handleQuickAdd = useCallback(
    async ({ title, urgent, important, tags }: { title: string; urgent: boolean; important: boolean; tags: string[] }) => {
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

  const handleComposerSubmit = useCallback(
    async (
      draft: { title: string; description: string; urgent: boolean; important: boolean; dueDate?: string; tags: string[] },
      editingId?: string
    ) => {
      try {
        if (editingId) {
          await updateTask(editingId, {
            title: draft.title,
            description: draft.description,
            urgent: draft.urgent,
            important: draft.important,
            dueDate: draft.dueDate,
            tags: draft.tags,
          });
          showToast("Task updated", undefined, TOAST_DURATION.SHORT);
        } else {
          await createTask({
            title: draft.title,
            description: draft.description,
            urgent: draft.urgent,
            important: draft.important,
            dueDate: draft.dueDate,
            tags: draft.tags.length > 0 ? draft.tags : undefined,
          });
          const q = quadrantByRdKey(
            draft.urgent && draft.important ? "q1" : !draft.urgent && draft.important ? "q2" : draft.urgent ? "q3" : "q4"
          );
          showToast(`Added to ${q.title}`, undefined, TOAST_DURATION.SHORT);
        }
      } catch {
        showToast(editingId ? "Failed to update task" : "Failed to create task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const activeDragTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <RedesignShell
        view={view}
        onViewChange={setView}
        onOpenComposer={() => openComposer()}
        onOpenHelp={() => setHelpOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      >
        {view !== "canvas" && (
          <div style={{ marginBottom: 22 }}>
            <QuickAdd onSubmit={handleQuickAdd} onOpenFull={() => openComposer()} presetQuadrant={presetQuadrant} />
          </div>
        )}

        {view === "focus" && (
          <ViewFocus tasks={visibleTasks} onToggle={handleToggle} onOpen={handleOpenTask} onAdd={openComposer} />
        )}
        {view === "editorial" && (
          <ViewEditorial tasks={visibleTasks} onToggle={handleToggle} onOpen={handleOpenTask} onAdd={openComposer} />
        )}
        {view === "canvas" && <ViewCanvas tasks={visibleTasks} onOpen={handleOpenTask} />}
      </RedesignShell>

      <ComposerDrawer
        open={composerOpen}
        onClose={closeComposer}
        onSubmit={handleComposerSubmit}
        presetQuadrant={presetQuadrant}
        editingTask={editingTask}
      />

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />

      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          // DragOverlay portals to document.body, so re-apply .redesign-scope
          // to keep tokens (--paper, --ink, etc.) resolving.
          <div className="redesign-scope" style={{ cursor: "grabbing" }}>
            {view === "canvas" ? (
              <CanvasPillPreview task={activeDragTask} />
            ) : (
              <TaskCard task={activeDragTask} />
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
