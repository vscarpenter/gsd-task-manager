"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { Button } from "@/components/ui/button";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { readEscalationWindow } from "@/lib/preferences/escalation-window";
import { useTasks } from "@/lib/use-tasks";
import { ROUTES } from "@/lib/routes";
import type { TaskRecord } from "@/lib/types";
import {
  completeTask,
  markUrgent,
  moveToQuadrant,
  removeTask,
  returnToMatrix,
  saveForLater,
  setDueDay,
} from "./sweep-actions";
import { SweepCard, type SweepCardHandlers } from "./sweep-card";
import { useSweepSession, type SweepSession } from "./use-sweep-session";

/** Where the end screen offers to go next: top three's suggestions, on a client where top three shipped. */
const PICK_TODAY_HREF = { pathname: ROUTES.HOME, query: { pickToday: "1" } };

function EndScreen({ onDone }: { onDone: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The card that had focus is gone, so land on the heading, which is how it gets announced.
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card px-6 py-10 text-center">
      <h2 ref={headingRef} tabIndex={-1} className="text-h2 text-foreground">That&apos;s the sweep.</h2>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={PICK_TODAY_HREF} onClick={onDone} className="btn btn-primary touch-target">
          Pick today&apos;s top three
        </Link>
        <Link href={ROUTES.HOME} onClick={onDone} className="btn btn-ghost touch-target">
          Back to the matrix
        </Link>
      </div>
    </div>
  );
}

/** Each card action runs the path the matrix already uses, then moves on only when it worked. */
function useSweepHandlers(session: SweepSession, task: TaskRecord | undefined): SweepCardHandlers | null {
  const { handleSuccess } = useErrorHandlerWithUndo();
  if (!task) return null;
  const run = async (action: () => Promise<boolean>) => {
    if (await action()) session.advance();
  };
  return {
    onComplete: () => run(() => completeTask(task, handleSuccess)),
    onMarkUrgent: () => run(() => markUrgent(task, handleSuccess)),
    onSave: () => run(() => saveForLater(task, handleSuccess)),
    onDelete: () => run(() => removeTask(task, handleSuccess)),
    onSkip: session.advance,
    onSetDay: (day) => run(() => setDueDay(task, day, handleSuccess)),
    onMove: (quadrant) => run(() => moveToQuadrant(task, quadrant, handleSuccess)),
    onReturn: (quadrant) => run(() => returnToMatrix(task, quadrant, handleSuccess)),
  };
}

/** The weekly sweep: one task at a time through what needs a decision (spec: tasks/spec-weekly-sweep.md). */
export default function SweepPage() {
  const router = useRouter();
  const { all, isLoading } = useTasks();
  // The clock and window are fixed when the sweep opens, as the cards are.
  const [clock] = useState(() => ({
    now: new Date(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    windowDays: readEscalationWindow(),
  }));
  const session = useSweepSession(all, isLoading, clock);
  const { card } = session;
  const handlers = useSweepHandlers(session, card?.task);

  return (
    <AppShell title="Weekly sweep">
      <div className="mx-auto max-w-2xl space-y-4">
        <p role="status" aria-live="polite" className="text-small text-foreground-muted">
          {session.status === "card" ? session.position : ""}
        </p>
        {session.status === "loading" ? <p className="py-8 text-foreground-muted">Loading…</p> : null}
        {card && handlers ? <SweepCard key={card.task.id} task={card.task} reason={card.reason} handlers={handlers} /> : null}
        {session.status === "end" ? <EndScreen onDone={session.done} /> : null}
        {session.status === "card" ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                session.done();
                router.push(ROUTES.HOME);
              }}
            >
              Done
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
