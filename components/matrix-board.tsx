"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MatrixColumn } from "@/components/matrix-column";
import { AppFooter } from "@/components/app-footer";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { quadrants, quadrantOrder } from "@/lib/quadrants";
import { useTasks } from "@/lib/use-tasks";
import { applyFilters } from "@/lib/filters";
import type { FilterCriteria } from "@/lib/filters";
import type { QuadrantId, TaskDraft, TaskRecord } from "@/lib/types";
import {
  createTask,
  deleteTask,
  exportToJson,
  moveTaskToQuadrant,
  toggleCompleted,
  updateTask
} from "@/lib/tasks";

// Lazy load heavy components
const HelpDialog = lazy(() => import("@/components/help-dialog").then(m => ({ default: m.HelpDialog })));
const ImportDialog = lazy(() => import("@/components/import-dialog").then(m => ({ default: m.ImportDialog })));
const TaskForm = lazy(() => import("@/components/task-form").then(m => ({ default: m.TaskForm })));
const SaveSmartViewDialog = lazy(() => import("@/components/save-smart-view-dialog").then(m => ({ default: m.SaveSmartViewDialog })));

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
    dueDate: task.dueDate,
    recurrence: task.recurrence,
    tags: task.tags,
    subtasks: task.subtasks
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
  const { all } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [saveSmartViewOpen, setSaveSmartViewOpen] = useState(false);
  const [pendingImportContents, setPendingImportContents] = useState<string | null>(null);
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

  // Extract all unique tags from tasks
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    all.forEach(task => task.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [all]);

  const filteredQuadrants = useMemo(() => {
    // First apply advanced filters
    const criteriaWithSearch = { ...filterCriteria, searchQuery: searchQuery.trim() || undefined };
    const filtered = applyFilters(all, criteriaWithSearch);

    // Group filtered tasks by quadrant
    return Object.fromEntries(
      quadrantOrder.map((id) => [id, filtered.filter(task => task.quadrant === id)])
    );
  }, [all, filterCriteria, searchQuery]);

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
    try {
      const contents = await file.text();
      // Validate JSON format before showing dialog
      JSON.parse(contents);
      setPendingImportContents(contents);
      setImportDialogOpen(true);
    } catch (error) {
      console.error(error);
      window.alert("Invalid file format. Please select a valid JSON export file.");
    }
  };

  const handleImportComplete = () => {
    setPendingImportContents(null);
    showToast("Tasks imported successfully", undefined, 3000);
  };

  const handleSelectSmartView = (criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
    setSearchQuery(""); // Clear search when selecting a Smart View
  };

  const handleSaveSmartView = () => {
    setSaveSmartViewOpen(true);
  };

  const handleSmartViewSaved = () => {
    showToast("Smart View saved successfully", undefined, 3000);
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
          onSelectSmartView={handleSelectSmartView}
          onOpenFilters={() => setFilterPopoverOpen(true)}
          currentFilterCriteria={filterCriteria}
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
          onClick={() => setDialogState({ mode: "create" })}
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
            <div className="mx-auto max-w-3xl space-y-8">
              {/* Welcome header */}
              <div className="rounded-3xl border border-card-border bg-gradient-to-br from-background-muted to-background p-8 text-center shadow-sm">
                <h2 className="text-2xl font-bold text-foreground">Welcome to GSD Task Manager</h2>
                <p className="mt-3 text-base text-foreground-muted">
                  <span className="font-semibold">Get Stuff Done</span> using the Eisenhower Matrix — a proven productivity framework that helps you prioritize what truly matters.
                </p>
              </div>

              {/* Matrix explanation */}
              <div className="rounded-3xl border border-card-border bg-card p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">How the Eisenhower Matrix Works</h3>
                <p className="mt-2 text-sm text-foreground-muted">
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
              <div className="rounded-3xl border border-card-border bg-card p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">Quick Tips</h3>
                <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-foreground-muted">•</span>
                    <span>Press <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">n</kbd> to create a new task</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-foreground-muted">•</span>
                    <span>All your data stays private in your browser — nothing is sent to any server</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-foreground-muted">•</span>
                    <span>Export your tasks regularly to keep a backup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-foreground-muted">•</span>
                    <span>Press <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">?</kbd> anytime to see all keyboard shortcuts</span>
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
            <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background-muted p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">No tasks match &ldquo;{searchQuery}&rdquo;.</h2>
              <p className="mt-2 text-sm text-foreground-muted">Try a different search term or clear the filter.</p>
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

        {/* Lazy-loaded dialogs with Suspense fallback */}
        {helpOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
          </Suspense>
        )}

        {importDialogOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <ImportDialog
              open={importDialogOpen}
              onOpenChange={setImportDialogOpen}
              fileContents={pendingImportContents}
              existingTaskCount={all.length}
              onImportComplete={handleImportComplete}
            />
          </Suspense>
        )}

        {saveSmartViewOpen && (
          <Suspense fallback={<div className="sr-only">Loading...</div>}>
            <SaveSmartViewDialog
              open={saveSmartViewOpen}
              onOpenChange={setSaveSmartViewOpen}
              criteria={filterCriteria}
              onSaved={handleSmartViewSaved}
            />
          </Suspense>
        )}

        <FilterPopover
          open={filterPopoverOpen}
          onOpenChange={setFilterPopoverOpen}
          criteria={filterCriteria}
          onChange={setFilterCriteria}
          onSaveAsSmartView={handleSaveSmartView}
          availableTags={availableTags}
        />

        <Dialog open={dialogState !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogState?.mode === "edit" ? "Edit task" : "Create task"}</DialogTitle>
            </DialogHeader>
            {dialogState !== null && (
              <Suspense fallback={<div className="flex items-center justify-center p-8"><Spinner /></div>}>
                <TaskForm
                  initialValues={activeTaskDraft}
                  onSubmit={handleSubmit}
                  onCancel={closeDialog}
                  onDelete={taskBeingEdited ? () => handleDelete(taskBeingEdited) : undefined}
                  submitLabel={dialogState?.mode === "edit" ? "Update task" : "Add task"}
                />
              </Suspense>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
