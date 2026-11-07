"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TaskRecord } from "@/lib/types";
import { MAX_PICKS } from "@/lib/top-three";
import { movePick, removeFromToday, reorderPicks, tidyPicks } from "@/lib/tasks/top-three-actions";
import { tidyDismissal } from "@/lib/top-three-session";
import { addAndReport } from "./add-feedback";
import { reportTaskMutationError } from "@/components/matrix-simplified/task-actions";
import { OfferList, TidyOffer } from "./today-offers";
import { PickList } from "./today-rows";
import type { TodayView } from "./derive-today";
import { useToday } from "./use-today";

export interface TodayStripProps {
  tasks: TaskRecord[];
  /** Shares the header row, right-aligned, so a quiet link costs no extra height above the matrix. */
  aside?: React.ReactNode;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onInspect: (task: TaskRecord) => void;
}

/** Runs a write and reports a failure the way every other task action does. Resolves true when the write took effect. */
async function attempt(run: () => Promise<unknown>, action: string, message: string): Promise<boolean> {
  try {
    return (await run()) !== false;
  } catch (error) {
    reportTaskMutationError(error, action, message);
    return false;
  }
}

const PICK_TODAY_PARAM = "pickToday";

/** True when the weekly sweep's end screen sent the person here to pick for today. */
function wantsPickToday(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has(PICK_TODAY_PARAM);
}

/** Drops the one-shot parameter and keeps the rest of the address. Safe to run twice. */
function clearPickTodayParam(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(PICK_TODAY_PARAM)) return;
  params.delete(PICK_TODAY_PARAM);
  const query = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

/** Whether the sweep asked for the suggestions. Read once, then cleared, so a StrictMode re-run keeps the request. */
function usePickTodayRequest(): boolean {
  const [requested] = useState(wantsPickToday);
  useEffect(clearPickTodayParam, []);
  return requested;
}

function FreeSlotOffers({ today, onAdd, startOpen }: { today: TodayView; onAdd: (task: TaskRecord) => void; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
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
      {open && today.suggestions.length === 0 ? (
        <p className="text-small text-foreground-muted">Nothing to suggest right now.</p>
      ) : null}
      {open ? <OfferList heading={null} tasks={today.suggestions} onAdd={onAdd} /> : null}
    </>
  );
}

function useTodayHandlers(tasks: TaskRecord[], now: Date, zone: string) {
  return {
    add: (task: TaskRecord) =>
      attempt(() => addAndReport(task.id, tasks, now, zone), "add_to_today", "Couldn't add to today. Try again."),
    move: (task: TaskRecord, direction: "up" | "down") =>
      attempt(() => movePick(task.id, direction, tasks, now, zone), "move_pick", "Couldn't reorder today. Try again."),
    remove: (task: TaskRecord) =>
      attempt(() => removeFromToday(task.id), "remove_from_today", "Couldn't remove that from today. Try again."),
    reorder: (ids: string[]) =>
      attempt(() => reorderPicks(ids, tasks, now, zone), "move_pick", "Couldn't reorder today. Try again."),
    tidy: () => attempt(() => tidyPicks(tasks, now, zone), "tidy_today", "Couldn't tidy today. Try again."),
  };
}

/** The status-region message, and a way to land focus on the heading after a row unmounts. */
function useAnnouncer() {
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const announce = (message: string, refocus = false) => {
    setStatus(message);
    if (refocus) headingRef.current?.focus();
  };
  const done = (ok: Promise<boolean>, message: string, refocus = false) =>
    ok.then((worked) => worked && announce(message, refocus));
  return { status, headingRef, announce, done };
}

/**
 * Today: up to three picks above the matrix (spec: tasks/spec-top-three.md section 4).
 * Quiet by design: it offers and never nags, and it never writes unless the person acts.
 */
export function TodayStrip({ tasks, aside, onToggleComplete, onInspect }: TodayStripProps) {
  const today = useToday(tasks);
  const tidyDismissed = useSyncExternalStore(tidyDismissal.subscribe, tidyDismissal.isDismissed, () => false);
  const { status, headingRef, announce, done } = useAnnouncer();
  const pickRequested = usePickTodayRequest();
  const act = useTodayHandlers(tasks, today.now, today.zone);

  return (
    <div data-testid="today-strip" className="mb-4 space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-base font-semibold text-foreground">Today</h2>
        {aside}
      </div>
      <p role="status" data-testid="today-status" className="sr-only">{status}</p>
      <section aria-label={`Today, ${today.picks.length} of ${MAX_PICKS}`} className="space-y-2">
        {today.picks.length > 0 ? (
          <PickList
            picks={today.picks}
            locked={today.needsTidy}
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
          <TidyOffer onTidy={() => done(act.tidy(), "Tidied today")} onDismiss={tidyDismissal.dismiss} />
        ) : null}
        {today.hasFreeSlot ? <FreeSlotOffers today={today} startOpen={pickRequested} onAdd={(task) => done(act.add(task), `Added ${task.title} to today`)} /> : null}
      </section>
    </div>
  );
}
