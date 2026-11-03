"use client";

import { useRef } from "react";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HelpGuideSections } from "./help-drawer-sections";

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        ref={contentRef}
        aria-modal="true"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
          contentRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusOrMainContent(previouslyFocusedRef.current);
          previouslyFocusedRef.current = null;
        }}
        className="animate-sheet-in max-h-[calc(100dvh-env(safe-area-inset-top))] border-card-border bg-transparent p-0 [&>button]:right-[max(1rem,env(safe-area-inset-right))] [&>button]:top-[max(1rem,env(safe-area-inset-top))] md:left-auto md:right-0 md:top-0 md:h-[100dvh] md:max-h-[100dvh] md:w-[520px] md:max-w-[520px] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-l md:border-t-0 md:overflow-hidden md:p-0"
        style={{ paddingBottom: 0 }}
      >
        <div
          style={{
            background: "var(--paper)",
            display: "flex",
            height: "100%",
            minHeight: "inherit",
            flexDirection: "column",
            boxShadow: "var(--shadow-lg)",
          }}
        >
        <header
          className="pb-4 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(3.25rem,calc(1.5rem+env(safe-area-inset-right)))] pt-[max(1.25rem,env(safe-area-inset-top))]"
          style={{
            borderBottom: "var(--border-hair)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <p className="text-eyebrow uppercase" style={{ margin: "0 0 4px", color: "var(--gray-500)" }}>
              Field Guide
            </p>
            <DialogTitle asChild className="text-h1">
              <h2 style={{ margin: 0 }}>How to use GSD</h2>
            </DialogTitle>
            <DialogDescription className="sr-only">
              How the matrix works, adding tasks, due dates and reminders, Saved, finding things, sync, keyboard tips,
              and your data.
            </DialogDescription>
          </div>
        </header>

        <div
          data-testid="help-drawer-scroll"
          className="pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[1.375rem]"
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 28 }}
        >
          <HelpGuideSections onClose={onClose} />
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
