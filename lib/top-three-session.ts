/**
 * Whether the person tapped "Not now" on the tidy offer since this app launched
 * (spec: tasks/spec-top-three.md section 4). It lives outside any component, so the
 * offer stays away when the matrix remounts and returns on the next launch, as the
 * spec says. Nothing is written to a task or stored on disk.
 */
let dismissed = false;
const listeners = new Set<() => void>();

export const tidyDismissal = {
  isDismissed: () => dismissed,
  dismiss: () => {
    dismissed = true;
    listeners.forEach((listener) => listener());
  },
  reset: () => {
    dismissed = false;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
