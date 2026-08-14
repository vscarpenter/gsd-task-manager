/**
 * Whether the user has asked the OS to reduce motion.
 *
 * CSS animations are handled by the `prefers-reduced-motion: reduce` block in
 * `app/globals.css`. Anything driven from JavaScript — requestAnimationFrame
 * loops, the Web Animations API, canvas — is invisible to that stylesheet and
 * has to ask this question directly.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
