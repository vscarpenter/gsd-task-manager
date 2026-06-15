"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XIcon, ZapIcon } from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import { cn } from "@/lib/utils";

interface OnboardingProps {
  open: boolean;
  /** Called when the flow is dismissed (Skip, Escape, or "Start using GSD"). */
  onClose: () => void;
  /** Optional: invoked from the final screen's quiet secondary action. */
  onSignIn?: () => void;
}

interface Screen {
  key: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

const QUADRANTS: { key: string; label: string; tag: string }[] = [
  { key: "q1", label: "Do First", tag: "Urgent · Important" },
  { key: "q2", label: "Schedule", tag: "Important" },
  { key: "q3", label: "Delegate", tag: "Urgent" },
  { key: "q4", label: "Eliminate", tag: "Neither" },
];

const SCREENS: Screen[] = [
  {
    key: "welcome",
    title: "Get the right things done.",
    body: "GSD turns the Eisenhower matrix into a calm place to decide what matters, then do it.",
    visual: <GsdLogo size={64} />,
  },
  {
    key: "matrix",
    title: "Four quadrants, one decision.",
    body: "Every task sorts by two questions: is it urgent, is it important? The matrix makes the priority obvious.",
    visual: (
      <div className="grid grid-cols-2 gap-2" aria-hidden>
        {QUADRANTS.map((q) => (
          <div
            key={q.key}
            className="flex h-16 w-24 flex-col justify-between rounded-lg border p-2 text-left"
            style={{
              borderColor: `color-mix(in srgb, var(--${q.key}) 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, var(--${q.key}) 12%, transparent)`,
            }}
          >
            <span className="text-[11px] font-semibold" style={{ color: `var(--${q.key})` }}>
              {q.label}
            </span>
            <span className="text-[9px] text-foreground-muted">{q.tag}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "capture",
    title: "Capture at the speed of thought.",
    body: "Type a task and add !! for urgent, * for important, and #tags. The quadrant chip updates live as you type.",
    visual: (
      <div className="flex w-full max-w-[260px] items-center gap-2 rounded-full border border-border bg-background px-3 py-2" aria-hidden>
        <ZapIcon className="h-4 w-4" style={{ color: "var(--q1)" }} />
        <span className="text-sm text-foreground-muted">Ship the deploy </span>
        <span className="text-sm font-semibold" style={{ color: "var(--q1)" }}>!!</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: "var(--q1-wash)", color: "var(--q1)" }}
        >
          Do First
        </span>
      </div>
    ),
  },
  {
    key: "privacy",
    title: "Your data stays yours.",
    body: "Everything lives in this browser, fully offline. Turn on optional sync only if you want your tasks on more than one device.",
    visual: (
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--olive-tint)" }}
        aria-hidden
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--olive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
    ),
  },
];

export function Onboarding({ open, onClose, onSignIn }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Reset to the first screen each time the flow opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Escape dismisses the flow.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const screen = SCREENS[index];
  const isLast = index === SCREENS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--backdrop)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card px-6 pb-6 pt-12 text-center shadow-[var(--shadow-lg)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Skip"
          className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
        >
          Skip
          <XIcon className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-h-[140px] items-center justify-center">{screen.visual}</div>

        <h2 id={titleId} className="rd-serif mt-6 text-[26px] leading-tight text-foreground" style={{ letterSpacing: "-0.02em" }}>
          {screen.title}
        </h2>
        <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-foreground-muted">
          {screen.body}
        </p>

        {/* Page dots */}
        <div className="mt-6 flex items-center gap-2" aria-hidden>
          {SCREENS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-accent" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex w-full flex-col items-center gap-2">
          {isLast ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-[15px] font-semibold text-card transition-colors hover:bg-accent-hover"
                style={{ color: "var(--ivory)" }}
              >
                Start using GSD
              </button>
              {onSignIn ? (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground"
                >
                  Sign in to sync
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, SCREENS.length - 1))}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-[15px] font-semibold transition-colors hover:bg-accent-hover"
              style={{ color: "var(--ivory)" }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
