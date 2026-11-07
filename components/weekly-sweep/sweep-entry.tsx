"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { readEscalationWindow, subscribeEscalationWindow, DEFAULT_ESCALATION_WINDOW_DAYS } from "@/lib/preferences/escalation-window";
import { readLastSwept } from "@/lib/preferences/weekly-sweep";
import { ROUTES } from "@/lib/routes";
import { entryShown, sweepCards } from "@/lib/weekly-sweep";
import type { TaskRecord } from "@/lib/types";

/**
 * A quiet "Weekly sweep" line above the matrix while the sweep has something to ask
 * and this device hasn't swept in seven local days (spec: tasks/spec-weekly-sweep.md
 * section 6). It states no count and never nags.
 */
export function SweepEntry({ tasks }: { tasks: TaskRecord[] }) {
  const windowDays = useSyncExternalStore(
    subscribeEscalationWindow,
    readEscalationWindow,
    () => DEFAULT_ESCALATION_WINDOW_DAYS
  );
  const show = useMemo(() => {
    const now = new Date();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return entryShown(readLastSwept(), sweepCards(tasks, now, windowDays, zone).length, now, zone);
  }, [tasks, windowDays]);
  if (!show) return null;
  return (
    <p className="mb-3 text-small text-foreground-muted">
      <Link href={ROUTES.SWEEP} className="touch-target inline-flex items-center underline underline-offset-4 hover:text-foreground">
        Weekly sweep
      </Link>
    </p>
  );
}
