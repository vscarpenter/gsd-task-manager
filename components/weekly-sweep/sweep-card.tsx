"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { DUE_PRESETS, resolveDuePreset } from "@/lib/due-date-presets";
import { formatRelative } from "@/lib/utils";
import { quadrantForTask, quadrants } from "@/lib/quadrants";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import { actionsFor, type SweepActionId, type SweepReason } from "./sweep-actions";
import { SweepReturnForm } from "./sweep-return-form";

const REASON_LINES: Record<SweepReason, string> = {
  overdue: "Due date passed",
  escalating: "Due soon, not marked urgent",
  stale: "No changes in 14 days or more",
  saved: "Saved over a month ago",
  "undated-schedule": "No date yet",
};

const LABELS: Record<SweepActionId, string> = {
  complete: "Complete",
  "new-date": "New date",
  "mark-urgent": "Mark urgent",
  save: "Save for later",
  delete: "Delete",
  return: "Return to matrix",
  move: "Move to quadrant",
  skip: "Skip",
};

export interface SweepCardHandlers {
  onComplete: () => void;
  onMarkUrgent: () => void;
  onSave: () => void;
  onDelete: () => void;
  onSkip: () => void;
  onSetDay: (day: string) => void;
  onMove: (quadrant: QuadrantId) => void;
  onReturn: (quadrant: QuadrantId, dueDate?: string) => Promise<boolean>;
}

type Panel = "date" | "move" | "return" | null;

const PANEL_OF: Partial<Record<SweepActionId, Exclude<Panel, null>>> = { "new-date": "date", move: "move", return: "return" };
const PANEL_LABELS = { date: "Choose a new date", move: "Move to quadrant", return: "Return to" } as const;

function QuadrantChoices({ current, onPick }: { current?: QuadrantId; onPick: (quadrant: QuadrantId) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {quadrants.filter((q) => q.id !== current).map((q) => (
        <Button key={q.id} variant="subtle" onClick={() => onPick(q.id)}>{q.title}</Button>
      ))}
    </div>
  );
}

function DateChoices({ onPick }: { onPick: (day: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DUE_PRESETS.filter((p) => p.value !== "none").map((preset) => (
        <Button key={preset.value} variant="subtle" onClick={() => onPick(resolveDuePreset(preset.value)!)}>
          {preset.label}
        </Button>
      ))}
      <input
        type="date"
        aria-label="Pick a date"
        value={custom}
        onChange={(event) => setCustom(event.target.value)}
        className="touch-target rounded-md border border-border bg-card px-2 py-1 text-small pointer-coarse:text-base"
      />
      <Button variant="subtle" disabled={!custom} onClick={() => onPick(custom)}>Set date</Button>
    </div>
  );
}

interface SweepCardProps {
  task: TaskRecord;
  reason: SweepReason;
  handlers: SweepCardHandlers;
}

/** Mark urgent with F1's hint, the line the matrix's menu shows under it: where the task will land. */
function MarkUrgentLabel({ task }: { task: TaskRecord }) {
  return (
    <span className="flex flex-col items-start">
      Mark urgent
      <span id={`sweep-hint-${task.id}`} className="text-xs font-normal text-foreground-muted">
        {task.important ? "Moves to Do First" : "Moves to Delegate"}
      </span>
    </span>
  );
}

/** Runs a card action, or opens the panel an action needs. */
function runAction(id: SweepActionId, handlers: SweepCardHandlers, openPanel: (panel: Exclude<Panel, null>) => void): void {
  const panel = PANEL_OF[id];
  if (panel) return openPanel(panel);
  const direct: Partial<Record<SweepActionId, () => void>> = {
    complete: handlers.onComplete,
    "mark-urgent": handlers.onMarkUrgent,
    save: handlers.onSave,
    delete: handlers.onDelete,
    skip: handlers.onSkip,
  };
  direct[id]?.();
}

interface PanelAreaProps {
  panel: Exclude<Panel, null>;
  task: TaskRecord;
  handlers: SweepCardHandlers;
  onClose: () => void;
}

/** The inline choices for New date, Move, and Return: a labelled group that takes focus when it opens. */
function PanelArea({ panel, task, handlers, onClose }: PanelAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector<HTMLElement>("button, input")?.focus(), []);
  return (
    <div ref={ref} role="group" aria-label={PANEL_LABELS[panel]} onKeyDown={(event) => event.key === "Escape" && onClose()}>
      {panel === "date" ? <DateChoices onPick={handlers.onSetDay} /> : null}
      {panel === "move" ? <QuadrantChoices current={task.quadrant} onPick={handlers.onMove} /> : null}
      {panel === "return" ? <SweepReturnForm task={task} onReturn={handlers.onReturn} onCancel={onClose} /> : null}
    </div>
  );
}

function CardHeading({ task, reason, titleRef }: { task: TaskRecord; reason: SweepReason; titleRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div>
      <h2 id={`sweep-title-${task.id}`} ref={titleRef} tabIndex={-1} className="text-h2 text-foreground">{task.title}</h2>
      <p className="mt-1 text-small text-foreground-muted">
        {quadrantForTask(task.urgent, task.important).title}
        {task.dueDate ? ` · ${formatRelative(task.dueDate)}` : ""}
      </p>
      <p className="mt-2 text-small font-medium text-foreground">{REASON_LINES[reason]}</p>
    </div>
  );
}

/** One task, one reason line, and the actions that card allows. Facts only: no counts beyond the position line. */
export function SweepCard({ task, reason, handlers }: SweepCardProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Focus moves to the new card's title after each action.
  useEffect(() => titleRef.current?.focus(), [task.id]);

  const closePanel = () => {
    setPanel(null);
    triggerRef.current?.focus();
  };
  const label = (id: SweepActionId) => (id === "new-date" && reason === "undated-schedule" ? "Add date" : LABELS[id]);

  return (
    <article aria-labelledby={`sweep-title-${task.id}`} className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-7">
      <CardHeading task={task} reason={reason} titleRef={titleRef} />
      <div className="flex flex-wrap gap-2">
        {actionsFor(reason, task).map((id) => (
          <Button
            key={id}
            variant={id === "delete" ? "destructive" : id === "skip" ? "ghost" : "subtle"}
            aria-expanded={PANEL_OF[id] ? panel === PANEL_OF[id] : undefined}
            aria-label={id === "mark-urgent" ? "Mark urgent" : undefined}
            aria-describedby={id === "mark-urgent" ? `sweep-hint-${task.id}` : undefined}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              runAction(id, handlers, setPanel);
            }}
          >
            {id === "mark-urgent" ? <MarkUrgentLabel task={task} /> : label(id)}
          </Button>
        ))}
      </div>
      {panel ? <PanelArea key={panel} panel={panel} task={task} handlers={handlers} onClose={closePanel} /> : null}
    </article>
  );
}
