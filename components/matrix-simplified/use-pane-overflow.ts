"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePaneOverflow } from "@/lib/pane-overflow";

/**
 * Tracks whether a pane's scroll container has content below the fold.
 *
 * Re-samples on scroll and whenever either the container or its content
 * changes size. Observing the content matters: at 2x2 widths the container
 * is a fixed grid cell that never resizes when "N more" opens or a card moves
 * into the done disclosure, so a container-only observer would go stale.
 * ResizeObserver is optional so the hook stays inert in jsdom.
 */
export function usePaneOverflow() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const sample = useCallback(() => {
    const node = containerRef.current;
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
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container) return;
    sample();
    container.addEventListener("scroll", sample, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sample) : null;
    observer?.observe(container);
    if (content) observer?.observe(content);
    return () => {
      container.removeEventListener("scroll", sample);
      observer?.disconnect();
    };
  }, [sample]);

  return { containerRef, contentRef, moreBelow };
}
