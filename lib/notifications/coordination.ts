/** Shared by page checks, the periodic worker and Reset Everything. */
export const NOTIFICATION_LOCK = 'gsd-notification-check';
export const CONTROL_CACHE = 'gsd-control-v1';
export const RESET_MARKER_URL = '/.gsd-reset-pending';

export async function withNotificationLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(NOTIFICATION_LOCK, run);
  }
  return run();
}

/** The worker cannot read localStorage. Keep a content-free durable marker for it. */
export async function setBackgroundResetPending(pending: boolean): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(CONTROL_CACHE);
  if (pending) await cache.put(RESET_MARKER_URL, new Response('pending'));
  else await cache.delete(RESET_MARKER_URL);
}
