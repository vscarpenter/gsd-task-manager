"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { AppFooter } from "@/components/app-footer";
import { HelpDialog } from "@/components/help-dialog";
import { TaskForm } from "@/components/task-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { quadrants, quadrantOrder } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import type { TaskDraft, TaskRecord } from "@/lib/types";
import {
  createTask,
  deleteTask,
  exportToJson,
  importFromJson,
  toggleCompleted,
  updateTask
} from "@/lib/tasks";

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
    dueDate: task.dueDate
  };
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return target.isContentEditable;
}

export function MatrixBoard() {
  const { all, byQuadrant } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const filteredQuadrants = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return byQuadrant;
    }

    const matches = (task: TaskRecord) => {
      const haystack = [task.title, task.description, task.quadrant, task.dueDate ?? "", task.id]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    };

    return Object.fromEntries(
      quadrantOrder.map((id) => [id, (byQuadrant[id] ?? []).filter(matches)])
    );
  }, [byQuadrant, searchQuery]);

  const visibleCount = useMemo(
    () => quadrantOrder.reduce((total, id) => total + (filteredQuadrants[id]?.length ?? 0), 0),
    [filteredQuadrants]
  );

  const closeDialog = () => setDialogState(null);

  const handleSubmit = async (draft: TaskDraft) => {
    try {
      if (dialogState?.mode === "edit" && dialogState.task) {
        await updateTask(dialogState.task.id, draft);
      } else {
        await createTask(draft);
      }
    } catch (error) {
      console.error(error);
      window.alert("Unable to save task. Please try again.");
    }
  };

  const handleDelete = async (task: TaskRecord) => {
    const confirmed = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteTask(task.id);
      closeDialog();
    } catch (error) {
      console.error(error);
      window.alert("Failed to delete task.");
    }
  };

  const handleComplete = async (task: TaskRecord, completed: boolean) => {
    try {
      await toggleCompleted(task.id, completed);
    } catch (error) {
      console.error(error);
      window.alert("Failed to update task state.");
    }
  };

  const handleExport = async () => {
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
      console.error(error);
      window.alert("Export failed. Please try again.");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const contents = await file.text();
      await importFromJson(contents);
    } catch (error) {
      console.error(error);
      window.alert("Import failed. Ensure you selected a valid export file.");
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setDialogState({ mode: "create" });
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setTheme(theme === "light" ? "dark" : "light");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [theme, setTheme]);

  const taskBeingEdited = dialogState?.mode === "edit" ? dialogState.task : undefined;
  const activeTaskDraft = taskBeingEdited ? toDraft(taskBeingEdited) : undefined;

  const hasTasks = all.length > 0;

  return (
    <div className="space-y-8">
      <AppHeader
        onNewTask={() => setDialogState({ mode: "create" })}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        onExport={handleExport}
        onImport={handleImport}
        searchInputRef={searchInputRef}
      />

      <main className="px-6 pb-10">
        {!hasTasks ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
            <h2 className="text-xl font-semibold text-white">Build your Eisenhower matrix</h2>
            <p className="mt-3 text-sm text-slate-300">
              Start by adding a task. We will help you categorize it by urgency and importance and keep it synced offline in IndexedDB.
            </p>
            <Button className="mt-6" onClick={() => setDialogState({ mode: "create" })}>
              Create your first task
            </Button>
          </div>
        ) : visibleCount === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <h2 className="text-lg font-semibold text-white">No tasks match "{searchQuery}".</h2>
            <p className="mt-2 text-sm text-slate-300">Try a different search term or clear the filter.</p>
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

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <Dialog open={dialogState !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? "Edit task" : "Create task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            initialValues={activeTaskDraft}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            onDelete={taskBeingEdited ? () => handleDelete(taskBeingEdited) : undefined}
            submitLabel={dialogState?.mode === "edit" ? "Update task" : "Add task"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
