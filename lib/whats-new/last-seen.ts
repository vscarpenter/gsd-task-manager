/**
 * The newest release this device has acknowledged in What's New.
 *
 * Per device and never synced, like the escalation window (D-12): each device
 * got its own update. localStorage can throw in private browsing or at quota,
 * so a failed write keeps a session copy instead of re-showing the cue.
 */

export const WHATS_NEW_LAST_SEEN_KEY = "gsd:whats-new:last-seen";
const CHANGE_EVENT = "gsd:whats-new-seen";

let sessionCopy: string | null = null;

export function readLastSeenVersion(): string | null {
  if (typeof window === "undefined") return null;
  // Set only after a failed write, so it is newer than anything in storage.
  if (sessionCopy !== null) return sessionCopy;
  try {
    return window.localStorage.getItem(WHATS_NEW_LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function recordLastSeenVersion(version: string): void {
  try {
    window.localStorage.setItem(WHATS_NEW_LAST_SEEN_KEY, version);
    sessionCopy = null;
  } catch {
    sessionCopy = version;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: same-tab records fire the event, other tabs fire `storage`. */
export function subscribeLastSeenVersion(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** next.config.ts always sets the build number; null only in an unconfigured test run. */
export function runningWebVersion(): string | null {
  return process.env.NEXT_PUBLIC_BUILD_NUMBER || null;
}
