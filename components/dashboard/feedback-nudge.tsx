"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { isDraftEmpty } from "@/lib/feedback/feedback-payload";
import {
  getFeedbackSnapshot,
  getServerFeedbackSnapshot,
  recordNudgeDismissed,
  subscribeToFeedback,
} from "@/lib/feedback/feedback-store";
import { shouldShowFeedbackNudge, summarizeEngagement } from "@/lib/feedback/nudge-eligibility";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import type { TaskRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

// Underlined at rest, not on hover: the tide link sits beside muted text at
// roughly 1.1:1 luminance contrast, so hue alone cannot mark it as a link
// (WCAG 1.4.1), and "Not now" has no colour of its own to lean on.
const CONTROL_CLASS =
  "touch-target inline-flex items-center rounded-xs underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface FeedbackNudgeProps {
  tasks: TaskRecord[];
}

/** Hand focus to the main region first: the pressed button is about to unmount. */
function dismissNudge(): void {
  restoreFocusOrMainContent(null);
  recordNudgeDismissed(new Date().toISOString());
}

/**
 * One sentence at the foot of the review header inviting feedback.
 *
 * It appears only for people whose own task history says they have used GSD
 * long enough to have a view (see `nudge-eligibility.ts`), and it is a line of
 * text rather than a toast or a modal because the Review page is the one place
 * where "is this tool working for you?" is on topic instead of an interruption.
 * "Not now" is remembered for six months, and sending feedback quiets it too.
 * Dismissing unmounts the very button that was pressed, so focus is handed to
 * the main region first rather than being dropped on <body>.
 *
 * Eligibility is read through the feedback store's external snapshot so the
 * static export renders nothing and the client fills in after hydration
 * without a state-setting effect.
 */
export function FeedbackNudge({ tasks }: FeedbackNudgeProps): React.ReactElement | null {
  const state = useSyncExternalStore(
    subscribeToFeedback,
    getFeedbackSnapshot,
    getServerFeedbackSnapshot,
  );
  const now = new Date();

  const visible = shouldShowFeedbackNudge({
    engagement: summarizeEngagement(tasks, now),
    lastSentAt: state.lastSentAt,
    dismissedAt: state.nudgeDismissedAt,
    hasDraft: !isDraftEmpty(state.draft),
    now,
  });

  if (!visible) return null;

  return (
    <div
      data-testid="feedback-nudge"
      className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm leading-relaxed text-foreground-muted"
    >
      <span>
        You&rsquo;ve been at this a while. If something is rough or missing, tell me: it&rsquo;s
        anonymous and takes about a minute.
      </span>
      <Link href="/settings#feedback" className={cn(CONTROL_CLASS, "text-accent")}>
        Send feedback
      </Link>
      <button
        type="button"
        onClick={dismissNudge}
        className={cn(CONTROL_CLASS, "text-foreground-muted hover:text-foreground")}
      >
        Not now
      </button>
    </div>
  );
}
