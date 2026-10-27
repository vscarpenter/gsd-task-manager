"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Makes the browser Back button close an open overlay instead of leaving the page.
 *
 * Overlays are not routes, so Back used to skip past them to the previous page and
 * drop whatever was typed. While any overlay is open the page holds one extra
 * history entry. Back pops it and asks the topmost overlay to close, running its
 * own discard guard. The entry goes straight back on, so an overlay that stays
 * open (the guard is asking) keeps its place, and it is removed when the last
 * overlay closes by any other route.
 *
 * Overlays share one entry through a module-level stack, so handing off from the
 * details sheet to the edit drawer neither stacks entries nor pops one.
 */

const MARKER = { gsdOverlay: true };

const handlers: Array<() => void> = [];
let entryPushed = false;
let ignoreNextPop = false;
let listening = false;

function ownsCurrentEntry(): boolean {
  return (window.history.state as { gsdOverlay?: boolean } | null)?.gsdOverlay === true;
}

function pushEntry(): void {
  window.history.pushState(MARKER, "");
  entryPushed = true;
}

function onPopState(): void {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  if (!entryPushed) return;
  entryPushed = false;
  const top = handlers.at(-1);
  if (!top) return;
  pushEntry();
  top();
}

function register(handler: () => void): void {
  handlers.push(handler);
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  if (!entryPushed) pushEntry();
}

/** Drop the extra entry once nothing is open, unless a navigation already replaced it. */
function releaseEntryIfIdle(): void {
  if (handlers.length > 0 || !entryPushed) return;
  entryPushed = false;
  if (!ownsCurrentEntry()) return;
  ignoreNextPop = true;
  window.history.back();
}

function unregister(handler: () => void): void {
  const index = handlers.lastIndexOf(handler);
  if (index >= 0) handlers.splice(index, 1);
  // Deferred so an overlay that opens in the same tick takes over the entry.
  setTimeout(releaseEntryIfIdle, 0);
}

/**
 * While `active`, Back calls `onBack` instead of leaving the page. `onBack` should
 * be the overlay's own close request, so an unsaved draft still gets its prompt.
 */
export function useBackToClose(active: boolean, onBack: () => void): void {
  // Reads the latest onBack (dirty state included) without re-registering.
  const latest = useEffectEvent(() => onBack());
  useEffect(() => {
    if (!active) return;
    const handler = (): void => latest();
    register(handler);
    return () => unregister(handler);
  }, [active]);
}
