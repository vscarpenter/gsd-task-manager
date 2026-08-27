"use client";

import { toggleVote } from "@/lib/feedback/feedback-store";
import { FeedbackRoadmapPoll } from "./feedback-roadmap-poll";
import {
  FeedbackNoteRows,
  FeedbackPayloadPreview,
  FeedbackSendRow,
  FeedbackSentimentRow,
} from "./feedback-form-rows";
import { useFeedbackForm } from "./use-feedback-form";

/**
 * Settings → Feedback.
 *
 * Everything here is local until the user presses Send: votes and text are held
 * in localStorage, and the only network call this surface can make is the one
 * behind that button. The disclosure above it renders the literal payload, so
 * "nothing leaves unless you say so" is something the user can watch rather
 * than a claim they have to take on faith.
 */
export function FeedbackSettings() {
  const { draft, update, payload, send, status, lastSentAt, canSend } = useFeedbackForm();

  return (
    <>
      <FeedbackRoadmapPoll
        votes={draft.votes}
        onToggle={(slug) => update(toggleVote(draft, slug))}
      />

      <FeedbackSentimentRow
        sentiment={draft.sentiment}
        onChange={(sentiment) => update({ ...draft, sentiment })}
      />

      <FeedbackNoteRows
        category={draft.category}
        message={draft.message}
        onCategoryChange={(category) => update({ ...draft, category })}
        onMessageChange={(message) => update({ ...draft, message })}
      />

      <FeedbackPayloadPreview payload={payload} />

      <FeedbackSendRow
        canSend={canSend}
        status={status}
        lastSentAt={lastSentAt}
        onSend={send}
      />
    </>
  );
}
