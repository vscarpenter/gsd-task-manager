"use client";

import type { QuadrantId } from "@/lib/types";
import { QUADRANT_INK } from "@/lib/quadrants";

interface ReviewPromptsProps {
  distribution: Record<QuadrantId, number>;
}

const PROMPTS = [
  {
    quadrant: "urgent-important" as const,
    label: "Q1 · Do First",
    question: "What still needs an answer?",
    rdKey: "q1" as const,
    destination: "Do First",
  },
  {
    quadrant: "not-urgent-important" as const,
    label: "Q2 · Schedule",
    question: "What received protected time?",
    rdKey: "q2" as const,
    destination: "Schedule",
  },
  {
    quadrant: "not-urgent-not-important" as const,
    label: "Q4 · Eliminate",
    question: "What can leave the list?",
    rdKey: "q4" as const,
    destination: "Eliminate",
  },
] as const;

function activeCount(count: number, destination: string): string {
  return `${count} active commitment${count === 1 ? "" : "s"} in ${destination}.`;
}

/**
 * Reflection cues for the three decisions a weekly review should produce:
 * answer urgent work, protect strategic work, and release low-value work.
 * Counts intentionally describe active tasks only; the current analytics model
 * does not claim whether a task received time or was reviewed.
 */
export function ReviewPrompts({ distribution }: ReviewPromptsProps): React.ReactElement {
  return (
    <section
      aria-labelledby="review-prompts-title"
      className="border-y border-border/70 py-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Reflection prompts</p>
          <h3
            id="review-prompts-title"
            className="mt-2 text-h3 text-foreground"
          >
            Look at the shape of active work.
          </h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-foreground-muted sm:text-right">
          Notice what is asking for attention before deciding what comes next.
        </p>
      </div>

      <div className="mt-5 grid divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
        {PROMPTS.map((prompt) => {
          const count = distribution[prompt.quadrant];
          return (
            <article
              key={prompt.quadrant}
              className="py-5 first:pt-0 last:pb-0 md:px-6 md:py-0 md:first:pl-0 md:last:pr-0"
            >
              <p
                className="text-label font-semibold uppercase tracking-wide"
                style={{ color: QUADRANT_INK[prompt.rdKey] }}
              >
                {prompt.label}
              </p>
              <h4 className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
                {prompt.question}
              </h4>
              <p className="mt-2 text-sm tabular-nums text-foreground-muted">
                {activeCount(count, prompt.destination)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
