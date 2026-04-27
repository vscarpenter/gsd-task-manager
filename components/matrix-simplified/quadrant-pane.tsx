"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const WASH_CLASS: Record<RedesignQuadrantKey, string> = {
  q1: "quadrant-wash-q1",
  q2: "quadrant-wash-q2",
  q3: "quadrant-wash-q3",
  q4: "quadrant-wash-q4",
};

const ACCENT: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

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
  const accent = ACCENT[meta.rdKey];
  const taskIds = tasks.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[280px] flex-col rounded-2xl border p-4 transition-all",
        WASH_CLASS[meta.rdKey],
        isOver ? "border-2 shadow-md" : "border-border"
      )}
      style={isOver ? { borderColor: accent } : undefined}
      aria-label={`${meta.title} quadrant`}
    >
      <header className="mb-3 flex items-center gap-2.5">
        <span
          className="rd-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {meta.title}
        </span>
        <span className="text-[12px] text-foreground-muted">{meta.rdHint}</span>
        <span className="ml-auto rounded bg-background-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {tasks.filter((t) => !t.completed).length}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted hover:text-foreground"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
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
