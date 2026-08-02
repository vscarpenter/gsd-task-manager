/**
 * Pure copy derivation for the matrix intro briefing.
 *
 * The h1 date label and the one-sentence state reading live here so the copy
 * rules stay unit-testable and MatrixIntro stays presentational. Rules are
 * priority-ordered. The subtext never mentions Q2 (the Protect Q2 card owns
 * that topic) and never repeats the header pills' raw counts — it interprets
 * state the pills can't (where overdue work sits, how the day leans).
 */

import { quadrantForTask } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";

export interface IntroStats {
  activeTotal: number;
  doFirstCount: number;
  overdueTotal: number;
  /** Titles of quadrants holding at least one overdue task, deduped, first-seen order. */
  overdueQuadrants: string[];
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function introDateLabel(now: Date): string {
  return DATE_FORMAT.format(now);
}

export function deriveIntroStats(all: TaskRecord[], todayIso: string): IntroStats {
  let activeTotal = 0;
  let doFirstCount = 0;
  let overdueTotal = 0;
  const overdueQuadrants: string[] = [];

  for (const task of all) {
    if (task.completed) continue;
    activeTotal += 1;
    const meta = quadrantForTask(task.urgent, task.important);
    if (meta.rdKey === "q1") doFirstCount += 1;
    if (task.dueDate && task.dueDate < todayIso) {
      overdueTotal += 1;
      if (!overdueQuadrants.includes(meta.title)) {
        overdueQuadrants.push(meta.title);
      }
    }
  }

  return { activeTotal, doFirstCount, overdueTotal, overdueQuadrants };
}

export function introMessage(stats: IntroStats): string {
  if (stats.activeTotal === 0) {
    return "The board is clear. Capture the first thing on your mind below.";
  }
  if (stats.overdueTotal > 0) {
    if (stats.overdueQuadrants.length === 1) {
      const quadrant = stats.overdueQuadrants[0];
      if (stats.overdueTotal === 1) return `The overdue task sits in ${quadrant}.`;
      if (stats.overdueTotal === 2) return `Both overdue tasks sit in ${quadrant}.`;
      return `All ${stats.overdueTotal} overdue tasks sit in ${quadrant}.`;
    }
    return `${stats.overdueTotal} tasks are past their dates — give them a fresh decision.`;
  }
  if (stats.activeTotal >= 3 && stats.doFirstCount * 2 > stats.activeTotal) {
    return "Today leans urgent: most of the list sits in Do First.";
  }
  return "Nothing overdue. Everything on the board is there by choice.";
}
