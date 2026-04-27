export const SHOW_COMPLETED_KEY = "gsd:show-completed";
export const SHOW_COMPLETED_EVENT = "toggle-completed";

export interface ShowCompletedEventDetail {
  show: boolean;
}

export function readShowCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHOW_COMPLETED_KEY) === "true";
}
