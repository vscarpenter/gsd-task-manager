/**
 * Celebration confetti for task completions.
 *
 * Uses canvas-confetti's `useWorker: false` mode so the animation runs on
 * the main thread instead of a Web Worker. The worker approach creates a
 * blob: URL worker which is blocked by our CSP (`script-src 'self'` has
 * no blob: fallback, and `worker-src` is not set).
 *
 * Respects `prefers-reduced-motion` so users who opt out of motion get
 * only the toast — no animation. Feature-detects canvas so jsdom-based
 * tests don't crash on its stubbed getContext().
 */
import confetti, { type CreateTypes } from "canvas-confetti";

let fireConfetti: CreateTypes | null = null;

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

/**
 * Lazily create a fullscreen confetti canvas attached to document.body
 * with the worker disabled (CSP-safe). Reused across calls.
 *
 * z-index 1000000 keeps confetti above Sonner's default z-index (999999)
 * and all other UI layers.
 */
function getConfettiInstance(): CreateTypes | null {
  if (fireConfetti) return fireConfetti;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1000000";
  document.body.appendChild(canvas);

  fireConfetti = confetti.create(canvas, { resize: true, useWorker: false });
  return fireConfetti;
}

export function celebrateCompletion(): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  if (!canRenderCanvas()) return;

  try {
    const fire = getConfettiInstance();
    if (!fire) return;

    // Big center burst.
    fire({
      particleCount: 120,
      spread: 90,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.6 },
      scalar: 1.1
    });

    // Follow-up side bursts for a fuller effect.
    setTimeout(() => {
      fire({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
      fire({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
    }, 150);
  } catch {
    // Confetti is a nice-to-have — never surface rendering failures.
  }
}
