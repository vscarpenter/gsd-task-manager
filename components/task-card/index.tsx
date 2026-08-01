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
  onInspect,
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

  // The card carries its quadrant's pigment (spine, completion disc, subtask
  // fill) so the four-color matrix language reads on every surface. Tags are
  // deliberately excluded — see the note in TaskCardMetadata.
  const quadrant = quadrantForTask(task.urgent, task.important);
  const accentVar = QUADRANT_ACCENT[quadrant.rdKey];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    // Violet Frost floats the panes, so cards need a whisper of elevation to sit
    // *on* the pane rather than dissolve into it — the 1px border alone reads
    // at 1.25:1 against the pane ground. Drag still gets the full lift.
    boxShadow: isDragging ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
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
        // Explicit property list (not transition-all): only these change on the
        // card, and `all` would also transition the dnd-kit drag transform.
        // Asymmetric padding: the extra 4px on the left is the gutter the
        // spine sits in, so the title still starts on the card's optical edge.
        "group relative flex flex-col gap-2 rounded-md border bg-card py-3 pl-4 pr-3 transition-[transform,border-color,box-shadow,opacity] duration-200 ease-out animate-slide-in-card",
        // Clear the sticky topbar + capture bar (plus ~12pt) when scrolled to.
        "scroll-mt-24",
        "border-card-border",
        // focus-within, not focus-visible: the article is tabIndex={-1} and is
        // only ever focused programmatically (scroll-to-highlight), and
        // :focus-visible does not match programmatic focus — a ring here would
        // be dead CSS. focus-within gives a keyboard user tabbing into the card
        // the same row-highlight a mouse user gets on hover.
        // ui-craft-detect-ignore-next-line
        "opacity-100",
        !task.completed && "hover:-translate-y-0.5 hover:border-accent/40 focus-within:border-accent/40",
        task.completed && "animate-complete-flash",
        isDragging && "cursor-grabbing",
        // Half-strength so an overdue card is marked, not alarmed — the badge
        // above carries the actual message.
        taskIsOverdue && "border-status-overdue/50",
        selectionMode && isSelected && "ring-2 ring-accent ring-offset-2",
        isHighlighted && "animate-pulse-highlight ring-4 ring-accent ring-offset-2"
      )}
    >
      {/* 3pt quadrant spine — a pill inset 10px top and bottom rather than a
          full-height rule, so it reads as a mark on the card instead of part
          of the card's own border. */}
      <span
        data-testid="task-card-spine"
        aria-hidden
        className="pointer-events-none absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-full"
        style={{ backgroundColor: accentVar }}
      />

      {taskIsOverdue ? (
        <span className="pointer-events-none absolute right-3 top-2.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-status-overdue-ink">
          <AlertTriangleIcon className="h-[11px] w-[11px]" aria-hidden />
          {overdueDays}d overdue
        </span>
      ) : null}

      <TaskCardHeader
        task={task}
        accentVar={accentVar}
        reserveBadgeSpace={taskIsOverdue}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        onToggleComplete={onToggleComplete}
        onInspect={onInspect}
        sortableAttributes={attributes}
        sortableListeners={listeners}
      />

      <TaskCardMetadata
        task={task}
        accentVar={accentVar}
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
