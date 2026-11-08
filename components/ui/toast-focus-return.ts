"use client";

import { useEffect } from "react";
import { TOAST_HOTKEY } from "./toast-action-hint";

const MAIN_REGION_ID = "main-content";
const TOASTER_SELECTOR = "section[aria-label^='Notifications']";

function isHotkey(event: KeyboardEvent): boolean {
  return event.altKey && event.code === TOAST_HOTKEY[1];
}

function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}

function findToaster(): Element | null {
  return document.querySelector(TOASTER_SELECTOR);
}

/** Watches from the hotkey until focus lands somewhere real, then steps aside. */
function createFocusReturn() {
  let pending = false;
  let returnTo: HTMLElement | null = null;
  let observer: MutationObserver | null = null;

  const stop = () => {
    observer?.disconnect();
    observer = null;
    pending = false;
    returnTo = null;
  };
  const restore = () => {
    if (!pending || !isFocusLost()) return;
    const target = returnTo?.isConnected ? returnTo : document.getElementById(MAIN_REGION_ID);
    stop();
    target?.focus();
  };
  const remember = (event: KeyboardEvent) => {
    if (!isHotkey(event)) return;
    stop();
    const active = document.activeElement;
    if (findToaster()?.contains(active)) return;
    // Nothing focused counts as gone: the focused card was removed before the hotkey.
    returnTo = active instanceof HTMLElement && active !== document.body ? active : null;
    pending = true;
    observer = new MutationObserver(restore);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  const forget = (event: FocusEvent) => {
    if (event.target instanceof Node && !findToaster()?.contains(event.target)) stop();
  };
  return { stop, remember, forget };
}

/**
 * Sonner hands focus back to whatever had it before the hotkey, but only while
 * that element still exists. Completing a task from its card removes the card,
 * so after Undo focus would drop to <body>. This returns it to the same
 * element when it's still there, and to the main region when it's gone.
 *
 * It only watches the page between the hotkey and the moment focus lands
 * somewhere real, so a closed toast list costs nothing.
 */
export function useToastFocusReturn(): void {
  useEffect(() => {
    const { stop, remember, forget } = createFocusReturn();
    window.addEventListener("keydown", remember, true);
    document.addEventListener("focusin", forget);
    return () => {
      stop();
      window.removeEventListener("keydown", remember, true);
      document.removeEventListener("focusin", forget);
    };
  }, []);
}
