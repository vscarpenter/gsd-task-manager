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

/** The card's escalation signal, live against the per-device window setting. */
export function useEscalation(task: TaskRecord): EscalationResult {
  const windowDays = useSyncExternalStore<EscalationWindow>(
    subscribeEscalationWindow,
    readEscalationWindow,
    () => DEFAULT_ESCALATION_WINDOW_DAYS
  );
  return evaluateEscalation(task, new Date(), windowDays, Intl.DateTimeFormat().resolvedOptions().timeZone);
}
