export const ESCALATION_WINDOW_KEY = "gsd:escalation-window";
export const ESCALATION_WINDOW_EVENT = "gsd:escalation-window-changed";
export const DEFAULT_ESCALATION_WINDOW_DAYS = 2;

/** Days offered in Settings. `null` is Off. */
export const ESCALATION_WINDOW_OPTIONS = [null, 1, 2, 3, 7] as const;
export type EscalationWindow = (typeof ESCALATION_WINDOW_OPTIONS)[number];

const OFF_VALUE = "off";

/** Per-device (D-12), outside the backup envelope. Unknown stored values fall back to the default. */
export function readEscalationWindow(): EscalationWindow {
  if (typeof window === "undefined") return DEFAULT_ESCALATION_WINDOW_DAYS;
  const stored = window.localStorage.getItem(ESCALATION_WINDOW_KEY);
  if (stored === OFF_VALUE) return null;
  const match = ESCALATION_WINDOW_OPTIONS.find((days) => days !== null && String(days) === stored);
  return match ?? DEFAULT_ESCALATION_WINDOW_DAYS;
}

export function writeEscalationWindow(days: EscalationWindow): void {
  window.localStorage.setItem(ESCALATION_WINDOW_KEY, days === null ? OFF_VALUE : String(days));
  window.dispatchEvent(new Event(ESCALATION_WINDOW_EVENT));
}

/** For useSyncExternalStore: same-tab writes fire the event, other tabs fire `storage`. */
export function subscribeEscalationWindow(onChange: () => void): () => void {
  window.addEventListener(ESCALATION_WINDOW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ESCALATION_WINDOW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
