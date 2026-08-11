/*
 * reset-app-state.js — bust the PWA service worker before trusting a render.
 *
 * Paste into the page console (localhost:3000) via the browser JS tool, then
 * HARD-RELOAD. The GSD service worker (public/sw.js) cache-firsts hashed JS
 * chunks across the gsd-immutable / gsd-pages / gsd-runtime caches, so an edit
 * can render as the OLD UI until those are cleared. IndexedDB is untouched
 * (separate from the Cache API), so seeded data survives.
 *
 * Returns a summary string so the caller can confirm what was cleared.
 */
(async () => {
  let workers = 0;
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      await reg.unregister();
      workers++;
    }
  }

  let caches_cleared = 0;
  if ("caches" in window) {
    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
      caches_cleared++;
    }
  }

  const summary = `reset-app-state: unregistered ${workers} service worker(s), cleared ${caches_cleared} cache(s). Hard-reload now to load fresh code.`;
  console.log(summary);
  return summary;
})();
