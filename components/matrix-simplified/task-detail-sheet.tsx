"use client";

import { useRef } from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  CircleIcon,
  Link2Icon,
  ListChecksIcon,
  PencilIcon,
  Repeat2Icon,
  TagIcon,
  XIcon,
} from "lucide-react";

import { TaskDescription } from "@/components/task-description";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDueDate } from "@/lib/utils";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import { quadrantForTask, QUADRANT_ACCENT, QUADRANT_INK } from "@/lib/quadrants";
import type { RecurrenceType, TaskRecord } from "@/lib/types";

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export interface TaskDetailSheetProps {
  open: boolean;
  task: TaskRecord | null;
  allTasks?: TaskRecord[];
  onClose: () => void;
  onEdit: (task: TaskRecord) => void;
}

/**
 * Read-only task context. Mobile uses a thumb-reachable bottom sheet while
 * desktop keeps the matrix visible beside a right-hand inspector.
 */
export function TaskDetailSheet({
  open,
  task,
  allTasks = [],
  onClose,
  onEdit,
}: TaskDetailSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open && task !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      {task ? (
        <TaskDetailContent
          task={task}
          allTasks={allTasks}
          closeButtonRef={closeButtonRef}
          onClose={onClose}
          onEdit={onEdit}
        />
      ) : null}
    </Dialog>
  );
}

interface TaskDetailContentProps {
  task: TaskRecord;
  allTasks: TaskRecord[];
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onEdit: (task: TaskRecord) => void;
}

function TaskDetailContent({
  task,
  allTasks,
  closeButtonRef,
  onClose,
  onEdit,
}: TaskDetailContentProps) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const pendingEditRef = useRef<TaskRecord | null>(null);
  const quadrant = quadrantForTask(task.urgent, task.important);
  const dependencyTasks = new Map(allTasks.map((candidate) => [candidate.id, candidate]));
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

  const editTask = () => {
    pendingEditRef.current = task;
    onClose();
  };

  return (
    <DialogContent
      data-testid="task-detail-sheet"
      aria-modal="true"
      showCloseButton={false}
      style={{ paddingBottom: 0 }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocusOrMainContent(previouslyFocusedRef.current);
        previouslyFocusedRef.current = null;
        const pendingEdit = pendingEditRef.current;
        pendingEditRef.current = null;
        if (pendingEdit) onEdit(pendingEdit);
      }}
      className="inset-x-0 bottom-0 top-auto flex max-h-[min(90dvh,760px)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-card-border bg-card p-0 shadow-[var(--shadow-lg)] md:inset-y-0 md:left-auto md:right-0 md:top-0 md:h-[100dvh] md:max-h-none md:w-[440px] md:max-w-[min(440px,100vw)] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-y-0 md:border-l md:border-r-0 md:p-0"
    >
      <DialogDescription className="sr-only">
        Read task details, then close this sheet or continue to editing.
      </DialogDescription>

      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: QUADRANT_ACCENT[quadrant.rdKey] }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: QUADRANT_INK[quadrant.rdKey] }}>
            {quadrant.title}
          </p>
          <p className="truncate text-xs text-foreground-muted">{quadrant.rdTag}</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close task details"
          className="touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-icon text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain py-6 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        <DialogTitle className="text-balance text-h2 text-foreground">
          {task.title}
        </DialogTitle>

        {task.description ? (
          <p className="mt-3 text-base leading-6 text-foreground-muted">
            <TaskDescription description={task.description} />
          </p>
        ) : null}

        {(task.dueDate || task.recurrence !== "none") ? (
          <dl className="mt-6 grid grid-cols-1 gap-4 border-y border-border/60 py-4 sm:grid-cols-2">
            {task.dueDate ? (
              <DetailDatum
                icon={<CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />}
                label="Due"
                value={formatDueDate(task.dueDate)}
              />
            ) : null}
            {task.recurrence !== "none" ? (
              <DetailDatum
                icon={<Repeat2Icon className="h-4 w-4" aria-hidden="true" />}
                label="Repeats"
                value={RECURRENCE_LABELS[task.recurrence]}
              />
            ) : null}
          </dl>
        ) : null}

        {task.tags.length > 0 ? (
          <DetailSection
            id="task-detail-tags"
            icon={<TagIcon className="h-4 w-4" aria-hidden="true" />}
            title="Tags"
          >
            <ul className="flex flex-wrap gap-2" aria-labelledby="task-detail-tags">
              {task.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border bg-background-muted px-2.5 py-1 text-xs font-medium text-foreground-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </DetailSection>
        ) : null}

        {task.subtasks.length > 0 ? (
          <DetailSection
            id="task-detail-subtasks"
            icon={<ListChecksIcon className="h-4 w-4" aria-hidden="true" />}
            title="Subtasks"
            detail={`${completedSubtasks} of ${task.subtasks.length} complete`}
          >
            <ul className="space-y-2" aria-labelledby="task-detail-subtasks">
              {task.subtasks.map((subtask) => (
                <li key={subtask.id} className="flex items-start gap-2.5 text-sm leading-5 text-foreground">
                  {subtask.completed ? (
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-success-ink" aria-hidden="true" />
                  ) : (
                    <CircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
                  )}
                  <span>
                    <span className="sr-only">{subtask.completed ? "Completed: " : "Open: "}</span>
                    <span className={subtask.completed ? "text-foreground-muted line-through" : undefined}>
                      {subtask.title}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </DetailSection>
        ) : null}

        {task.dependencies.length > 0 ? (
          <DetailSection
            id="task-detail-dependencies"
            icon={<Link2Icon className="h-4 w-4" aria-hidden="true" />}
            title="Depends on"
          >
            <ul className="space-y-2" aria-labelledby="task-detail-dependencies">
              {task.dependencies.map((dependencyId) => {
                const dependency = dependencyTasks.get(dependencyId);
                return (
                  <li key={dependencyId} className="flex items-center justify-between gap-4 text-sm text-foreground">
                    <span className="min-w-0 truncate">{dependency?.title ?? "Unavailable task"}</span>
                    {dependency ? (
                      <span className="shrink-0 text-xs text-foreground-muted">
                        {dependency.completed ? "Completed" : "Open"}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </DetailSection>
        ) : null}
      </div>

      <footer
        data-testid="task-detail-actions"
        className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-background pb-[max(var(--sp-4),env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-3 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]"
      >
        <button
          type="button"
          onClick={onClose}
          className="touch-target inline-flex min-h-11 items-center justify-center rounded-sm border border-control-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-background-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Close
        </button>
        <button
          type="button"
          onClick={editTask}
          className="touch-target inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <PencilIcon className="h-4 w-4" aria-hidden="true" />
          Edit task
        </button>
      </footer>
    </DialogContent>
  );
}

function DetailDatum({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2.5 text-xs font-medium text-foreground-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 pl-[26px] text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function DetailSection({
  id,
  icon,
  title,
  detail,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 border-b border-border/60 pb-6" aria-labelledby={id}>
      <div className="mb-3 flex items-center gap-2 text-foreground-muted">
        {icon}
        <h3 id={id} className="text-sm font-semibold text-foreground">{title}</h3>
        {detail ? <p className="ml-auto text-xs tabular-nums">{detail}</p> : null}
      </div>
      {children}
    </section>
  );
}
