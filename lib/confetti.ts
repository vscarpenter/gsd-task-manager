/**
 * Celebration confetti for task completions.
 *
 * Lazy-loads canvas-confetti to keep it out of the initial bundle, and
 * respects `prefers-reduced-motion` so users who opt out of motion get
 * only the toast — no animation.
 */

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * jsdom (used in tests) returns null from canvas.getContext('2d'),
 * which makes canvas-confetti crash inside its animation loop.
 */
function canRenderCanvas(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext?.("2d");
  } catch {
    return false;
  }
}

export async function celebrateCompletion(): Promise<void> {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  if (!canRenderCanvas()) return;

  try {
    const { default: confetti } = await import("canvas-confetti");

    // Two quick bursts from bottom-left and bottom-right for a fuller effect.
    const defaults = {
      startVelocity: 35,
      spread: 70,
      ticks: 200,
      zIndex: 9999,
      particleCount: 60,
      scalar: 0.9
    };

    confetti({ ...defaults, origin: { x: 0.2, y: 0.9 }, angle: 60 });
    confetti({ ...defaults, origin: { x: 0.8, y: 0.9 }, angle: 120 });
  } catch {
    // Confetti is a nice-to-have — never surface load failures to the user.
  }
}
