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
 *
 * TWO PATHS. `DELETE /api/gsd/account` does the whole erasure in one server
 * transaction and is preferred, but it only exists where
 * `docker/pb_hooks/account_lifecycle.pb.js` is loaded — which is the self-host
 * image alone (`docker/Dockerfile` COPY plus `--hooksDir=/pb_hooks` in
 * `docker/docker-entrypoint.sh`). api.vinny.io does not load those hooks, so it
 * 404s the route and the client-side fallback below is the live production path,
 * not dead code.
 *
 * OPERATOR RUNBOOK
 * - Is the hook deployed? `curl -i -X DELETE https://api.vinny.io/api/gsd/account`
 *   with NO Authorization header. 401 means deployed — `$apis.requireAuth("users")`
 *   is route middleware and rejects before the handler, so nothing is touched.
 *   404 means absent and this module falls back. Never run that probe from a shell
 *   exporting a users token: with one, the call really does delete that account.
 * - Which path ran? Look for `operation="server-transaction"` vs
 *   `operation="client-erasure"` in the console.
 * - Retrying Delete account is always safe. The user record is never deleted
 *   before the task wipe completes, so a retry re-enumerates only the survivors.
 * - The fallback depends on a COMPLETE listing and refuses rather than guess, so
 *   it cannot finish while `fetchRemoteTaskIndex` fails closed: more than
 *   `SYNC_CONFIG.MAX_REMOTE_TASKS` remote rows, a row whose `client_updated_at`
 *   is missing or non-ISO, or a duplicate `task_id`. Those surface as
 *   "Couldn't list your synced tasks"; fixing the offending row is the unblock.
 */

import type PocketBase from "pocketbase";
import { getPocketBase, getCurrentUserId } from "./pocketbase-client";
import { refreshAuth } from "./pb-auth";
import { THROTTLE_MS, delay, fetchRemoteTaskIndex } from "./pb-sync-helpers";
import type { RemoteTaskIndexEntry } from "./types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SYNC_AUTH");

const ACCOUNT_ERASURE_ROUTE = "/api/gsd/account";

/**
 * 404 means no handler produced a response for this path — almost always an
 * absent hook, though a deployed hook whose own lookup finds nothing can surface
 * the same way. Falling back is safe either way: the fallback re-enumerates and
 * refuses to touch the user record unless a complete listing came back empty.
 */
const ROUTE_NOT_DEPLOYED_STATUS = 404;

/** Enumerate-and-delete passes before the fallback refuses to touch the user record. */
const MAX_ERASURE_PASSES = 3;

export interface DeleteAccountResult {
  ok: boolean;
  /** Where the flow ended: failed during task wipe, during account delete, or completed. */
  stage: "tasks" | "account" | "done";
  /** True on 401/403 — the session is dead and local auth should be cleared. */
  authRejected?: boolean;
  /** Short, sanitized error for surfacing to the user. */
  error?: string;
  /**
   * True when the client-side fallback removed at least one remote task before
   * failing. The account survived, so the UI must not imply the server is unchanged.
   */
  remoteTasksErased?: boolean;
}

export interface DeleteAccountOptions {
  /** Delay between remote task deletes on the fallback path. Tests pass 0; production uses THROTTLE_MS. */
  throttleMs?: number;
}

type WipeOutcome =
  | { ok: true; deleted: number }
  | { ok: false; deleted: number; error: unknown };

type DrainOutcome =
  | { drained: true; erased: boolean }
  | { drained: false; failure: DeleteAccountResult };

/** PocketBase ClientResponseError surfaces HTTP status on `.status`. */
function httpStatusOf(error: unknown): number | undefined {
  return (error as { status?: number })?.status;
}

function isAuthRejection(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status === 401 || status === 403;
}

/**
 * ClientResponseError initialises `status` to 0 and only overwrites it when a
 * response carried one, so an offline, DNS or TLS failure reports 0 and can
 * never be mistaken for an absent route.
 */
function isRouteNotDeployed(error: unknown): boolean {
  return httpStatusOf(error) === ROUTE_NOT_DEPLOYED_STATUS;
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200);
}

function toFailure(
  stage: "tasks" | "account",
  error: unknown,
  remoteTasksErased: boolean,
): DeleteAccountResult {
  return {
    ok: false,
    stage,
    authRejected: isAuthRejection(error),
    error: shortError(error),
    remoteTasksErased,
  };
}

/** Returns null — and only null — to mean "no handler here, the fallback is safe". */
async function eraseViaServerRoute(pb: PocketBase): Promise<DeleteAccountResult | null> {
  try {
    await pb.send(ACCOUNT_ERASURE_ROUTE, { method: "DELETE" });
  } catch (error) {
    if (isRouteNotDeployed(error)) {
      logger.warn("Transactional erasure route is not deployed; using client-side erasure");
      return null;
    }
    return toFailure("account", error, false);
  }

  logger.info("Account and remote tasks deleted", { operation: "server-transaction" });
  return { ok: true, stage: "done" };
}

/**
 * `assertSafeRecordId` throws synchronously from outside `fetchRemoteTaskIndex`'s
 * own catch. Head never called this function, so that throw is newly reachable;
 * treat it as an incomplete listing so the fail-closed ordering still holds.
 */
async function enumerateRemoteTasks(
  userId: string,
): Promise<{ index: Map<string, RemoteTaskIndexEntry>; fetchSucceeded: boolean }> {
  try {
    return await fetchRemoteTaskIndex(userId);
  } catch {
    return { index: new Map(), fetchSucceeded: false };
  }
}

/** Split out so the loop below holds at depth 3: try -> for -> if. */
async function deleteEnumeratedTasks(
  pb: PocketBase,
  index: Map<string, RemoteTaskIndexEntry>,
  throttleMs: number,
): Promise<WipeOutcome> {
  let deleted = 0;
  try {
    for (const entry of index.values()) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- intentionally sequential/throttled (rate-limit); parallelizing risks 429s
      await pb.collection("tasks").delete(entry.pbRecordId);
      deleted += 1;
      if (throttleMs > 0) await delay(throttleMs);
    }
  } catch (error) {
    return { ok: false, deleted, error };
  }
  return { ok: true, deleted };
}

/**
 * The invariant lives here: drain only reports success once a COMPLETE listing
 * came back empty, so the caller never deletes the user record on the strength
 * of one hopeful sweep.
 */
async function drainRemoteTasks(
  pb: PocketBase,
  userId: string,
  throttleMs: number,
): Promise<DrainOutcome> {
  let erased = false;

  for (let pass = 0; pass < MAX_ERASURE_PASSES; pass += 1) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each pass must observe the previous pass's deletes
    const { index, fetchSucceeded } = await enumerateRemoteTasks(userId);
    if (!fetchSucceeded) {
      logger.warn("Aborting account deletion: could not list remote tasks");
      return { drained: false, failure: incompleteListing(erased) };
    }
    if (index.size === 0) return { drained: true, erased };

    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- sequential drain, see deleteEnumeratedTasks
    const wipe = await deleteEnumeratedTasks(pb, index, throttleMs);
    erased = erased || wipe.deleted > 0;
    if (!wipe.ok) return { drained: false, failure: toFailure("tasks", wipe.error, erased) };
  }

  return { drained: false, failure: keptReappearing(erased) };
}

function incompleteListing(remoteTasksErased: boolean): DeleteAccountResult {
  return { ok: false, stage: "tasks", error: "Could not list remote tasks", remoteTasksErased };
}

function keptReappearing(remoteTasksErased: boolean): DeleteAccountResult {
  return { ok: false, stage: "tasks", error: "Remote tasks kept reappearing", remoteTasksErased };
}

/**
 * Delete every remote task for the current user, then delete the user account record.
 * Aborts before deleting the account if the task wipe can't be completed, so a partial
 * failure never leaves orphaned records behind a deleted account.
 */
export async function deleteRemoteAccountAndTasks(
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountResult> {
  const throttleMs = options.throttleMs ?? THROTTLE_MS;

  // Refresh the (possibly expired) token, then resolve the owner id. A dead session
  // yields no id — report it so the UI can prompt a re-sign-in.
  await refreshAuth();
  const userId = getCurrentUserId();
  if (!userId) {
    return { ok: false, stage: "tasks", authRejected: true };
  }

  const pb = getPocketBase();

  // Preferred: one server transaction that also serializes against task creation.
  const viaRoute = await eraseViaServerRoute(pb);
  if (viaRoute) return viaRoute;

  const drain = await drainRemoteTasks(pb, userId, throttleMs);
  if (!drain.drained) return drain.failure;

  // Last, once zero tasks were observed: the token dies with this record.
  try {
    await pb.collection("users").delete(userId);
  } catch (error) {
    return toFailure("account", error, drain.erased);
  }

  logger.info("Account and remote tasks deleted", { operation: "client-erasure" });
  return { ok: true, stage: "done" };
}
