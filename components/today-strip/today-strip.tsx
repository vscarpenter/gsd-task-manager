"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ChevronDownIcon } from "lucide-react";
import { localDayOf } from "@/lib/due-date-presets";
import { deriveIntroStats, introDateLabel, introMessage } from "@/components/matrix-simplified/intro-copy";
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
  aside?: ReactNode;
  onFocusSchedule: () => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<boolean>;
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
// On narrower or shorter viewports the picks would push the Matrix out of view.
const COMPACT_VIEWPORT = "(width < 64rem), (height < 56rem)";
const DISCLOSURE_CONTROL =
  "touch-target inline-flex min-h-9 items-center gap-1.5 rounded-sm px-1 font-medium sm:px-2 hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function subscribeToViewport(onChange: () => void): () => void {
  const media = window.matchMedia(COMPACT_VIEWPORT);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isRoomyViewport(): boolean {
  return !window.matchMedia(COMPACT_VIEWPORT).matches;
}

function ScheduleShortcut({ tasks, onFocus }: { tasks: TaskRecord[]; onFocus: () => void }) {
  const count = tasks.reduce((total, task) => total + Number(!task.completed && !task.urgent && task.important), 0);
  const label = count === 0 ? "Schedule is empty" : `Schedule · ${count} ${count === 1 ? "task" : "tasks"}`;
  return (
    <button
      type="button"
      onClick={onFocus}
      aria-label={label}
      aria-keyshortcuts="Alt+2"
      title="Move focus to the Schedule quadrant (keyboard shortcut: Option 2)"
      className={`${DISCLOSURE_CONTROL} text-small text-accent`}
    >
      <span>{count === 0 ? "Schedule" : `Schedule · ${count}`}</span>
      <kbd aria-hidden="true" className="hidden rounded-xs border border-border px-1.5 py-px lg:inline pointer-coarse:hidden">⌥2</kbd>
    </button>
  );
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const announce = (message: string, refocus = false) => {
    setStatus(message);
    if (refocus) triggerRef.current?.focus();
  };
  return { status, triggerRef, announce };
}

interface TodayHeaderProps {
  now: Date;
  open: boolean;
  panelId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  children: ReactNode;
}

function TodayHeader({ now, open, panelId, triggerRef, onToggle, children }: TodayHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 sm:gap-x-2">
      <h2>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={(event) => {
            // Safari does not focus a button on pointer activation.
            event.currentTarget.focus({ preventScroll: true });
            onToggle();
          }}
          className={`group ${DISCLOSURE_CONTROL} text-body font-semibold text-foreground`}
        >
          Today
          <ChevronDownIcon className="size-4 shrink-0 text-foreground-muted group-aria-expanded:rotate-180" aria-hidden />
        </button>
      </h2>
      <time dateTime={localDayOf(now.toISOString())} className="min-w-0 flex-[1_1_2rem] wrap-anywhere text-small text-foreground-muted">{introDateLabel(now)}</time>
      {children}
    </div>
  );
}

type TodayPicksProps = Omit<TodayStripProps, "onFocusSchedule"> & {
  today: ReturnType<typeof useToday>;
  startOpen: boolean;
  announce: (message: string, refocus?: boolean) => void;
};

function TodayPicks({ tasks, today, aside, startOpen, announce, onToggleComplete, onInspect }: TodayPicksProps) {
  const tidyDismissed = useSyncExternalStore(tidyDismissal.subscribe, tidyDismissal.isDismissed, () => false);
  const act = useTodayHandlers(tasks, today.now, today.zone);
  const done = (ok: Promise<boolean>, message: string, refocus = false) =>
    ok.then((worked) => worked && announce(message, refocus));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-small text-foreground-muted">{introMessage(deriveIntroStats(tasks))}</p>
        {aside}
      </div>
      {today.picks.length > 0 ? (
        <PickList
          picks={today.picks}
          locked={today.needsTidy}
          onToggleComplete={async (task, completed) => {
            if (await onToggleComplete(task, completed)) announce(`Completed ${task.title}`, true);
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
      {today.hasFreeSlot ? <FreeSlotOffers today={today} startOpen={startOpen} onAdd={(task) => done(act.add(task), `Added ${task.title} to today`)} /> : null}
    </>
  );
}

/** The date and Schedule jump stay visible while the picks are folded away. */
export function TodayStrip({ tasks, onFocusSchedule, ...pickActions }: TodayStripProps) {
  const today = useToday(tasks);
  const { status, triggerRef, announce } = useAnnouncer();
  const pickRequested = usePickTodayRequest();
  const roomy = useSyncExternalStore(subscribeToViewport, isRoomyViewport, () => false);
  const [openOverride, setOpenOverride] = useState<boolean>();
  const open = openOverride ?? (pickRequested || roomy);
  const panelId = useId();

  return (
    <div data-testid="today-strip" className="mb-3 rounded-lg border border-border bg-card px-2 py-1">
      <TodayHeader now={today.now} open={open} panelId={panelId} triggerRef={triggerRef} onToggle={() => setOpenOverride(!open)}>
        <ScheduleShortcut tasks={tasks} onFocus={onFocusSchedule} />
      </TodayHeader>
      <p role="status" data-testid="today-status" className="sr-only">{status}</p>
      <section
        id={panelId}
        hidden={!open}
        aria-label={`Today, ${today.picks.length} of ${MAX_PICKS}`}
        onFocus={() => setOpenOverride(true)}
        className="mt-1 space-y-2 border-t border-border px-1 pb-2 pt-2"
      >
        {open ? <TodayPicks tasks={tasks} today={today} startOpen={pickRequested} announce={announce} {...pickActions} /> : null}
      </section>
    </div>
  );
}
