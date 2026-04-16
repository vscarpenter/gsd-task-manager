"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";

const STORAGE_KEY = "gsd-keyboard-hints-dismissed";

export function KeyboardHintsToast() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage not available
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 animate-slide-in-card md:bottom-6">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <p className="text-sm text-foreground-muted">
          <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">n</kbd>
          {" "}new task
          <span className="mx-2 text-border">·</span>
          <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">/</kbd>
          {" "}search
          <span className="mx-2 text-border">·</span>
          <kbd className="rounded border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">⌘K</kbd>
          {" "}palette
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-1 text-foreground-muted hover:text-foreground hover:bg-background-muted transition-colors"
          aria-label="Dismiss keyboard shortcuts hint"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
