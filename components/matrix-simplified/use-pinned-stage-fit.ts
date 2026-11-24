import { useLayoutEffect, type RefObject } from "react";

// The stage takes the pinned height. globals.css keys on the same attribute.
const STAGE_SELECTOR = "[data-testid='matrix-stage']";
// Read by the `pinned` variant in globals.css: while set, the shell doesn't pin.
const UNPINNED_ATTRIBUTE = "data-unpinned";
// The least height a pinned stage may have.
const STAGE_FLOOR_REM = 10;

/**
 * The stage's height if the shell pinned: the viewport less everything above
 * the stage and below it. The stage is main's last child, so below it sit only
 * main's bottom padding and the footer. Main is a flex column from md whether
 * pinned or not, so this reads the same in both states and can't flip-flop.
 */
function pinnedStageHeight(main: HTMLElement, stage: HTMLElement): number {
  const stageTop = stage.getBoundingClientRect().top + window.scrollY;
  const mainPadding = Number.parseFloat(getComputedStyle(main).paddingBottom);
  const footer = main.nextElementSibling instanceof HTMLElement ? main.nextElementSibling.offsetHeight : 0;
  return window.innerHeight - stageTop - mainPadding - footer;
}

function stageFloorPx(): number {
  return STAGE_FLOOR_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/**
 * Keeps a fill-viewport shell from pinning when the stage would get under
 * 10rem. The `pinned` media query can't know how tall Today and the smart-view
 * strip will get. Under the floor the
 * column gets data-unpinned and the page scrolls instead.
 */
export function usePinnedStageFit(columnRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useLayoutEffect(() => {
    const column = columnRef.current;
    const main = column?.querySelector("main");
    const stage = main?.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (!enabled || !column || !main || !stage) return;

    const update = () => column.toggleAttribute(UNPINNED_ATTRIBUTE, pinnedStageHeight(main, stage) < stageFloorPx());
    // Writing inside the observer's callback would resize what it watches and
    // raise a ResizeObserver loop error, so the write waits a frame.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    update();
    observer.observe(main);
    observer.observe(stage);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      column.removeAttribute(UNPINNED_ATTRIBUTE);
    };
  }, [columnRef, enabled]);
}
