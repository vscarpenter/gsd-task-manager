"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangleIcon } from "lucide-react";
import { cn, isOverdue, isDueToday, daysOverdue } from "@/lib/utils";
import { getUncompletedBlockingTasks, getBlockedTasks } from "@/lib/dependencies";
import { quadrantForTask, QUADRANT_ACCENT } from "@/lib/quadrants";
import { type TaskCardProps } from "@/lib/task-card-memo";
import { TaskCardHeader } from "@/components/task-card/task-card-header";
import { TaskCardMetadata } from "@/components/task-card/task-card-metadata";
import { TaskCardActions } from "@/components/task-card/task-card-actions";

export function TaskCard({
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
  const overdueDays = taskIsOverdue ? daysOverdue(task.dueDate) : 0;
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const totalSubtasks = task.subtasks.length;

  const blockingTasks = getUncompletedBlockingTasks(task, allTasks);
  const blockedTasks = getBlockedTasks(task.id, allTasks);
  const isBlocked = blockingTasks.length > 0;
  const isBlocking = blockedTasks.length > 0;

  // The card carries its quadrant's pigment (spine, completion disc, tag chips,
  // subtask fill) so the four-color matrix language reads on every surface.
  const quadrant = quadrantForTask(task.urgent, task.important);
  const accentVar = QUADRANT_ACCENT[quadrant.rdKey];
  const washVar = `var(--${quadrant.rdKey}-wash)`;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    // Flat at rest (Inkwell signature: structure is drawn with the hairline, not shadowed);
    // elevation is reserved for the dragging state.
    boxShadow: isDragging ? 'var(--shadow-card-hover)' : undefined,
  };

  return (
    <article
      data-testid="task-card"
      data-task-id={task.id}
      data-task-title={task.title}
      ref={(node) => {
        setNodeRef(node);
        if (taskRef) {
          taskRef(node);
        }
      }}
      tabIndex={-1}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 transition-all duration-200 animate-slide-in-card",
        // Clear the sticky topbar + capture bar (plus ~12pt) when scrolled to.
        "scroll-mt-24",
        "border-card-border",
        task.completed ? "opacity-60" : "opacity-100 hover:-translate-y-0.5 hover:border-accent/40",
        !task.completed && isBlocked && "opacity-[0.62]",
        task.completed && "animate-complete-flash",
        isDragging && "cursor-grabbing",
        taskIsOverdue && "border-status-overdue",
        selectionMode && isSelected && "ring-2 ring-accent ring-offset-2",
        isHighlighted && "animate-pulse-highlight ring-4 ring-accent ring-offset-2"
      )}
    >
      {/* 3pt quadrant spine — the card's quadrant identity at a glance. */}
      <span
        data-testid="task-card-spine"
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ backgroundColor: accentVar }}
      />

      {taskIsOverdue ? (
        <span className="pointer-events-none absolute right-2.5 top-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-status-overdue">
          <AlertTriangleIcon className="h-3 w-3" aria-hidden />
          {overdueDays}D Overdue
        </span>
      ) : null}

      <TaskCardHeader
        task={task}
        accentVar={accentVar}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onToggleComplete={onToggleComplete}
        sortableAttributes={attributes}
        sortableListeners={listeners}
      />

      <TaskCardMetadata
        task={task}
        accentVar={accentVar}
        washVar={washVar}
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
