"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_ESCALATION_WINDOW_DAYS,
  readEscalationWindow,
  subscribeEscalationWindow,
} from "@/lib/preferences/escalation-window";
import type { TaskRecord } from "@/lib/types";
import { deriveToday, type TodayView } from "./derive-today";

const ROLLOVER_PAD_MS = 1000;

/** Milliseconds until the next local midnight, plus a second so the date has turned. */
function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime() + ROLLOVER_PAD_MS;
}

/**
 * The current time, refreshed when the local date turns and when the tab comes
 * back to the foreground, so yesterday's picks stop counting without a reload.
 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setTimeout(refresh, msUntilMidnight(now));
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [now]);
  return now;
}

export function useToday(all: TaskRecord[]): TodayView & { now: Date; zone: string } {
  const now = useNow();
  const windowDays = useSyncExternalStore(
    subscribeEscalationWindow,
    readEscalationWindow,
    () => DEFAULT_ESCALATION_WINDOW_DAYS
  );
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const view = useMemo(() => deriveToday(all, now, windowDays, zone), [all, now, windowDays, zone]);
  return { ...view, now, zone };
}
