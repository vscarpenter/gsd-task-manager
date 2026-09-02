import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { subDays } from "date-fns";
import { FeedbackNudge } from "@/components/dashboard/feedback-nudge";
import { emptyDraft } from "@/lib/feedback/feedback-payload";
import {
  FEEDBACK_DRAFT_KEY,
  FEEDBACK_LAST_SENT_KEY,
  FEEDBACK_NUDGE_DISMISSED_KEY,
  clearDraft,
  writeDraft,
  writeLastSentAt,
} from "@/lib/feedback/feedback-store";
import type { TaskRecord } from "@/lib/types";
import { createMockTask } from "@/tests/fixtures";

const COMPLETIONS = 10;
const DISTINCT_DAYS = 5;
const TENURE_DAYS = 20;

/** Twenty days of history with ten completions spread over five days. */
function returningUserTasks(): TaskRecord[] {
  const now = new Date();
  return Array.from({ length: COMPLETIONS }, (_, index) => {
    const finished = subDays(now, 1 + (index % DISTINCT_DAYS) * 2).toISOString();
    return createMockTask({
      id: `done-${index}`,
      completed: true,
      createdAt: subDays(now, TENURE_DAYS).toISOString(),
      completedAt: finished,
      updatedAt: finished,
    });
  });
}

beforeEach(() => {
  // localStorage.clear() no-ops in jsdom under Bun; remove keys individually.
  localStorage.removeItem(FEEDBACK_DRAFT_KEY);
  localStorage.removeItem(FEEDBACK_LAST_SENT_KEY);
  localStorage.removeItem(FEEDBACK_NUDGE_DISMISSED_KEY);
  // The store caches its snapshot at module scope; clearing notifies and drops it.
  clearDraft();
});

describe("FeedbackNudge", () => {
  it("renders nothing for a newcomer", () => {
    render(<FeedbackNudge tasks={[createMockTask()]} />);

    expect(screen.queryByTestId("feedback-nudge")).not.toBeInTheDocument();
  });

  it("invites a returning user with a link to the feedback section", () => {
    render(<FeedbackNudge tasks={returningUserTasks()} />);

    expect(screen.getByTestId("feedback-nudge")).toHaveTextContent(/anonymous/i);
    expect(screen.getByRole("link", { name: "Send feedback" })).toHaveAttribute(
      "href",
      "/settings#feedback",
    );
  });

  it("marks both controls as interactive at rest, not only on hover", () => {
    render(<FeedbackNudge tasks={returningUserTasks()} />);

    // Hue alone cannot separate the tide link from the muted sentence beside it
    // (WCAG 1.4.1), so the underline has to be there before anyone hovers.
    expect(screen.getByRole("link", { name: "Send feedback" })).toHaveClass("underline");
    expect(screen.getByRole("button", { name: "Not now" })).toHaveClass("underline");
  });

  it("moves focus to the main content when dismissed from the keyboard", () => {
    render(
      <>
        <main id="main-content" tabIndex={-1} />
        <FeedbackNudge tasks={returningUserTasks()} />
      </>,
    );
    const button = screen.getByRole("button", { name: "Not now" });
    button.focus();

    fireEvent.click(button);

    // The button unmounts itself; without a hand-off focus would land on <body>.
    expect(document.getElementById("main-content")).toHaveFocus();
  });

  it("hides after Not now and remembers the dismissal", () => {
    render(<FeedbackNudge tasks={returningUserTasks()} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByTestId("feedback-nudge")).not.toBeInTheDocument();
    expect(localStorage.getItem(FEEDBACK_NUDGE_DISMISSED_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("stays quiet when feedback was sent recently", () => {
    writeLastSentAt(new Date().toISOString());

    render(<FeedbackNudge tasks={returningUserTasks()} />);

    expect(screen.queryByTestId("feedback-nudge")).not.toBeInTheDocument();
  });

  it("stays quiet while a draft is in progress", () => {
    writeDraft({ ...emptyDraft(), message: "half a thought" });

    render(<FeedbackNudge tasks={returningUserTasks()} />);

    expect(screen.queryByTestId("feedback-nudge")).not.toBeInTheDocument();
  });
});
