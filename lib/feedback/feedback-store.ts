import {
  CATEGORIES,
  SENTIMENTS,
  emptyDraft,
  type Category,
  type FeedbackDraft,
  type Sentiment,
} from "./feedback-payload";
import { isRoadmapSlug } from "./roadmap-items";

/**
 * Local draft state for the feedback section.
 *
 * Everything the user types or votes for lives here, in localStorage, until
 * they press Send. Nothing in this module touches the network.
 *
 * localStorage is best-effort: private browsing and quota limits can make both
 * reads and writes throw. Rather than lose the user's writing, every access is
 * wrapped and falls back to a module-level value that survives the session.
 */

export const FEEDBACK_DRAFT_KEY = "gsd:feedback:draft";
export const FEEDBACK_LAST_SENT_KEY = "gsd:feedback:last-sent";

let memoryDraft: FeedbackDraft | null = null;
let memoryLastSentAt: string | null = null;

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored, so the caller can keep a copy. */
function writeRaw(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do; the in-memory copy is already cleared.
  }
}

function isSentiment(value: unknown): value is Sentiment {
  return SENTIMENTS.includes(value as Sentiment);
}

function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}

/**
 * Rebuild a draft field by field rather than trusting the stored shape.
 *
 * An older build, a hand-edited value, or a future field could all put unknown
 * keys in storage; reconstructing means only known fields ever reach the draft.
 */
function coerceDraft(value: unknown): FeedbackDraft {
  if (typeof value !== "object" || value === null) return emptyDraft();
  const stored = value as Record<string, unknown>;

  return {
    sentiment: isSentiment(stored.sentiment) ? stored.sentiment : null,
    category: isCategory(stored.category) ? stored.category : null,
    message: typeof stored.message === "string" ? stored.message : "",
    votes: Array.isArray(stored.votes)
      ? [...new Set(stored.votes.filter((slug): slug is string => typeof slug === "string"))].filter(
          isRoadmapSlug,
        )
      : [],
  };
}

export function readDraft(): FeedbackDraft {
  const raw = readRaw(FEEDBACK_DRAFT_KEY);
  // An absent value means an absent draft. The in-memory copy stands in only
  // when a write actually failed — otherwise clearing site data in one tab
  // would resurrect a draft the user believed they had thrown away.
  if (raw === null) return memoryDraft ? { ...memoryDraft } : emptyDraft();

  try {
    return coerceDraft(JSON.parse(raw));
  } catch {
    return emptyDraft();
  }
}

export function writeDraft(draft: FeedbackDraft): void {
  const stored = writeRaw(FEEDBACK_DRAFT_KEY, JSON.stringify(draft));
  memoryDraft = stored ? null : { ...draft };
}

export function clearDraft(): void {
  memoryDraft = null;
  removeRaw(FEEDBACK_DRAFT_KEY);
}

/** Add or remove a vote. Returns a new draft; never mutates the input. */
export function toggleVote(draft: FeedbackDraft, slug: string): FeedbackDraft {
  if (!isRoadmapSlug(slug)) return draft;

  const votes = new Set(draft.votes);
  if (!votes.delete(slug)) votes.add(slug);

  return { ...draft, votes: [...votes] };
}

export function readLastSentAt(): string | null {
  return readRaw(FEEDBACK_LAST_SENT_KEY) ?? memoryLastSentAt;
}

export function writeLastSentAt(isoTimestamp: string): void {
  const stored = writeRaw(FEEDBACK_LAST_SENT_KEY, isoTimestamp);
  memoryLastSentAt = stored ? null : isoTimestamp;
}
