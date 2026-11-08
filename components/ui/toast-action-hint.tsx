"use client";

import { isValidElement } from "react";
import { useSonner } from "sonner";
import type { ToastT } from "sonner";

// The key and its spoken name live together so the hint can't name a key the
// Toaster doesn't listen for. Alt+T is also Sonner's default.
export const TOAST_HOTKEY = ["altKey", "KeyT"];
const TOAST_HOTKEY_LABEL = "Alt+T";

type ActionLabel = { label: unknown };

// A custom React element as the action has no label to name, so it gets no hint.
function actionLabel(toast: ToastT): string | null {
  const action = toast.action;
  if (!action || isValidElement(action)) return null;
  const label = (action as ActionLabel).label;
  return typeof label === "string" ? label : null;
}

/**
 * Sonner's hotkey moves focus into the toast list, but nothing says so. Every
 * toast that carries an action (Undo, mostly) comes from the one Toaster, so
 * the cue lives here and not at the call sites. Screen-reader only: a sighted
 * keyboard user gets no new text until the copy is approved.
 */
export function ToastActionHint() {
  const { toasts } = useSonner();
  const label = toasts.map(actionLabel).find(Boolean);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {label ? `Press ${TOAST_HOTKEY_LABEL}, then Tab until you reach ${label}.` : null}
    </div>
  );
}
