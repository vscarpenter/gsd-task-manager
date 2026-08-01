"use client";

import { useEffect } from "react";

import type { RedesignQuadrantKey } from "@/lib/quadrants";

export interface AppShortcutHandlers {
  onSearch: () => void;
  onCapture: () => void;
  onReview: () => void;
  onFocusQuadrant: (quadrant: RedesignQuadrantKey) => void;
}

/**
 * Global shortcuts must not intercept typing, including from descendants of a
 * contenteditable region (where the event target is often a nested span).
 */
export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  for (let element: Element | null = target; element; element = element.parentElement) {
    const tag = element.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (element instanceof HTMLElement) {
      const contentEditable = element.getAttribute("contenteditable");
      if (
        element.isContentEditable ||
        element.contentEditable === "true" ||
        element.contentEditable === "plaintext-only" ||
        (contentEditable !== null && contentEditable !== "false")
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Closed Radix dialogs are unmounted or carry `data-state="closed"`; the
 * aria-hidden checks also cover dialogs that remain mounted while inactive. */
export function hasOpenModal(): boolean {
  if (typeof document === "undefined") return false;
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"][aria-modal="true"], [role="dialog"][data-state="open"]'
    )
  ).some(
    (dialog) =>
      !dialog.hasAttribute("hidden") && dialog.getAttribute("aria-hidden") !== "true"
  );
}

function shouldIgnore(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    !event.altKey ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    isEditableShortcutTarget(event.target) ||
    hasOpenModal()
  );
}

const QUADRANT_BY_CODE: Partial<Record<string, RedesignQuadrantKey>> = {
  Digit1: "q1",
  Digit2: "q2",
  Digit3: "q3",
  Digit4: "q4",
};

/**
 * Precision Utility shortcuts use physical key codes because macOS Option
 * transforms `event.key` into symbols such as ÷, ˜, and ®.
 */
export function useAppShortcuts(handlers: AppShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;

      let action: (() => void) | undefined;
      if (event.code === "Slash") {
        action = handlers.onSearch;
      } else if (event.code === "KeyN") {
        action = handlers.onCapture;
      } else if (event.code === "KeyR") {
        action = handlers.onReview;
      } else {
        const quadrant = QUADRANT_BY_CODE[event.code];
        if (quadrant) {
          action = () => handlers.onFocusQuadrant(quadrant);
        }
      }

      if (!action) return;
      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
