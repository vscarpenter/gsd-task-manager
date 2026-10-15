"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePaneOverflow } from "@/lib/pane-overflow";

/**
 * Tracks whether a pane's scroll container has content below the fold.
 *
 * Re-samples on scroll, on resize of the container, and whenever the caller's
 * `revision` changes (the task list re-rendered, the cap or completed
 * disclosure opened). ResizeObserver is optional so the hook stays inert in
 * jsdom.
 */
export function usePaneOverflow(revision: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const sample = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setMoreBelow(
      resolvePaneOverflow({
        scrollTop: node.scrollTop,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }),
    );
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    sample();
    node.addEventListener("scroll", sample, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sample) : null;
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", sample);
      observer?.disconnect();
    };
  }, [sample, revision]);

  return { ref, moreBelow };
}
