import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal-dialog focus management for a hand-rolled overlay:
 *  - captures the element focused before open and restores it when open flips false,
 *  - returns an `onKeyDown` handler that traps Tab / Shift+Tab inside `ref`.
 *
 * Pair with `role="dialog"` + `aria-modal="true"` on the same element.
 */
export function useDialogFocus(
  open: boolean,
  ref: RefObject<HTMLElement | null>
): (event: KeyboardEvent<HTMLElement>) => void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Tab") return;
      const nodes = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [ref]
  );
}
