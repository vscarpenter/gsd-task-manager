"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  buildPayload,
  isDraftEmpty,
  type FeedbackDraft,
  type FeedbackPayload,
} from "@/lib/feedback/feedback-payload";
import {
  getFeedbackSnapshot,
  getServerFeedbackSnapshot,
  recordSend,
  subscribeToFeedback,
  updateDraft,
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
 * The draft, the submission id, and the build timestamp all live in the store
 * rather than in component state. That keeps the persisted draft readable on
 * the first render after hydration without a state-setting effect, and it means
 * the payload rendered in the "what will be sent" disclosure is the same object
 * that gets posted.
 *
 * The id survives a failed send, which makes the retry idempotent, and is
 * replaced after a successful one.
 */
export function useFeedbackForm() {
  const state = useSyncExternalStore(
    subscribeToFeedback,
    getFeedbackSnapshot,
    getServerFeedbackSnapshot,
  );
  const [status, setStatus] = useState<SendStatus>({ kind: "idle" });

  const update = useCallback((next: FeedbackDraft) => {
    updateDraft(next);
    setStatus({ kind: "idle" });
  }, []);

  const { draft, submissionId, builtAt, lastSentAt } = state;

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

    recordSend(new Date().toISOString());
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
