export const RAIL_COLLAPSED_KEY = "gsd:icon-rail-collapsed";

export function readRailCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "true";
}

export function writeRailCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(collapsed));
}
