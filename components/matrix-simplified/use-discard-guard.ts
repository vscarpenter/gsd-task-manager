"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface DiscardGuard {
  confirmingDiscard: boolean;
  keepEditingRef: RefObject<HTMLButtonElement | null>;
  /** Escape, backdrop, and Cancel: dismiss an open prompt, ask about unsaved changes, or close. */
  requestClose: () => void;
}

/** Reload and tab close skip the in-app prompt, so the browser's own stands in. */
function useWarnBeforeUnload(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/**
 * The drawer's "Discard unsaved changes?" flow. Keep editing takes focus when
 * the prompt opens, and focus returns to the field in use when it closes.
 */
export function useDiscardGuard(
  dirty: boolean,
  onClose: () => void,
  drawerRef: RefObject<HTMLElement | null>,
  titleRef: RefObject<HTMLInputElement | null>
): DiscardGuard {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  // Where Keep editing sends focus back to: the field the user was in, if any.
  const resumeFocusRef = useRef<HTMLElement | null>(null);

  const requestClose = (): void => {
    if (confirmingDiscard) {
      setConfirmingDiscard(false);
      return;
    }
    if (dirty) {
      const active = document.activeElement;
      const inDrawer = active instanceof HTMLElement && drawerRef.current?.contains(active);
      resumeFocusRef.current = inDrawer ? active : titleRef.current;
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  useWarnBeforeUnload(dirty);

  useEffect(() => {
    if (confirmingDiscard) {
      keepEditingRef.current?.focus();
      return;
    }
    // The focused prompt button just unmounted. Without a new target, focus
    // falls to <body> and the next Tab walks out of the modal.
    const resume = resumeFocusRef.current;
    resumeFocusRef.current = null;
    if (resume) (resume.isConnected ? resume : titleRef.current)?.focus();
  }, [confirmingDiscard, titleRef]);

  return { confirmingDiscard, keepEditingRef, requestClose };
}
