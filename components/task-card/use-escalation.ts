"use client";

import { useSyncExternalStore } from "react";
import { evaluateEscalation, type EscalationResult } from "@/lib/escalation";
import {
  DEFAULT_ESCALATION_WINDOW_DAYS,
  readEscalationWindow,
  subscribeEscalationWindow,
  type EscalationWindow,
} from "@/lib/preferences/escalation-window";
import type { TaskRecord } from "@/lib/types";

const RESYNC_AFTER_MIDNIGHT_MS = 1000;

/** Local calendar day as a snapshot, so a new day re-renders every card. */
function readLocalDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

/** Fires at the next local midnight, and when a suspended tab or window wakes up. */
function subscribeLocalDay(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const armMidnight = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(() => {
      onChange();
      armMidnight();
    }, midnight.getTime() - now.getTime() + RESYNC_AFTER_MIDNIGHT_MS);
  };
  armMidnight();
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
  };
}

/** The card's escalation signal, live against the per-device window and the local day. */
export function useEscalation(task: TaskRecord): EscalationResult {
  const windowDays = useSyncExternalStore<EscalationWindow>(
    subscribeEscalationWindow,
    readEscalationWindow,
    () => DEFAULT_ESCALATION_WINDOW_DAYS
  );
  useSyncExternalStore(subscribeLocalDay, readLocalDay, () => "");
  return evaluateEscalation(task, new Date(), windowDays, Intl.DateTimeFormat().resolvedOptions().timeZone);
}
