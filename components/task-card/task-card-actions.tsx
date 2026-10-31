"use client";

import { BookmarkIcon, PencilIcon, Trash2Icon, RepeatIcon, Share2Icon, CopyIcon, MoreHorizontalIcon, ClockIcon, AlertTriangleIcon, MoonIcon, ArrowRightLeftIcon, ArrowUpIcon } from "lucide-react";
import { cn, formatRelative, isRepeatClick } from "@/lib/utils";
import { DATE_CONFIG, TIME_MS } from "@/lib/constants";
import { formatSnoozeRemaining, getRemainingSnoozeMinutes, isTaskSnoozed } from "@/lib/tasks";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { escalationLabel, type EscalationResult } from "@/lib/escalation";
import { useEscalation } from "@/components/task-card/use-escalation";
import { QUADRANT_INK, quadrantForTask, quadrants } from "@/lib/quadrants";
import { SNOOZE_PRESETS } from "@/lib/snooze-presets";
import type { QuadrantId, TaskRecord } from "@/lib/types";

const MARK_URGENT_HINT = {
  "urgent-important": "Moves to Do First",
  "urgent-not-important": "Moves to Delegate",
} as const;

/** True when a future due date is within 24h. Used to color-shift the clock glyph. */
function isWithinDay(iso: string): boolean {
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diff = due - now;
  return diff > 0 && diff < TIME_MS.DAY;
}

const SHORT_DATE = new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, { month: "short", day: "numeric" });
const DATE_WITH_YEAR = new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, { month: "short", day: "numeric", year: "numeric" });

/** Adds the year only when it differs, so a mistyped year shows on the card. */
function formatOverdueDate(iso: string): string {
  const date = new Date(iso);
  const formatter = date.getFullYear() === new Date().getFullYear() ? SHORT_DATE : DATE_WITH_YEAR;
  return formatter.format(date);
}

/**
 * "2d overdue · Aug 20". The date half is the point of moving this into the
 * footer: the old corner badge stated the age and hid the date it was measured
 * from, which is the one number a reader needs to reschedule.
 */
function overdueLabel(days: number, dueDate?: string): string {
  const age = `${days}d overdue`;
  return dueDate ? `${age} · ${formatOverdueDate(dueDate)}` : age;
}

export interface TaskCardActionsProps {
  task: TaskRecord;
  taskIsOverdue: boolean;
  taskIsDueToday: boolean;
  /** Whole days past due; only read when taskIsOverdue. */
  overdueDays: number;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSave?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onClearSnooze?: (taskId: string) => Promise<void>;
  onMoveTo?: (task: TaskRecord, quadrant: QuadrantId) => Promise<void> | void;
  onMarkUrgent?: (task: TaskRecord) => Promise<void> | void;
}

export function TaskCardActions({
  task,
  taskIsOverdue,
  taskIsDueToday,
  overdueDays,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  onSnooze,
  onSave,
  onMoveTo, onMarkUrgent, onClearSnooze,
}: TaskCardActionsProps) {
  const escalation = useEscalation(task);
  const markUrgent = escalation.escalating && onMarkUrgent ? { target: escalation.target, run: onMarkUrgent } : undefined;
  return (
    <div
      data-testid="task-card-actions"
      className="flex items-center justify-between gap-2 text-xs text-foreground-muted"
    >
      <div className="flex items-center gap-2">
        {taskIsOverdue ? (
          // Same anatomy as the "Due today" chip below, one row down the
          // temperature scale, so the footer stays a single scan column
          // instead of asking the eye to also check the card's corner.
          <span
            data-testid="task-card-overdue-chip"
            className="flex items-center gap-1 rounded-full bg-status-overdue-muted px-[9px] py-0.5 font-semibold text-status-overdue-ink"
          >
            <AlertTriangleIcon className="h-3 w-3 shrink-0" aria-hidden />
            {overdueLabel(overdueDays, task.dueDate)}
          </span>
        ) : taskIsDueToday ? (
          // Due today reads as accent-semibold; the warning glyph is reserved
          // for the overdue state. Text is --accent-d, not --accent: the base
          // accent measures 4.53:1 on its own tint, too close to the floor.
          <span className="flex items-center gap-1 rounded-full bg-accent-tint px-[9px] py-0.5 text-accent-d font-semibold">
            <ClockIcon className="h-3 w-3" />
            Due today
          </span>
        ) : task.dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 truncate",
              isWithinDay(task.dueDate) && "text-status-overdue-ink"
            )}
          >
            <ClockIcon className="h-3 w-3 shrink-0" aria-hidden />
            {formatRelative(task.dueDate)}
          </span>
        ) : null}
        {task.recurrence !== "none" ? (
          <span
            className="flex items-center gap-1 text-accent"
            title={`Recurs ${task.recurrence}`}
            aria-label={`Recurs ${task.recurrence}`}
          >
            <RepeatIcon className="h-3 w-3" />
          </span>
        ) : null}
        <EscalatingTag escalation={escalation} />
        <SnoozedChip task={task} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {/* Desktop: all buttons on hover. Snooze is touch-only, by design. */}
        <DesktopActions task={task} onEdit={onEdit} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} onSave={onSave} markUrgent={markUrgent} />

        {/* Mobile: the edit button; the overflow menu below serves every width. */}
        <MobileEditButton task={task} onEdit={onEdit} />
        <CardMenu task={task} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} onSnooze={onSnooze} onSave={onSave} onMoveTo={onMoveTo} onClearSnooze={onClearSnooze} markUrgent={markUrgent} />
      </div>
    </div>
  );
}

interface MarkUrgent {
  target: EscalationResult["target"];
  run: (task: TaskRecord) => Promise<void> | void;
}

interface DesktopActionsProps {
  onSave?: (task: TaskRecord) => Promise<void> | void;
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  markUrgent?: MarkUrgent;
}

function DesktopActions({ task, onEdit, onDelete, onShare, onDuplicate, onSave, markUrgent }: DesktopActionsProps) {
  return (
    <div className="task-card-desktop-actions hidden sm:flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {markUrgent?.target ? (
        <DesktopTaskAction label={`Mark urgent, ${MARK_URGENT_HINT[markUrgent.target].replace("Moves", "moves")}`} testId="mark-urgent" icon={ArrowUpIcon} onClick={() => markUrgent.run(task)} />
      ) : null}
      {onSave && !task.completed ? <DesktopTaskAction label="Move to Saved" testId="save-task" icon={BookmarkIcon} onClick={() => onSave(task)} /> : null}
      {onShare ? <DesktopTaskAction label="Share task" icon={Share2Icon} onClick={() => onShare(task)} /> : null}
      {onDuplicate ? <DesktopTaskAction label="Duplicate task" icon={CopyIcon} onClick={() => onDuplicate(task)} /> : null}
      <DesktopTaskAction label="Edit task" testId="edit-task" icon={PencilIcon} onClick={() => onEdit(task)} />
      <DesktopTaskAction label="Delete task" testId="delete-task" icon={Trash2Icon} onClick={() => onDelete(task)} destructive />
    </div>
  );
}

function DesktopTaskAction({ label, testId, icon: Icon, onClick, destructive = false }: {
  label: string;
  testId?: string;
  icon: typeof BookmarkIcon;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" data-testid={testId} onClick={(event) => { if (!isRepeatClick(event)) onClick(); }} aria-label={label} className={cn("touch-target inline-flex items-center justify-center rounded px-1.5 py-0.5 hover:bg-background-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors", destructive && "text-rust-d hover:bg-rust-tint")}>
          <Icon className="h-3 w-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MobileEditButton({ task, onEdit }: { task: TaskRecord; onEdit: (task: TaskRecord) => void }) {
  return (
    <div className="task-card-mobile-actions flex sm:hidden items-center gap-2">
      <button
        data-testid="edit-task-mobile"
        type="button"
        onClick={() => onEdit(task)}
        className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent touch-manipulation transition-colors"
        aria-label="Edit task"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

interface CardMenuProps {
  task: TaskRecord;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSave?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onClearSnooze?: (taskId: string) => Promise<void>;
  onMoveTo?: (task: TaskRecord, quadrant: QuadrantId) => Promise<void> | void;
  markUrgent?: MarkUrgent;
}

/**
 * The ⋯ menu. Always in the row: shown on touch widths, and revealed with the
 * hover icons from `sm` up so a mouse user can reach Move to and the rest.
 */
function CardMenu({ task, onDelete, onShare, onDuplicate, onSnooze, onClearSnooze, onSave, onMoveTo, markUrgent }: CardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="task-card-menu"
          type="button"
          className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent touch-manipulation transition-colors sm:min-h-0 sm:min-w-0 sm:px-1.5 sm:py-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:data-[state=open]:opacity-100"
          aria-label="More actions"
        >
          <MoreHorizontalIcon className="h-4 w-4 sm:h-3 sm:w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MarkUrgentMenuItem task={task} markUrgent={markUrgent} />
        {onSave && !task.completed ? (
          <DropdownMenuItem data-testid="save-task-mobile" onClick={() => onSave(task)}>
            <BookmarkIcon className="mr-2 h-4 w-4" aria-hidden="true" />Move to Saved
          </DropdownMenuItem>
        ) : null}
        {onMoveTo && !task.completed ? <MoveToSubmenu task={task} onMoveTo={onMoveTo} /> : null}
        {onShare && (
          <DropdownMenuItem onClick={() => onShare(task)}>
            <Share2Icon className="mr-2 h-4 w-4" />
            Share
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={() => onDuplicate(task)}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        )}
        {onSnooze && !task.completed ? <SnoozeSubmenu task={task} onSnooze={onSnooze} onClearSnooze={onClearSnooze} /> : null}
        <DropdownMenuItem data-testid="delete-task" onClick={() => onDelete(task)} className="text-rust-d focus:text-rust-d">
          <Trash2Icon className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The trailing swipe's Snooze, with the full preset list and a way to undo one. */
function SnoozeSubmenu({ task, onSnooze, onClearSnooze }: { task: TaskRecord; onSnooze: (taskId: string, minutes: number) => Promise<void>; onClearSnooze?: (taskId: string) => Promise<void> }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-testid="snooze-task">
        <MoonIcon className="mr-2 h-4 w-4" aria-hidden="true" />
        Snooze
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {SNOOZE_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.label} onClick={() => onSnooze(task.id, preset.minutes)}>
            {preset.label}
          </DropdownMenuItem>
        ))}
        {onClearSnooze && isTaskSnoozed(task) ? (
          <DropdownMenuItem onClick={() => onClearSnooze(task.id)}>Clear snooze</DropdownMenuItem>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function MarkUrgentMenuItem({ task, markUrgent }: { task: TaskRecord; markUrgent?: MarkUrgent }) {
  if (!markUrgent?.target) return null;
  return (
    <DropdownMenuItem data-testid="mark-urgent-menu" onClick={() => markUrgent.run(task)}>
      <ArrowUpIcon className="mr-2 h-4 w-4" aria-hidden="true" />
      <span className="flex flex-col">
        Mark urgent
        <span className="text-xs text-foreground-muted">{MARK_URGENT_HINT[markUrgent.target]}</span>
      </span>
    </DropdownMenuItem>
  );
}

function MoveToSubmenu({ task, onMoveTo }: { task: TaskRecord; onMoveTo: (task: TaskRecord, quadrant: QuadrantId) => Promise<void> | void }) {
  const current = quadrantForTask(task.urgent, task.important).id;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-testid="move-to">
        <ArrowRightLeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />
        Move to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {quadrants.map((quadrant) => (
          <DropdownMenuItem
            key={quadrant.id}
            disabled={quadrant.id === current}
            onClick={() => onMoveTo(task, quadrant.id)}
          >
            {quadrant.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The visible result of a snooze: how long the reminders stay quiet. Neutral
 * ground like a tag, because a snooze is a state to know about, not an alarm.
 */
function SnoozedChip({ task }: { task: TaskRecord }) {
  if (!isTaskSnoozed(task)) return null;
  return (
    <span
      data-testid="task-card-snoozed-chip"
      className="inline-flex items-center gap-1 rounded-full bg-background-muted px-[9px] py-0.5 font-medium text-foreground-muted"
    >
      <MoonIcon className="h-3 w-3 shrink-0" aria-hidden />
      Snoozed {formatSnoozeRemaining(getRemainingSnoozeMinutes(task))}
    </span>
  );
}

/**
 * Escalation signal: text plus an up arrow in the target quadrant's ink, never
 * color alone. The visible word is "Escalating"; the full due phrase is the
 * accessible name so the card stays quiet.
 */
function EscalatingTag({ escalation }: { escalation: EscalationResult }) {
  if (!escalation.escalating || escalation.daysUntilDue === null || !escalation.target) return null;
  const ink = QUADRANT_INK[escalation.target === "urgent-important" ? "q1" : "q3"];
  const fullLabel = escalationLabel(escalation.daysUntilDue);
  return (
    <span
      data-testid="task-card-escalating-tag"
      role="img"
      aria-label={fullLabel}
      className="inline-flex items-center gap-1 font-semibold"
      style={{ color: ink }}
    >
      <ArrowUpIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span aria-hidden>Escalating</span>
    </span>
  );
}
