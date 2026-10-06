/**
 * "Sign out of all devices" (SEC-002).
 *
 * PocketBase auth tokens are stateless, so the server can only end a user's
 * sessions by rotating their token key, which ends every session at once. The
 * self-host image serves that route from `docker/pb_hooks/session_revoke.pb.js`.
 * The hosted service runs PocketBase without the repo's hooks (ADR 0016) and
 * answers 404, so this device still signs out and the caller says the other
 * sessions are untouched.
 */

import { disableSync } from "@/lib/sync/config";
import { clearPocketBase, getPocketBase } from "@/lib/sync/pocketbase-client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SYNC_AUTH");

const SESSION_REVOKE_ROUTE = "/api/gsd/sessions";
const ROUTE_NOT_DEPLOYED_STATUS = 404;
const AUTH_REJECTED_STATUS = 401;

export interface SignOutEverywhereResult {
  /** False when the server has no revoke route and only this device signed out. */
  otherSessionsEnded: boolean;
}

/**
 * The server call has run, but this device couldn't clear its own sync state.
 * The token is cleared anyway, because after a rotation it no longer works.
 */
export class LocalSignOutIncompleteError extends Error {
  readonly otherSessionsEnded: boolean;

  constructor(otherSessionsEnded: boolean, cause: unknown) {
    super("This device couldn't finish signing out", { cause });
    this.name = "LocalSignOutIncompleteError";
    this.otherSessionsEnded = otherSessionsEnded;
  }
}

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number })?.status;
}

/**
 * Decides what a failed revoke means. ClientResponseError reports status 0 for
 * an offline, DNS, or TLS failure, so only a real 404 counts as "no route here".
 * A 401 for a token that hasn't expired means the key already rotated, for
 * example when an earlier revoke succeeded but its response was lost.
 */
function outcomeOfFailedRevoke(error: unknown, tokenUnexpired: boolean): SignOutEverywhereResult {
  const status = statusOf(error);
  if (status === ROUTE_NOT_DEPLOYED_STATUS) {
    logger.warn("Session revoke route is not deployed; signing out on this device only");
    return { otherSessionsEnded: false };
  }
  if (status === AUTH_REJECTED_STATUS && tokenUnexpired) {
    logger.info("Server already rejects this session; finishing the sign-out");
    return { otherSessionsEnded: true };
  }
  throw error;
}

/**
 * Ends every session for the signed-in user, then signs out on this device.
 * Any failure that leaves the other sessions in doubt keeps the user signed in,
 * so they never believe the other sessions ended when they didn't.
 */
export async function signOutEverywhere(): Promise<SignOutEverywhereResult> {
  const pb = getPocketBase();
  let result: SignOutEverywhereResult = { otherSessionsEnded: true };
  try {
    await pb.send(SESSION_REVOKE_ROUTE, { method: "DELETE" });
  } catch (error) {
    result = outcomeOfFailedRevoke(error, pb.authStore.isValid);
  }

  try {
    await disableSync();
  } catch (error) {
    clearPocketBase();
    throw new LocalSignOutIncompleteError(result.otherSessionsEnded, error);
  }

  logger.info("Signed out", { operation: result.otherSessionsEnded ? "all-devices" : "this-device" });
  return result;
}
