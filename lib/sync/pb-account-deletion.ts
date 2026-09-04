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
import { createLogger } from "@/lib/logger";

const logger = createLogger("SYNC_AUTH");

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
  /** Retained for source compatibility; erasure is now one server transaction. */
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

/**
 * Delete every remote task for the current user, then delete the user account record.
 * Aborts before deleting the account if the task wipe can't be completed, so a partial
 * failure never leaves orphaned records behind a deleted account.
 */
export async function deleteRemoteAccountAndTasks(
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountResult> {
  void options;

  // Refresh the (possibly expired) token, then resolve the owner id. A dead session
  // yields no id — report it so the UI can prompt a re-sign-in.
  await refreshAuth();
  const userId = getCurrentUserId();
  if (!userId) {
    return { ok: false, stage: "tasks", authRejected: true };
  }

  const pb = getPocketBase();

  // The server route removes every owned task and the user in one transaction.
  // It also serializes against task creation, closing the client snapshot race.
  try {
    await pb.send("/api/gsd/account", { method: "DELETE" });
  } catch (error) {
    return {
      ok: false,
      stage: "account",
      authRejected: isAuthRejection(error),
      error: shortError(error),
    };
  }

  logger.info("Account and remote tasks deleted transactionally");
  return { ok: true, stage: "done" };
}
