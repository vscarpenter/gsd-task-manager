"use client";

import { useCallback, useEffect, useState } from "react";
import { generateId } from "@/lib/id-generator";
import {
  buildPayload,
  emptyDraft,
  isDraftEmpty,
  type FeedbackDraft,
  type FeedbackPayload,
} from "@/lib/feedback/feedback-payload";
import {
  clearDraft,
  readDraft,
  readLastSentAt,
  writeDraft,
  writeLastSentAt,
} from "@/lib/feedback/feedback-store";
import { submitFeedback, type SubmitFailureReason } from "@/lib/feedback/submit-feedback";

const APP_VERSION = process.env.NEXT_PUBLIC_BUILD_NUMBER || "unknown";

const FAILURE_MESSAGES: Record<SubmitFailureReason, string> = {
  offline: "Couldn't connect. Your draft is safe — try again when you're back online.",
  "rate-limited": "Too many submissions right now. Try again in a few minutes.",
  rejected: "That wasn't accepted. Try shortening your note.",
  server: "Something went wrong on my end. Your draft is safe — try again.",
};

export type SendStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

/**
 * Owns the feedback form's state.
 *
 * The submission id and timestamp are held in state rather than minted at send
 * time, so the payload rendered in the "what will be sent" disclosure is the
 * same object that gets posted. A failed send keeps the id, which makes the
 * retry idempotent; a successful one mints a fresh id for the next draft.
 *
 * Both are set in an effect rather than during render: this page is prerendered
 * by the static export, and a clock read during render would not survive
 * hydration.
 */
export function useFeedbackForm() {
  const [draft, setDraft] = useState<FeedbackDraft>(emptyDraft);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [status, setStatus] = useState<SendStatus>({ kind: "idle" });
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  useEffect(() => {
    setDraft(readDraft());
    setLastSentAt(readLastSentAt());
    setSubmissionId(generateId());
    setBuiltAt(new Date().toISOString());
  }, []);

  const update = useCallback((next: FeedbackDraft) => {
    setDraft(next);
    writeDraft(next);
    setBuiltAt(new Date().toISOString());
    setStatus({ kind: "idle" });
  }, []);

  const payload: FeedbackPayload | null =
    submissionId && builtAt
      ? buildPayload(draft, { submissionId, appVersion: APP_VERSION, submittedAt: builtAt })
      : null;

  const send = useCallback(async () => {
    if (!payload) return;
    setStatus({ kind: "sending" });

    const outcome = await submitFeedback(payload);
    if (!outcome.ok) {
      setStatus({ kind: "error", message: FAILURE_MESSAGES[outcome.reason] });
      return;
    }

    const sentAt = new Date().toISOString();
    writeLastSentAt(sentAt);
    clearDraft();
    setLastSentAt(sentAt);
    setDraft(emptyDraft());
    setSubmissionId(generateId());
    setBuiltAt(sentAt);
    setStatus({ kind: "sent" });
  }, [payload]);

  return {
    draft,
    update,
    payload,
    send,
    status,
    lastSentAt,
    canSend: !isDraftEmpty(draft) && status.kind !== "sending",
  };
}
