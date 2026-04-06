"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 to the target value on mount.
 * Skips animation in test environments where rAF callbacks
 * don't fire synchronously.
 */
export function useCountUp(target: number | string, duration = 500): string {
  const numericTarget = typeof target === "string" ? parseFloat(target) : target;
  const isNumeric = !isNaN(numericTarget) && isFinite(numericTarget);
  const suffix = typeof target === "string" ? target.replace(/[\d.-]/g, "") : "";

  const skipAnimation = process.env.NODE_ENV === "test";
  const [current, setCurrent] = useState(skipAnimation ? numericTarget : 0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isNumeric || skipAnimation || hasAnimated.current) return;
    if (numericTarget === 0) {
      hasAnimated.current = true;
      return;
    }

    hasAnimated.current = true;
    const startTime = performance.now();

    function update(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * numericTarget));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }, [numericTarget, duration, isNumeric, skipAnimation]);

  if (!isNumeric) return String(target);
  return `${current}${suffix}`;
}
