import type { Page } from "@playwright/test";

/**
 * Describes the focused control if none of it is visible, else returns null.
 *
 * Runs in the page. It waits a few frames so the scroll that focus caused, and
 * the topbar's response to that scroll, have settled. The control is clipped to
 * the viewport, to every scroll container above it, and to the fixed or sticky
 * chrome that overlaps it horizontally. Controls inside that chrome are
 * skipped: the chrome is what covers everything else.
 */
async function describeIfHidden(): Promise<string | null> {
  for (let frame = 0; frame < 3; frame += 1) await new Promise(requestAnimationFrame);
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  const isChrome = (node: Element) => ["fixed", "sticky"].includes(getComputedStyle(node).position);
  for (let node: Element | null = el; node; node = node.parentElement) if (isChrome(node)) return null;

  const rect = el.getBoundingClientRect();
  let top = Math.max(rect.top, 0);
  let bottom = Math.min(rect.bottom, window.innerHeight);
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).overflowY === "visible") continue;
    const box = node.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }
  for (const chrome of document.querySelectorAll("header, nav, [data-testid='mobile-capture-dock']")) {
    const box = chrome.getBoundingClientRect();
    if (!isChrome(chrome) || box.right <= rect.left || box.left >= rect.right) continue;
    if (box.top <= top && box.bottom > top) top = box.bottom;
    if (box.bottom >= bottom && box.top < bottom) bottom = box.top;
  }
  if (bottom > top) return null;
  const name = el.getAttribute("aria-label") || el.dataset.testid || el.textContent?.trim().slice(0, 30) || el.tagName;
  return `${name} (top ${Math.round(rect.top)}, bottom ${Math.round(rect.bottom)})`;
}

/** Puts the page at the top with focus at the start of main, so Tab walks the content. */
export async function startAtMainContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  });
}

/** Tabs forward, then back, and lists every stop that landed fully out of sight. */
export async function findHiddenFocusStops(page: Page, presses: number): Promise<string[]> {
  const hidden: string[] = [];
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let press = 0; press < presses; press += 1) {
      await page.keyboard.press(key);
      const stop = await page.evaluate(describeIfHidden);
      if (stop) hidden.push(`${key}: ${stop}`);
    }
  }
  return hidden;
}
