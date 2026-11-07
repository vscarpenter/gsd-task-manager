"use client";

import type { TaskRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface TidyOfferProps {
  onTidy: () => void;
  onDismiss: () => void;
}

export function TidyOffer({ onTidy, onDismiss }: TidyOfferProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-foreground-muted">
      <p>Two devices picked for today. Tidy up?</p>
      <Button variant="subtle" onClick={onTidy}>Tidy</Button>
      <Button variant="ghost" onClick={onDismiss}>Not now</Button>
    </div>
  );
}

interface OfferListProps {
  heading: string | null;
  tasks: TaskRecord[];
  onAdd: (task: TaskRecord) => void;
}

/** Carry-over and suggestions share one shape: a quiet list with an Add to today on each row. */
export function OfferList({ heading, tasks, onAdd }: OfferListProps) {
  if (tasks.length === 0) return null;
  return (
    <div aria-label={heading ?? "Suggestions for today"} role="group">
      {heading ? <h3 className="mb-1 text-xs font-medium text-foreground-muted">{heading}</h3> : null}
      <ul className="space-y-1">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 text-small">
            <span className="min-w-0 truncate text-foreground">{task.title}</span>
            <Button
              variant="ghost"
              aria-label={`Add to today: ${task.title}`}
              onClick={() => onAdd(task)}
            >
              Add to today
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
