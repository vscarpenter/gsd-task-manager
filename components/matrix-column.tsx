"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { QuadrantMeta } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { cn } from "@/lib/utils";

interface MatrixColumnProps {
  quadrant: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
  selectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (task: TaskRecord) => void;
  taskRefs?: React.MutableRefObject<Map<string, HTMLElement>>;
  highlightedTaskId?: string | null;
}

function MatrixColumnComponent({
  quadrant,
  tasks,
  allTasks,
  onEdit,
  onDelete,
  onToggleComplete,
  onShare,
  onDuplicate,
  onSnooze,
  onStartTimer,
  onStopTimer,
  selectionMode,
  selectedTaskIds,
  onToggleSelect,
  taskRefs,
  highlightedTaskId
}: MatrixColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: quadrant.id
  });

  // React Compiler handles optimization automatically
  const taskIds = tasks.map((task) => task.id);

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
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
                onShare={onShare}
                onDuplicate={onDuplicate}
                onSnooze={onSnooze}
                onStartTimer={onStartTimer}
                onStopTimer={onStopTimer}
                selectionMode={selectionMode}
                isSelected={selectedTaskIds?.has(task.id)}
                onToggleSelect={onToggleSelect}
                taskRef={(el) => {
                  if (el && taskRefs) {
                    taskRefs.current.set(task.id, el);
                  }
                }}
                isHighlighted={highlightedTaskId === task.id}
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
    prevProps.tasks === nextProps.tasks && // Reference equality check
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.allTasks.length === nextProps.allTasks.length
  );
});
