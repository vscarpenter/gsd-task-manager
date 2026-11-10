"use client";

import { lazy, Suspense } from "react";

import type { TaskRecord } from "@/lib/types";
import { deriveIntroStats, introDateLabel, introMessage } from "./intro-copy";
import { MatrixIntro } from "./matrix-intro";

// Never part of the first paint: it renders only after hydration and a loaded
// task list, so its code stays off the matrix's first-load budget.
const WhatsNewCue = lazy(() => import("./whats-new-cue").then((m) => ({ default: m.WhatsNewCue })));

interface MatrixBriefingProps {
  tasks: TaskRecord[];
  mounted: boolean;
  isLoading: boolean;
  onFocusSchedule: () => void;
}

function countActiveSchedule(tasks: TaskRecord[]): number {
  return tasks.reduce(
    (count, task) => count + (!task.completed && !task.urgent && task.important ? 1 : 0),
    0
  );
}

/**
 * The top of the matrix: the intro briefing, then the What's New line when an
 * update has one. Both render only after hydration so the prerendered static
 * export never bakes in a build-time date or an empty-board message computed
 * before IndexedDB has loaded.
 */
export function MatrixBriefing({ tasks, mounted, isLoading, onFocusSchedule }: MatrixBriefingProps) {
  const introReady = mounted && !isLoading;
  const introStats = introReady ? deriveIntroStats(tasks) : null;

  return (
    <>
      <MatrixIntro
        dateLabel={mounted ? introDateLabel(new Date()) : null}
        message={introStats ? introMessage(introStats) : null}
        scheduleCount={introReady ? countActiveSchedule(tasks) : null}
        onFocusSchedule={onFocusSchedule}
      />
      <Suspense fallback={null}>
        <WhatsNewCue existingUser={introReady ? tasks.length > 0 : null} />
      </Suspense>
    </>
  );
}
