/**
 * Account deletion — permanently remove the signed-in user's PocketBase account
 * and every task synced to it.
 *
 * Mirrors the shipped iOS/Mac flow (SyncEngine.eraseAllRemote + AuthService.deleteAccount):
 * remote tasks are deleted FIRST, then the user record. The `owner` field on the
 * `tasks` collection is plain `text`, not a relation, so deleting the user record does
 * NOT cascade — skipping the task wipe would orphan every record on the server.
 *
 * This module performs the REMOTE operation only and returns a structured result.
 * The caller decides what to do with local data (keep, or wipe via resetEverything),
 * and only ever touches local state after a confirmed remote success.
 */

import { getPocketBase, getCurrentUserId } from "./pocketbase-client";
import { refreshAuth } from "./pb-auth";
import { fetchRemoteTaskIndex } from "./pb-sync-helpers";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SYNC_AUTH");

/** Default delay between remote deletes — PocketBase 429-avoidance (matches iOS). */
const DEFAULT_THROTTLE_MS = 100;

export interface DeleteAccountResult {
  ok: boolean;
  /** Where the flow ended: failed during task wipe, during account delete, or completed. */
  stage: "tasks" | "account" | "done";
  /** True on 401/403 — the session is dead and local auth should be cleared. */
  authRejected?: boolean;
  /** Short, sanitized error for surfacing to the user. */
  error?: string;
}

export interface DeleteAccountOptions {
  /** Delay between remote task deletes. Tests pass 0; production uses 100ms. */
  throttleMs?: number;
}

/** PocketBase ClientResponseError surfaces HTTP status on `.status`. */
function isAuthRejection(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 401 || status === 403;
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delete every remote task for the current user, then delete the user account record.
 * Aborts before deleting the account if the task wipe can't be completed, so a partial
 * failure never leaves orphaned records behind a deleted account.
 */
export async function deleteRemoteAccountAndTasks(
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountResult> {
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;

  // Refresh the (possibly expired) token, then resolve the owner id. A dead session
  // yields no id — report it so the UI can prompt a re-sign-in.
  await refreshAuth();
  const userId = getCurrentUserId();
  if (!userId) {
    return { ok: false, stage: "tasks", authRejected: true };
  }

  const pb = getPocketBase();

  // Build the authoritative remote index. If we can't list the tasks, abort — deleting
  // the account now would orphan whatever we failed to enumerate.
  const { index, fetchSucceeded } = await fetchRemoteTaskIndex(userId);
  if (!fetchSucceeded) {
    logger.warn("Aborting account deletion: could not list remote tasks");
    return { ok: false, stage: "tasks", error: "Could not list remote tasks" };
  }

  // Delete every remote task first (throttled). A partial failure throws and leaves the
  // account intact, so a retry re-fetches only the survivors and continues.
  try {
    for (const entry of index.values()) {
      await pb.collection("tasks").delete(entry.pbRecordId);
      if (throttleMs > 0) await sleep(throttleMs);
    }
  } catch (error) {
    return {
      ok: false,
      stage: "tasks",
      authRejected: isAuthRejection(error),
      error: shortError(error),
    };
  }

  // Delete the user record last — once it's gone the token is invalid and tasks can no
  // longer be removed.
  try {
    await pb.collection("users").delete(userId);
  } catch (error) {
    return {
      ok: false,
      stage: "account",
      authRejected: isAuthRejection(error),
      error: shortError(error),
    };
  }

  logger.info("Account and remote tasks deleted", { taskCount: index.size });
  return { ok: true, stage: "done" };
}
