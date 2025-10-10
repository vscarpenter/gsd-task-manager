"use client";

import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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

function MatrixColumnComponent({ quadrant, tasks, onEdit, onDelete, onToggleComplete }: MatrixColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: quadrant.id
  });

  // Memoize task IDs array to prevent unnecessary SortableContext re-renders
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "matrix-card transition-all",
        quadrant.bgClass,
        isOver && "ring-2 ring-accent ring-offset-2"
      )}
    >
      <header className="matrix-card__header">
        <div>
          <h2 className="matrix-card__title">{quadrant.title}</h2>
          <p className="matrix-card__subtitle">{quadrant.subtitle}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", quadrant.accentClass)}>
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-background/50 p-4 text-sm text-foreground-muted">
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
      </SortableContext>
    </section>
  );
}

// Memoize the component to prevent re-renders when tasks haven't changed
export const MatrixColumn = memo(MatrixColumnComponent, (prevProps, nextProps) => {
  // Only re-render if tasks array reference changed or length differs
  return (
    prevProps.quadrant.id === nextProps.quadrant.id &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.tasks === nextProps.tasks // Reference equality check
  );
});
