"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROADMAP_ITEMS, type RoadmapItem } from "@/lib/feedback/roadmap-items";

interface VoteButtonProps {
  item: RoadmapItem;
  isVoted: boolean;
  onToggle: () => void;
}

/**
 * One candidate feature.
 *
 * A button rather than a checkbox because the whole row is the target — at
 * 44px minimum on coarse pointers, per WCAG 2.5.5. `aria-pressed` carries the
 * state, so the checkmark is decoration rather than the only signal.
 */
function RoadmapVoteButton({ item, isVoted, onToggle }: VoteButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isVoted}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
        "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isVoted
          ? "border-accent/40 bg-accent/8"
          : "border-border/70 bg-transparent hover:bg-background-muted/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          isVoted
            ? "border-accent bg-accent text-background"
            : "border-border text-foreground-muted",
        )}
      >
        {isVoted ? <CheckIcon className="h-3 w-3" /> : <PlusIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-foreground-muted">
          {item.description}
        </span>
      </span>
    </button>
  );
}

interface FeedbackRoadmapPollProps {
  votes: string[];
  onToggle: (slug: string) => void;
}

/** The roadmap poll: one toggle per candidate feature. */
export function FeedbackRoadmapPoll({ votes, onToggle }: FeedbackRoadmapPollProps) {
  const voted = new Set(votes);

  return (
    <div className="px-4 py-3.5">
      <p className="text-sm font-medium text-foreground">What should come next?</p>
      <p className="mt-0.5 text-xs text-foreground-muted">
        Pick as many as you like. Nothing is sent until you press Send.
      </p>

      <ul className="mt-3 space-y-1.5">
        {ROADMAP_ITEMS.map((item) => (
          <li key={item.slug}>
            <RoadmapVoteButton
              item={item}
              isVoted={voted.has(item.slug)}
              onToggle={() => onToggle(item.slug)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
