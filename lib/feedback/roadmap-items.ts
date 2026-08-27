/**
 * Candidate features users can vote for in Settings → Feedback.
 *
 * Deliberately a hardcoded constant rather than a server-fetched list: it keeps
 * the Settings page free of any network read, works offline, and means the
 * feedback collection is write-only from the client's point of view.
 *
 * Curating this list is a one-line edit here plus a deploy. Removing an item is
 * safe — `buildPayload` filters stored votes against these slugs, so a vote for
 * a retired feature is dropped rather than sent as an unknown value.
 */
export interface RoadmapItem {
  /** Stable identifier sent in the payload. Never reuse a retired slug. */
  slug: string;
  label: string;
  description: string;
}

export const ROADMAP_ITEMS: readonly RoadmapItem[] = [
  {
    slug: "natural-language-dates",
    label: "Natural-language due dates",
    description: "Type \"next tuesday 3pm\" in the capture bar and have it understood.",
  },
  {
    slug: "calendar-sync",
    label: "Two-way calendar sync",
    description: "See scheduled tasks on your calendar, and calendar events in the matrix.",
  },
  {
    slug: "task-templates",
    label: "Reusable task templates",
    description: "Save a set of tasks you create repeatedly and drop them in with one action.",
  },
  {
    slug: "weekly-review",
    label: "Guided weekly review",
    description: "A short end-of-week pass over what moved, what stalled, and what to reclassify.",
  },
  {
    slug: "focus-timer",
    label: "Focus timer",
    description: "Start a timed run at a single task without leaving the matrix.",
  },
  {
    slug: "task-notes",
    label: "Longer notes on a task",
    description: "Room for context beyond a title — links, scratch thinking, and attachments.",
  },
  {
    slug: "ios-widgets",
    label: "iOS home-screen widgets",
    description: "Your Do First quadrant on the home screen, without opening the app.",
  },
  {
    slug: "shared-lists",
    label: "Share one list with one person",
    description: "A single shared quadrant for a partner or teammate, still local-first.",
  },
] as const;

const ROADMAP_SLUGS: ReadonlySet<string> = new Set(ROADMAP_ITEMS.map((item) => item.slug));

/** True when the slug is one this build actually ships. */
export function isRoadmapSlug(slug: string): boolean {
  return ROADMAP_SLUGS.has(slug);
}
