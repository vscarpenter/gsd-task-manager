"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, isOverdue, isDueToday } from "@/lib/utils";
import { getUncompletedBlockingTasks, getBlockedTasks } from "@/lib/dependencies";
import { areTaskCardPropsEqual, type TaskCardProps } from "@/lib/task-card-memo";
import { TaskCardHeader } from "@/components/task-card/task-card-header";
import { TaskCardMetadata } from "@/components/task-card/task-card-metadata";
import { TaskCardActions } from "@/components/task-card/task-card-actions";

function TaskCardComponent({
  task,
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
  isSelected,
  onToggleSelect,
  taskRef,
  isHighlighted,
}: TaskCardProps) {
  const taskIsOverdue = !task.completed && isOverdue(task.dueDate);
  const taskIsDueToday = !task.completed && isDueToday(task.dueDate);
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const totalSubtasks = task.subtasks.length;

  const blockingTasks = getUncompletedBlockingTasks(task, allTasks);
  const blockedTasks = getBlockedTasks(task.id, allTasks);
  const isBlocked = blockingTasks.length > 0;
  const isBlocking = blockedTasks.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    boxShadow: isDragging ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
  };

  return (
    <article
      ref={(node) => {
        setNodeRef(node);
        if (taskRef && node) {
          taskRef(node);
        }
      }}
      style={style}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card p-3 transition-all duration-200 animate-slide-in-card",
        task.completed ? "opacity-60" : "opacity-100 hover:-translate-y-0.5 hover:border-accent/40",
        task.completed && "animate-complete-flash",
        isDragging && "cursor-grabbing",
        taskIsOverdue ? "overdue-task border-l-4 border-red-200 bg-red-50/40 dark:border-red-800/60 dark:bg-red-950/20" : "border-card-border",
        selectionMode && isSelected && "ring-2 ring-accent ring-offset-2",
        isHighlighted && "animate-pulse-highlight ring-4 ring-accent ring-offset-2"
      )}
    >
      <TaskCardHeader
        task={task}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onToggleComplete={onToggleComplete}
        sortableAttributes={attributes}
        sortableListeners={listeners}
      />

      <TaskCardMetadata
        task={task}
        completedSubtasks={completedSubtasks}
        totalSubtasks={totalSubtasks}
        isBlocked={isBlocked}
        isBlocking={isBlocking}
        blockingTasks={blockingTasks}
        blockedTasks={blockedTasks}
        onStartTimer={onStartTimer}
        onStopTimer={onStopTimer}
      />

      <TaskCardActions
        task={task}
        taskIsOverdue={taskIsOverdue}
        taskIsDueToday={taskIsDueToday}
        onEdit={onEdit}
        onDelete={onDelete}
        onShare={onShare}
        onDuplicate={onDuplicate}
        onSnooze={onSnooze}
      />
    </article>
  );
}

// Memoize the component to prevent unnecessary re-renders
// Comparison function imported from @/lib/task-card-memo
export const TaskCard = memo(TaskCardComponent, areTaskCardPropsEqual);
