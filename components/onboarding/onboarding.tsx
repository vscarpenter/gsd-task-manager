"use client";

import { useState } from "react";
import { XIcon, ZapIcon } from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
              backgroundColor: `var(--${q.key}-wash)`,
            }}
          >
            <span className="text-caption font-semibold" style={{ color: `var(--${q.key}-ink)` }}>
              {q.label}
            </span>
            <span className="text-caption text-foreground-muted">{q.tag}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "capture",
    title: "Type a task, add a marker.",
    body: "A marker in the text picks the quadrant: !! for Do First, * for Schedule, ! for Delegate. With no marker, a task goes to Eliminate. Add #tags to label it. The quadrant button at the end of the bar shows where the task will go.",
    visual: (
      <div className="flex w-full max-w-[260px] items-center gap-2 rounded-full border border-border bg-background px-3 py-2" aria-hidden>
        <ZapIcon className="h-4 w-4" style={{ color: "var(--q1-ink)" }} />
        <span className="text-sm text-foreground-muted">Pay the invoice </span>
        <span className="text-sm font-semibold" style={{ color: "var(--q1-ink)" }}>!!</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-caption font-medium"
          style={{ backgroundColor: "var(--q1-header)", color: "var(--q1-ink)" }}
        >
          Do First
        </span>
      </div>
    ),
  },
  {
    key: "privacy",
    title: "Your data stays yours.",
    body: "Your tasks are saved in this browser and work offline. Sync is optional. If you turn it on, your tasks are uploaded to a server run by GSD's developer.",
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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      {open ? <OnboardingDialog onClose={onClose} onSignIn={onSignIn} /> : null}
    </Dialog>
  );
}

function OnboardingDialog({ onClose, onSignIn }: Omit<OnboardingProps, "open">) {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];
  const isLast = index === SCREENS.length - 1;

  return (
    <DialogContent
      showCloseButton={false}
      className="inset-auto left-1/2 top-1/2 bottom-auto flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-border bg-card px-6 pb-6 pt-12 text-center shadow-[var(--shadow-lg)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Skip"
        className="touch-target absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-small font-medium text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
      >
        Skip
        <XIcon className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div className="flex min-h-[140px] items-center justify-center">{screen.visual}</div>

      <DialogTitle className="mt-6 text-h2 text-foreground">
        {screen.title}
      </DialogTitle>
      <DialogDescription className="mt-3 max-w-[44ch] text-body leading-relaxed text-foreground-muted">
        {screen.body}
      </DialogDescription>

      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {SCREENS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color]",
              i === index ? "w-5 bg-accent" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>

      <div className="mt-6 flex w-full flex-col items-center gap-2">
        {isLast ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="touch-target w-full rounded-lg bg-accent px-4 py-2.5 text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Start using GSD
            </button>
            {onSignIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="touch-target text-small font-medium text-foreground-muted transition-colors hover:text-foreground"
              >
                Sign in to sync
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, SCREENS.length - 1))}
            className="touch-target w-full rounded-lg bg-accent px-4 py-2.5 text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            Next
          </button>
        )}
      </div>
    </DialogContent>
  );
}
