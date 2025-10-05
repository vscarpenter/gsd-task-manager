"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { AppFooter } from "@/components/app-footer";
import { HelpDialog } from "@/components/help-dialog";
import { TaskForm } from "@/components/task-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { quadrants, quadrantOrder } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import {
  createTask,
  deleteTask,
  exportToJson,
  importFromJson,
  moveTaskToQuadrant,
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
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Configure sensors for drag-and-drop (mouse + touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Prevent accidental drags
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    })
  );

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
    setIsLoading(true);
    try {
      if (dialogState?.mode === "edit" && dialogState.task) {
        await updateTask(dialogState.task.id, draft);
      } else {
        await createTask(draft);
      }
      closeDialog();
    } catch (error) {
      console.error(error);
      window.alert("Unable to save task. Please try again.");
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

      showToast(
        `Deleted "${task.title}"`,
        {
          label: "Undo",
          onClick: async () => {
            try {
              await createTask(toDraft(taskData));
            } catch (error) {
              console.error(error);
              window.alert("Failed to restore task.");
            }
          }
        },
        5000
      );
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
      console.error(error);
      window.alert("Export failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsLoading(true);
    try {
      const contents = await file.text();
      await importFromJson(contents);
    } catch (error) {
      console.error(error);
      window.alert("Import failed. Ensure you selected a valid export file.");
    } finally {
      setIsLoading(false);
    }
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
      console.error(error);
      showToast("Failed to move task. Please try again.", undefined, 3000);
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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const taskBeingEdited = dialogState?.mode === "edit" ? dialogState.task : undefined;
  const activeTaskDraft = taskBeingEdited ? toDraft(taskBeingEdited) : undefined;

  const hasTasks = all.length > 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        <AppHeader
          onNewTask={() => setDialogState({ mode: "create" })}
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          onExport={handleExport}
          onImport={handleImport}
          searchInputRef={searchInputRef}
          onHelp={() => setHelpOpen(true)}
          isLoading={isLoading}
        />

        <main className="px-6 pb-10">
          {!hasTasks ? (
            <div className="mx-auto max-w-3xl space-y-8">
              {/* Welcome header */}
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-center shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">Welcome to GSD Task Manager</h2>
                <p className="mt-3 text-base text-slate-600">
                  <span className="font-semibold">Get Stuff Done</span> using the Eisenhower Matrix — a proven productivity framework that helps you prioritize what truly matters.
                </p>
              </div>

              {/* Matrix explanation */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">How the Eisenhower Matrix Works</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Tasks are organized into four quadrants based on urgency and importance:
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Q1 */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <h4 className="font-semibold text-blue-900">Do First</h4>
                    </div>
                    <p className="mt-2 text-xs text-blue-700">
                      Urgent + Important<br />
                      Crises and deadlines requiring immediate attention
                    </p>
                  </div>

                  {/* Q2 */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <h4 className="font-semibold text-amber-900">Schedule</h4>
                    </div>
                    <p className="mt-2 text-xs text-amber-700">
                      Not Urgent + Important<br />
                      Long-term goals and strategic planning
                    </p>
                  </div>

                  {/* Q3 */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <h4 className="font-semibold text-emerald-900">Delegate</h4>
                    </div>
                    <p className="mt-2 text-xs text-emerald-700">
                      Urgent + Not Important<br />
                      Tasks that can be delegated to others
                    </p>
                  </div>

                  {/* Q4 */}
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-purple-500" />
                      <h4 className="font-semibold text-purple-900">Eliminate</h4>
                    </div>
                    <p className="mt-2 text-xs text-purple-700">
                      Not Urgent + Not Important<br />
                      Time-wasters to minimize or eliminate
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick tips */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Quick Tips</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400">•</span>
                    <span>Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">n</kbd> to create a new task</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400">•</span>
                    <span>All your data stays private in your browser — nothing is sent to any server</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400">•</span>
                    <span>Export your tasks regularly to keep a backup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400">•</span>
                    <span>Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">?</kbd> anytime to see all keyboard shortcuts</span>
                  </li>
                </ul>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button className="px-8 py-3 text-base" onClick={() => setDialogState({ mode: "create" })}>
                  Create your first task
                </Button>
              </div>
            </div>
          ) : visibleCount === 0 ? (
            <div className="mx-auto max-w-xl rounded-3xl border border-slate-300 bg-slate-50 p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-900">No tasks match &ldquo;{searchQuery}&rdquo;.</h2>
              <p className="mt-2 text-sm text-slate-600">Try a different search term or clear the filter.</p>
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
    </DndContext>
  );
}
