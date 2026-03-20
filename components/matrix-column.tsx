"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FlameIcon, CalendarIcon, UsersIcon, TrashIcon } from "lucide-react";
import type { QuadrantMeta } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { cn } from "@/lib/utils";

const quadrantIcons: Record<string, typeof FlameIcon> = {
  "urgent-important": FlameIcon,
  "not-urgent-important": CalendarIcon,
  "urgent-not-important": UsersIcon,
  "not-urgent-not-important": TrashIcon
};

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
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = quadrantIcons[quadrant.id];
            return Icon ? <Icon className={cn("h-5 w-5 shrink-0", quadrant.iconColor)} /> : null;
          })()}
          <div>
            <h2 className="matrix-card__title">{quadrant.title}</h2>
            <p className="matrix-card__subtitle">{quadrant.subtitle}</p>
          </div>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold tabular-nums", quadrant.accentClass)}>
          {tasks.length}
        </span>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4 text-center text-sm text-foreground-muted/70 italic">
              Drop tasks here to get started
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
