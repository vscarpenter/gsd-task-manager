/**
 * Restore focus after a transient surface closes. If its opener was removed
 * (for example by navigation, filtering, or live task deletion), move focus to
 * the app's programmatic main-content target instead of leaving it on body.
 */
export function restoreFocusOrMainContent(origin: HTMLElement | null): void {
  if (typeof document === "undefined") return;

  const originIsUsable =
    origin !== null &&
    origin !== document.body &&
    origin !== document.documentElement &&
    origin.isConnected &&
    !origin.closest("[hidden], [aria-hidden='true'], [inert]");
  const fallback = document.getElementById("main-content");
  const target = originIsUsable
    ? origin
    : fallback instanceof HTMLElement
      ? fallback
      : null;

  target?.focus({ preventScroll: true });
}
