"use client";

import { useRef, useState } from "react";
import type { TaskRecord } from "@/lib/types";
import { MAX_PICKS } from "@/lib/top-three";
import { addToToday, movePick, removeFromToday, reorderPicks, tidyPicks } from "@/lib/tasks/top-three-actions";
import { reportTaskMutationError } from "@/components/matrix-simplified/task-actions";
import { OfferList, TidyOffer } from "./today-offers";
import { PickList } from "./today-rows";
import type { TodayView } from "./derive-today";
import { useToday } from "./use-today";

export interface TodayStripProps {
  tasks: TaskRecord[];
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onInspect: (task: TaskRecord) => void;
}

/** Runs a write and reports a failure the way every other task action does. */
async function attempt(run: () => Promise<unknown>, action: string, message: string): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    reportTaskMutationError(error, action, message);
    return false;
  }
}

function FreeSlotOffers({ today, onAdd }: { today: TodayView; onAdd: (task: TaskRecord) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <OfferList heading={today.carry.label} tasks={today.carry.tasks} onAdd={onAdd} />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="touch-target text-small text-foreground-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Pick up to three for today
      </button>
      {open ? <OfferList heading={null} tasks={today.suggestions} onAdd={onAdd} /> : null}
    </>
  );
}

function useTodayHandlers(tasks: TaskRecord[], now: Date, zone: string) {
  return {
    add: (task: TaskRecord) =>
      attempt(() => addToToday(task.id, tasks, now, zone), "add_to_today", "Couldn't add to today. Try again."),
    move: (task: TaskRecord, direction: "up" | "down") =>
      attempt(() => movePick(task.id, direction, tasks, now, zone), "move_pick", "Couldn't reorder today. Try again."),
    remove: (task: TaskRecord) =>
      attempt(() => removeFromToday(task.id), "remove_from_today", "Couldn't remove that from today. Try again."),
    reorder: (ids: string[]) =>
      attempt(() => reorderPicks(ids, tasks, now, zone), "move_pick", "Couldn't reorder today. Try again."),
    tidy: () => attempt(() => tidyPicks(tasks, now, zone), "tidy_today", "Couldn't tidy today. Try again."),
  };
}

/**
 * Today: up to three picks above the matrix (spec: tasks/spec-top-three.md section 4).
 * Quiet by design: it offers and never nags, and it never writes unless the person acts.
 */
export function TodayStrip({ tasks, onToggleComplete, onInspect }: TodayStripProps) {
  const today = useToday(tasks);
  const [tidyDismissed, setTidyDismissed] = useState(false);
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const act = useTodayHandlers(tasks, today.now, today.zone);

  // A row that unmounts takes keyboard focus with it, so land on the heading.
  const announce = (message: string, refocus = false) => {
    setStatus(message);
    if (refocus) headingRef.current?.focus();
  };
  const done = (ok: Promise<boolean>, message: string, refocus = false) =>
    ok.then((worked) => worked && announce(message, refocus));

  return (
    <section
      data-testid="today-strip"
      aria-label={`Today, ${today.picks.length} of ${MAX_PICKS}`}
      className="mb-4 space-y-2 rounded-lg border border-border bg-card p-3"
    >
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-base font-semibold text-foreground">Today</h2>
      <p role="status" data-testid="today-status" className="sr-only">{status}</p>
      {today.picks.length > 0 ? (
        <PickList
          picks={today.picks}
          onToggleComplete={async (task, completed) => {
            await onToggleComplete(task, completed);
            announce(`Completed ${task.title}`, true);
          }}
          onInspect={onInspect}
          onMove={(task, direction) => done(act.move(task, direction), `Moved ${task.title} ${direction}`)}
          onRemove={(task) => done(act.remove(task), `Removed ${task.title} from today`, true)}
          onReorder={(ids) => done(act.reorder(ids), "Reordered today")}
        />
      ) : null}
      {today.needsTidy && !tidyDismissed ? (
        <TidyOffer onTidy={() => done(act.tidy(), "Tidied today")} onDismiss={() => setTidyDismissed(true)} />
      ) : null}
      {today.hasFreeSlot ? <FreeSlotOffers today={today} onAdd={(task) => done(act.add(task), `Added ${task.title} to today`)} /> : null}
    </section>
  );
}
