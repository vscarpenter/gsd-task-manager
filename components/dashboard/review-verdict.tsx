import type { ProductivityMetrics } from "@/lib/analytics";

export interface ReviewVerdictText {
  /** Factual lead — what closed in the last seven days. */
  lead: string;
  /** The single most notable true fact about what is still open. */
  observation: string;
}

/** "1 commitment" / "23 commitments". Numerals throughout, so the count carries the weight. */
function commitments(count: number): string {
  return `${count} commitment${count === 1 ? "" : "s"}`;
}

/**
 * First true fact wins: overdue outranks undated, which outranks full coverage.
 * The shape of active work by quadrant belongs to ReviewPrompts — stating it
 * here too would make both statements timid (brief, learned constraint 2).
 */
function observe(active: number, overdue: number, undated: number): string {
  if (active === 0) return "Nothing is still open.";
  if (overdue > 0) {
    return `${commitments(overdue)} slipped past ${overdue === 1 ? "its" : "their"} due date.`;
  }
  if (undated > 0) {
    const agreement = undated === 1 ? "has" : "have";
    return `${undated} of ${commitments(active)} still open ${agreement} no date yet.`;
  }
  return `${commitments(active)} still open, each with a date.`;
}

/**
 * Reduce the week to two plain sentences.
 *
 * Every branch is provable from ProductivityMetrics alone. `quadrantDistribution`
 * counts *active* tasks only, so the verdict never characterises the quadrant of
 * completed work — the same honesty constraint ReviewPrompts documents.
 */
export function buildReviewVerdict(metrics: ProductivityMetrics): ReviewVerdictText {
  const { completedThisWeek, activeTasks, overdueCount, noDueDateCount } = metrics;

  const lead =
    completedThisWeek === 0
      ? "Nothing closed this week."
      : `You closed ${commitments(completedThisWeek)} this week.`;

  return { lead, observation: observe(activeTasks, overdueCount, noDueDateCount) };
}

/**
 * The review's answer, in the house serif. This is the page's hero: a sentence
 * rather than a tinted metric tile, because a tile would restate a number the
 * stat rail already carries and read as the generic SaaS dashboard the brief
 * lists as an anti-reference.
 */
export function ReviewVerdict({ metrics }: { metrics: ProductivityMetrics }): React.ReactElement {
  const { lead, observation } = buildReviewVerdict(metrics);

  return (
    <div className="max-w-[34rem]">
      {/* text-pretty, not text-balance: balancing equalises the two lines, which
          parks the count alone at the end of line one — the worst break for a
          sentence whose whole job is to deliver that number. */}
      <h2 className="text-pretty text-h2 text-foreground sm:text-h1">{lead}</h2>
      <p className="mt-3 text-pretty text-h3 font-normal leading-snug text-foreground-muted">
        {observation}
      </p>
    </div>
  );
}
