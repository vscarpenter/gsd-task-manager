import { ENV_CONFIG } from "@/lib/env-config";
import { createLogger } from "@/lib/logger";
import type { FeedbackPayload } from "./feedback-payload";

/**
 * The one network call this feature makes.
 *
 * Deliberately bare `fetch` rather than the PocketBase SDK client: the SDK
 * carries an auth store and attaches a token automatically, which is exactly
 * what must not happen on a path whose whole premise is anonymity. `credentials:
 * "omit"` closes the same door for cookies.
 *
 * Never throws. The caller is a form with the user's writing in it, so every
 * failure comes back as a reason it can show next to a retry button.
 */

const logger = createLogger("FEEDBACK");

const FEEDBACK_PATH = "/api/collections/feedback/records";
const HTTP_BAD_REQUEST = 400;
const HTTP_RATE_LIMITED = 429;
const HTTP_SERVER_ERROR = 500;

export type SubmitFailureReason = "offline" | "rate-limited" | "rejected" | "server";

export type SubmitOutcome = { ok: true } | { ok: false; reason: SubmitFailureReason };

/**
 * PocketBase answers a unique-index collision with 400. That only happens when
 * a retry carries the submission id of a request that already landed, so the
 * record exists and the user's feedback arrived — success, not failure.
 */
async function isDuplicateSubmission(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as {
      data?: { submission_id?: { code?: string } };
    };
    return body.data?.submission_id?.code === "validation_not_unique";
  } catch {
    return false;
  }
}

function failureFor(status: number): SubmitFailureReason {
  if (status === HTTP_RATE_LIMITED) return "rate-limited";
  if (status >= HTTP_SERVER_ERROR) return "server";
  return "rejected";
}

export async function submitFeedback(payload: FeedbackPayload): Promise<SubmitOutcome> {
  const url = `${ENV_CONFIG.pocketBaseUrl}${FEEDBACK_PATH}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    });
  } catch {
    // The rejection reason is discarded rather than logged: fetch failures
    // carry the request URL, and there is no upside to recording it here.
    logger.warn("Feedback submission could not reach the server");
    return { ok: false, reason: "offline" };
  }

  if (response.ok) return { ok: true };

  if (response.status === HTTP_BAD_REQUEST && (await isDuplicateSubmission(response))) {
    return { ok: true };
  }

  // Only the status code is logged. Metadata is allowlist-filtered before it
  // reaches Sentry (lib/sentry-safe-keys.ts), but the message itself is not,
  // so what the user wrote must never appear in a log line.
  logger.warn("Feedback submission was refused", { status: response.status });

  return { ok: false, reason: failureFor(response.status) };
}
