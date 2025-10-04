"use client";

import type { QuadrantMeta } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { cn } from "@/lib/utils";

interface MatrixColumnProps {
  quadrant: QuadrantMeta;
  tasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
}

export function MatrixColumn({ quadrant, tasks, onEdit, onDelete, onToggleComplete }: MatrixColumnProps) {
  return (
    <section className={cn("matrix-card", quadrant.bgClass)}>
      <header className="matrix-card__header">
        <div>
          <h2 className="matrix-card__title">{quadrant.title}</h2>
          <p className="matrix-card__subtitle">{quadrant.subtitle}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", quadrant.accentClass)}>
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4 text-sm text-slate-500">
            Nothing here yet - drop something that matches this quadrant.
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
            />
          ))
        )}
      </div>
    </section>
  );
}
