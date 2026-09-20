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
 *
 * The library loads with `import()` so it stays out of the matrix route's
 * first-load JavaScript. The type import below is erased at build time.
 */
import type { CreateTypes } from "canvas-confetti";

type CreateConfetti = typeof import("canvas-confetti").create;

const IDLE_WARMUP_FALLBACK_MS = 3000;

let fireConfetti: CreateTypes | null = null;
let libraryLoad: Promise<CreateConfetti> | null = null;

/**
 * A failed load clears the cached promise. The next celebration then retries
 * the import, where reusing the rejection would fail until a page reload.
 */
function loadLibrary(): Promise<CreateConfetti> {
  if (libraryLoad) return libraryLoad;

  const load = import("canvas-confetti")
    .then((library) => library.create)
    .catch((error: unknown) => {
      libraryLoad = null;
      throw error;
    });
  libraryLoad = load;
  return load;
}

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
async function getConfettiInstance(): Promise<CreateTypes | null> {
  if (fireConfetti) return fireConfetti;
  if (typeof document === "undefined") return null;

  const createConfetti = await loadLibrary();
  // Two celebrations can both wait on the first load. Only one makes the canvas.
  if (fireConfetti) return fireConfetti;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1000000";
  document.body.appendChild(canvas);

  fireConfetti = createConfetti(canvas, { resize: true, useWorker: false });
  return fireConfetti;
}

async function fireCelebration(): Promise<void> {
  const fire = await getConfettiInstance();
  if (!fire) return;

  fire({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.6 },
    scalar: 1.1,
  });

  setTimeout(() => {
    fire({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    fire({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }, 150);
}

function canCelebrate(): boolean {
  if (typeof window === "undefined") return false;
  return !prefersReducedMotion() && canRenderCanvas();
}

export function celebrateCompletion(): void {
  if (!canCelebrate()) return;

  fireCelebration().catch(() => {
    // Confetti is a nice-to-have, so a failure never reaches the user. Offline
    // with the chunk uncached lands here too, and the next call retries.
  });
}

/**
 * The service worker caches a chunk only after its first fetch. Fetching the
 * library once while the browser is idle keeps the celebration working offline.
 */
function warmLibraryWhenIdle(): void {
  if (!canCelebrate()) return;

  const warm = () => {
    loadLibrary().catch(() => {
      // Same as above: the next celebration retries.
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warm);
  } else {
    setTimeout(warm, IDLE_WARMUP_FALLBACK_MS);
  }
}

warmLibraryWhenIdle();
