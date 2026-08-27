import { z } from "zod";
import { isRoadmapSlug, ROADMAP_ITEMS } from "./roadmap-items";

/**
 * The single place that decides what leaves the device.
 *
 * `buildPayload` is pure — submission id, app version, and timestamp are all
 * injected — so the preview shown to the user before they press Send is
 * literally the same object that gets serialized into the request body. The two
 * cannot drift, which is the whole point: "here's what we send" UI normally
 * rots the moment someone adds a field to the request.
 *
 * Nothing here reads the task database, the sync config, or the auth store.
 * See `tests/data/feedback-payload.test.ts`, which asserts exactly that.
 */

export const MAX_MESSAGE_LENGTH = 1000;

export const SENTIMENTS = ["up", "down"] as const;
export const CATEGORIES = ["idea", "praise", "gripe", "bug"] as const;

export type Sentiment = (typeof SENTIMENTS)[number];
export type Category = (typeof CATEGORIES)[number];

/** Local, unsent state. Lives in localStorage; never touches the network. */
export interface FeedbackDraft {
  sentiment: Sentiment | null;
  category: Category | null;
  message: string;
  votes: string[];
}

/**
 * Every key the payload may contain. Pinned in a test so that adding a field
 * without updating the disclosure becomes a failure rather than a silent leak.
 */
export const PAYLOAD_FIELDS = [
  "submission_id",
  "sentiment",
  "category",
  "message",
  "votes",
  "app_version",
  "client_submitted_at",
] as const;

export const feedbackPayloadSchema = z
  .object({
    submission_id: z.string().min(1).max(64),
    sentiment: z.enum(SENTIMENTS).or(z.literal("")),
    category: z.enum(CATEGORIES).or(z.literal("")),
    message: z.string().max(MAX_MESSAGE_LENGTH),
    votes: z.array(z.string()).max(ROADMAP_ITEMS.length),
    app_version: z.string().max(20),
    client_submitted_at: z.string().min(1),
  })
  .strict();

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

export interface BuildPayloadOptions {
  submissionId: string;
  appVersion: string;
  submittedAt: string;
}

export function emptyDraft(): FeedbackDraft {
  return { sentiment: null, category: null, message: "", votes: [] };
}

/** True when there is nothing worth sending, so Send stays disabled. */
export function isDraftEmpty(draft: FeedbackDraft): boolean {
  return (
    draft.sentiment === null &&
    draft.category === null &&
    draft.message.trim().length === 0 &&
    draft.votes.length === 0
  );
}

/**
 * Build the outgoing payload from a draft.
 *
 * Throws if the result fails the schema — the UI keeps the draft within limits,
 * so a throw here means a genuine invariant break rather than user error.
 */
export function buildPayload(
  draft: FeedbackDraft,
  options: BuildPayloadOptions,
): FeedbackPayload {
  const votes = [...new Set(draft.votes)].filter(isRoadmapSlug);

  return feedbackPayloadSchema.parse({
    submission_id: options.submissionId,
    sentiment: draft.sentiment ?? "",
    category: draft.category ?? "",
    message: draft.message.trim(),
    votes,
    app_version: options.appVersion,
    client_submitted_at: options.submittedAt,
  });
}
