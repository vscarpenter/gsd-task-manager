"use client";

import { ArrowUpIcon } from "lucide-react";
import { escalationLabel, type EscalationResult } from "@/lib/escalation";
import { QUADRANT_INK } from "@/lib/quadrants";

const DESTINATION = { "urgent-important": "Do First", "urgent-not-important": "Delegate" } as const;

/** Same words as the card tag, plus where choosing an urgent quadrant sends the task. */
export function EscalationHint({ escalation }: { escalation?: EscalationResult }): React.ReactElement | null {
  if (!escalation?.escalating || escalation.daysUntilDue === null || !escalation.target) return null;
  const ink = QUADRANT_INK[escalation.target === "urgent-important" ? "q1" : "q3"];
  return (
    <p data-testid="edit-escalation-hint" className="mt-2 flex items-start gap-1.5 text-caption font-medium" style={{ color: ink }}>
      <ArrowUpIcon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>
        {escalationLabel(escalation.daysUntilDue)} Moves to {DESTINATION[escalation.target]}.
      </span>
    </p>
  );
}
