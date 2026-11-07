"use client";

import { useEffect, useMemo, useState } from "react";
import { stampLastSwept } from "@/lib/preferences/weekly-sweep";
import { sweepCards, type SweepCard } from "@/lib/weekly-sweep";
import type { TaskRecord } from "@/lib/types";

export interface SweepClock {
  now: Date;
  zone: string;
  /** Null when escalation is Off. */
  windowDays: number | null;
}

type Reason = SweepCard["reason"];

export interface SweepSession {
  status: "loading" | "card" | "end";
  card: { task: TaskRecord; reason: Reason } | null;
  /** "3 of 12". Position only, with no bar or percentage. */
  position: string;
  total: number;
  /** Next card. Skip and every finished action use it, and it writes nothing. */
  advance: () => void;
  /** Done: stamps last swept and ends the session. */
  done: () => void;
}

/**
 * The first card at or after `from` whose task still exists and still qualifies for a
 * card. A task completed, edited, or deleted elsewhere is skipped without a word.
 */
function findPlayable(
  cards: SweepCard[],
  from: number,
  byId: Map<string, TaskRecord>,
  clock: SweepClock
): { index: number; task: TaskRecord; reason: Reason } | null {
  for (let index = from; index < cards.length; index += 1) {
    const task = byId.get(cards[index].id);
    if (!task) continue;
    const [now] = sweepCards([task], clock.now, clock.windowDays, clock.zone);
    if (now) return { index, task, reason: now.reason };
  }
  return null;
}

type Playable = { index: number; task: TaskRecord; reason: Reason } | null;

/** What the screen shows: loading, the current card with its position, or the end. */
function describe(loading: boolean, atEnd: boolean, current: Playable, total: number) {
  const showing = !loading && !atEnd && current !== null;
  return {
    status: loading ? ("loading" as const) : atEnd ? ("end" as const) : ("card" as const),
    card: showing ? { task: current.task, reason: current.reason } : null,
    position: showing ? `${current.index + 1} of ${total}` : "",
  };
}

/**
 * One pass through the weekly sweep (spec: tasks/spec-weekly-sweep.md section 4). The
 * cards are computed once when it opens and later syncs don't reorder them. Opening,
 * skipping, and leaving write nothing. Only reaching the end, or Done, stamps this device.
 */
export function useSweepSession(all: TaskRecord[], isLoading: boolean, clock: SweepClock): SweepSession {
  const [cards, setCards] = useState<SweepCard[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [finished, setFinished] = useState(false);

  // Computed once, on the first render with tasks loaded. Later syncs don't reorder them.
  if (cards === null && !isLoading) setCards(sweepCards(all, clock.now, clock.windowDays, clock.zone));

  const current = useMemo(
    () => (cards ? findPlayable(cards, cursor, new Map(all.map((t) => [t.id, t])), clock) : null),
    [all, cards, clock, cursor]
  );
  const atEnd = cards !== null && (finished || current === null);

  useEffect(() => {
    // A sweep with nothing to do says so and ends, and stamps nothing.
    if (atEnd && !finished && cards && cards.length > 0) stampLastSwept(new Date());
  }, [atEnd, cards, finished]);

  const total = cards?.length ?? 0;
  return {
    ...describe(cards === null, atEnd, current, total),
    total,
    advance: () => setCursor((current?.index ?? cursor) + 1),
    done: () => {
      if (total > 0) stampLastSwept(new Date());
      setFinished(true);
    },
  };
}
