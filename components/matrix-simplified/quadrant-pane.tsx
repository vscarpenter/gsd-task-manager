"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon, FlameIcon, CalendarIcon, UsersIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey, RedesignIconKey } from "@/lib/quadrants";
import { QUADRANT_ACCENT, QUADRANT_HEADER, QUADRANT_INK, QUADRANT_WASH } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const RD_ICON: Record<RedesignIconKey, LucideIcon> = {
  flame: FlameIcon,
  calendar: CalendarIcon,
  users: UsersIcon,
  trash: Trash2Icon,
};

interface QuadrantPaneProps {
  meta: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onInspect?: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onShare: (task: TaskRecord) => void;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
  highlightedTaskId?: string | null;
  onTaskRef?: (taskId: string, element: HTMLElement | null) => void;
  sectionRef?: (element: HTMLElement | null) => void;
}

export function QuadrantPane({
  meta,
  tasks,
  allTasks,
  onEdit,
  onInspect,
  onToggleComplete,
  onDelete,
  onShare,
  onAddInQuadrant,
  highlightedTaskId,
  onTaskRef,
  sectionRef,
}: QuadrantPaneProps) {
  // `meta.id` names both the droppable and the SortableContext below. The
  // SortableContext id is load-bearing: a card dropped onto another card
  // resolves its target quadrant through its container, since `over` is the card.
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const accent = QUADRANT_ACCENT[meta.rdKey];
  const ink = QUADRANT_INK[meta.rdKey];
  const wash = QUADRANT_WASH[meta.rdKey];
  const header = QUADRANT_HEADER[meta.rdKey];
  const QuadrantIcon = RD_ICON[meta.rdIcon];
  const taskIds = tasks.map((t) => t.id);
  // Completed work is separated rather than interleaved. Show-completed used to
  // inject every finished card inline, growing the board past 8,000px and
  // pushing the active tasks — the whole point of the quadrant — off screen.
  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const activeTaskCount = activeTasks.length;
  const [showCompletedHere, setShowCompletedHere] = useState(false);
  const cardHandlers: CardHandlers = {
    onEdit, onInspect, onDelete, onShare, onToggleComplete, highlightedTaskId, onTaskRef,
  };
  return (
    <section data-testid={`quadrant-${meta.rdKey}`}
      data-drop-active={isOver ? "true" : undefined}
      id={`matrix-quadrant-${meta.rdKey}`}
      ref={(node) => {
        setNodeRef(node);
        sectionRef?.(node);
      }}
      tabIndex={-1}
      className={cn(
        "relative flex min-h-[280px] flex-col overflow-hidden rounded-lg border border-pane-border shadow-[var(--shadow-card)] transition-colors focus:outline-none focus:ring-4 focus:ring-accent focus:ring-offset-4",
        isOver && "ring-2 ring-inset"
      )}
      style={{
        backgroundColor: wash,
        ...(isOver ? { ["--tw-ring-color" as string]: accent } : {}),
      }}
      aria-label={`${meta.title} quadrant`}
    >
      <header
        data-testid="quadrant-header"
        className="flex items-center gap-2 border-t-[3px] px-[18px] pb-2.5 pt-3"
        style={{ backgroundColor: header, borderTopColor: accent }}
      >
        <QuadrantIcon
          data-testid="quadrant-icon"
          aria-hidden="true"
          className="h-[18px] w-[18px] shrink-0"
          style={{ color: ink }}
        />
        <h2
          data-testid="quadrant-title"
          className="shrink-0 text-body font-semibold leading-none"
          style={{ color: ink }}
        >
          {meta.title}
        </h2>
        <span data-testid="quadrant-hint" className="min-w-0 truncate text-caption" style={{ color: ink }}>
          {meta.rdHint}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-background-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {activeTaskCount}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="touch-target inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-icon text-foreground-muted hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext id={meta.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-1">
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-2 py-4 text-center">
              {/* Reassuring mark: one icon in ink-3 on a 60pt sunken tile — never a
                  colorful illustration (reference §09). */}
              <span
                data-testid="quadrant-empty-mark"
                aria-hidden
                className="flex h-[60px] w-[60px] items-center justify-center rounded-lg bg-background-muted text-ink-3"
              >
                <QuadrantIcon className="h-6 w-6" />
              </span>
              <p className="text-balance text-[16px] font-semibold leading-tight tracking-tight text-foreground">
                {meta.rdEmptyHeadline}
              </p>
              <p className="max-w-[26ch] text-pretty text-caption text-foreground-muted">
                {meta.rdEmptySupporting}
              </p>
              {/* Eliminate is the one quadrant where an empty state needs no action
                  — there is nothing useful to add (reference §09). */}
              {meta.rdKey !== "q4" ? (
                <button
                  type="button"
                  onClick={() => onAddInQuadrant(meta.rdKey)}
                  className="touch-target mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-caption font-medium transition-colors hover:bg-background-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  // Border takes the raw pigment, text takes the darkened ink:
                  // brass (--q3) as 11px text measures 3.6:1 on the pane ground,
                  // under the 4.5:1 floor. A border has no such requirement.
                  style={{ borderColor: accent, color: ink }}
                >
                  <PlusIcon className="h-3 w-3" aria-hidden />
                  Add to {meta.title}
                </button>
              ) : null}
            </div>
          ) : (
            <TaskCardList tasks={activeTasks} allTasks={allTasks} handlers={cardHandlers} />
          )}

          <CompletedDisclosure
            tasks={completedTasks}
            allTasks={allTasks}
            open={showCompletedHere}
            onToggle={() => setShowCompletedHere((open) => !open)}
            handlers={cardHandlers}
          />
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * Finished work in this quadrant, collapsed by default.
 *
 * Nothing is hidden permanently — Show-completed asked for these, and one click
 * returns them. What changes is that they no longer bury the active tasks the
 * quadrant exists to surface.
 */
function CompletedDisclosure({
  tasks,
  allTasks,
  open,
  onToggle,
  handlers,
}: {
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  open: boolean;
  onToggle: () => void;
  handlers: CardHandlers;
}) {
  if (tasks.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-caption font-medium text-foreground-muted transition-colors hover:bg-background-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronRightIcon
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        {tasks.length} done
      </button>
      {open ? <TaskCardList tasks={tasks} allTasks={allTasks} handlers={handlers} /> : null}
    </>
  );
}

type CardHandlers = Pick<
  QuadrantPaneProps,
  "onEdit" | "onInspect" | "onDelete" | "onShare" | "onToggleComplete" | "highlightedTaskId" | "onTaskRef"
>;

/** A run of task cards. Shared by the active list and the completed disclosure. */
function TaskCardList({
  tasks,
  allTasks,
  handlers,
}: {
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  handlers: CardHandlers;
}) {
  return (
    <>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          allTasks={allTasks}
          onEdit={handlers.onEdit}
          onInspect={handlers.onInspect}
          onDelete={handlers.onDelete}
          onShare={handlers.onShare}
          onToggleComplete={handlers.onToggleComplete}
          isHighlighted={task.id === handlers.highlightedTaskId}
          taskRef={(element) => handlers.onTaskRef?.(task.id, element)}
        />
      ))}
    </>
  );
}
