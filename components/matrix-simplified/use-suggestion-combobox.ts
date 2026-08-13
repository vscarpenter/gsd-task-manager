"use client";

import { useEffect, useRef, useState } from "react";

interface SuggestionComboboxOptions {
  /** How many suggestions are currently listed. Wrapping is modulo this. */
  count: number;
  onPick: (index: number) => void;
  onDismiss: () => void;
}

export interface SuggestionCombobox {
  activeIndex: number;
  resetActive: () => void;
  anchorRect: DOMRect | null;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

/**
 * Track an element's viewport rect while `active`.
 *
 * Needed because the popup is portalled out of the drawer to escape its
 * `overflow-auto` clipping — once portalled it has no positioned ancestor left
 * to follow, so it has to be told where the field went. `capture: true` is
 * load-bearing: the drawer's scroll container does not bubble scroll to window.
 */
function useAnchorRect(active: boolean, revision: number) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) return;
    const measure = () => setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, revision]);

  return { anchorRef, anchorRect };
}

/** Next highlighted index for an arrow key, wrapping at both ends. */
function nextIndex(key: string, current: number, count: number): number {
  if (key === "ArrowDown") return (current + 1) % count;
  return current <= 0 ? count - 1 : current - 1;
}

/** Keyboard and positioning behaviour for a suggestion popup anchored to a field. */
export function useSuggestionCombobox(
  open: boolean,
  { count, onPick, onDismiss }: SuggestionComboboxOptions
): SuggestionCombobox {
  const [activeIndex, setActiveIndex] = useState(-1);
  const { anchorRef, anchorRect } = useAnchorRect(open, count);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      // Always swallowed: this field sits inside a form, and Enter here must
      // never submit it.
      event.preventDefault();
      if (activeIndex >= 0) onPick(activeIndex);
      return;
    }
    if (count > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveIndex((index) => nextIndex(event.key, index, count));
      return;
    }
    // Escape dismisses the popup only; a second Escape (popup closed) bubbles to
    // the drawer's own listener as usual.
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setActiveIndex(-1);
      onDismiss();
    }
  };

  return {
    activeIndex,
    resetActive: () => setActiveIndex(-1),
    anchorRect,
    anchorRef,
    onKeyDown,
  };
}
