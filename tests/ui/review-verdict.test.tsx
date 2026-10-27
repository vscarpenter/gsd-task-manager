import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewVerdict, buildReviewVerdict } from "@/components/dashboard/review-verdict";
import type { ProductivityMetrics } from "@/lib/analytics";

/**
 * The verdict is the dashboard's hero: one factual sentence about what was completed,
 * followed by the single most notable true fact about what remains. Every branch
 * must be provable from ProductivityMetrics alone — the analytics model does not
 * record the quadrant of completed work, so the verdict never claims it.
 */
function metrics(overrides: Partial<ProductivityMetrics> = {}): ProductivityMetrics {
  return {
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    activeStreak: 0,
    longestStreak: 0,
    completionRate: 0,
    quadrantDistribution: {
      "urgent-important": 0,
      "not-urgent-important": 0,
      "urgent-not-important": 0,
      "not-urgent-not-important": 0,
    },
    tagStats: [],
    overdueCount: 0,
    dueTodayCount: 0,
    dueThisWeekCount: 0,
    noDueDateCount: 0,
    activeTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
    ...overrides,
  };
}

describe("buildReviewVerdict", () => {
  describe("lead — what was completed this week", () => {
    it("names an empty week without judgement", () => {
      expect(buildReviewVerdict(metrics()).lead).toBe("Nothing completed this week.");
    });

    it("uses the singular noun for a single completion", () => {
      expect(buildReviewVerdict(metrics({ completedThisWeek: 1 })).lead).toBe(
        "You completed 1 task this week."
      );
    });

    it("uses the plural noun beyond one", () => {
      expect(buildReviewVerdict(metrics({ completedThisWeek: 23 })).lead).toBe(
        "You completed 23 tasks this week."
      );
    });
  });

  describe("observation — the one fact worth noticing about what remains", () => {
    it("reports a clear matrix when nothing is open", () => {
      const verdict = buildReviewVerdict(metrics({ completedThisWeek: 5, completedTasks: 5 }));
      expect(verdict.observation).toBe("Nothing is still open.");
    });

    it("ranks overdue work above every other observation", () => {
      const verdict = buildReviewVerdict(
        metrics({ activeTasks: 10, overdueCount: 3, noDueDateCount: 6 })
      );
      expect(verdict.observation).toBe("3 tasks are past their due date.");
    });

    it("uses singular agreement for a single overdue task", () => {
      const verdict = buildReviewVerdict(metrics({ activeTasks: 4, overdueCount: 1 }));
      expect(verdict.observation).toBe("1 task is past its due date.");
    });

    it("falls through to undated work when nothing is overdue", () => {
      const verdict = buildReviewVerdict(metrics({ activeTasks: 41, noDueDateCount: 14 }));
      expect(verdict.observation).toBe("14 of 41 tasks still open have no due date.");
    });

    it("uses singular agreement for a single undated task", () => {
      const verdict = buildReviewVerdict(metrics({ activeTasks: 5, noDueDateCount: 1 }));
      expect(verdict.observation).toBe("1 of 5 tasks still open has no due date.");
    });

    it("confirms full coverage when every open task carries a due date", () => {
      const verdict = buildReviewVerdict(metrics({ activeTasks: 7 }));
      expect(verdict.observation).toBe("7 tasks still open, each with a due date.");
    });
  });

  it("never claims the quadrant of completed work", () => {
    const verdict = buildReviewVerdict(
      metrics({
        completedThisWeek: 9,
        activeTasks: 12,
        quadrantDistribution: {
          "urgent-important": 8,
          "not-urgent-important": 4,
          "urgent-not-important": 0,
          "not-urgent-not-important": 0,
        },
      })
    );
    const sentence = `${verdict.lead} ${verdict.observation}`;
    expect(sentence).not.toMatch(/scheduled|urgent|important|quadrant/i);
  });
});

describe("ReviewVerdict", () => {
  it("renders the verdict as the page's leading heading", () => {
    render(<ReviewVerdict metrics={metrics({ completedThisWeek: 23, activeTasks: 41, noDueDateCount: 14 })} />);

    expect(
      screen.getByRole("heading", { name: "You completed 23 tasks this week." })
    ).toBeInTheDocument();
    expect(screen.getByText("14 of 41 tasks still open have no due date.")).toBeInTheDocument();
  });
});
