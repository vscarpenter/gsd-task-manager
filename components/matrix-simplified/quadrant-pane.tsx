"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey } from "@/lib/quadrants";
import { quadrantAccent } from "@/lib/quadrant-accent";
import { cn } from "@/lib/utils";

interface QuadrantPaneProps {
  meta: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
}

export function QuadrantPane({
  meta,
  tasks,
  allTasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onAddInQuadrant,
}: QuadrantPaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const accent = quadrantAccent(meta.rdKey);
  const taskIds = tasks.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border bg-card transition-all",
        isOver ? "border-2 shadow-md" : "border-border"
      )}
      style={isOver ? { borderColor: accent } : undefined}
      aria-label={`${meta.title} quadrant`}
    >
      <header
        className="flex items-center justify-between border-b border-border px-4 pb-3 pt-4 sm:px-6 sm:pt-5"
        style={{ backgroundColor: quadrantAccent(meta.rdKey, 0.05) }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <h3 className="text-sm font-bold tracking-wide text-foreground">
            {meta.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-background-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground-muted">
            {tasks.filter((t) => !t.completed).length}
          </span>
          <button
            type="button"
            onClick={() => onAddInQuadrant(meta.rdKey)}
            aria-label={`Add to ${meta.title}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background hover:text-foreground"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <p className="px-4 pt-3 text-xs text-foreground-muted sm:px-6 sm:pt-4">{meta.rdHint}</p>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          {tasks.length === 0 ? (
            <p className="my-auto text-center text-sm italic text-foreground-muted">
              {meta.rdEmpty}
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}
