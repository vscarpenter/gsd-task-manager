"use client";

import { useRef } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
        className="redesign-scope rd-fade-in max-h-[calc(100dvh-env(safe-area-inset-top))] border-card-border bg-transparent p-0 [&>button]:right-[max(1rem,env(safe-area-inset-right))] [&>button]:top-[max(1rem,env(safe-area-inset-top))] md:left-auto md:right-0 md:top-0 md:h-[100dvh] md:max-h-[100dvh] md:w-[520px] md:max-w-[520px] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-l md:border-t-0 md:overflow-hidden md:p-0"
        style={{ paddingBottom: 0 }}
      >
        <div
          style={{
            background: "var(--paper)",
            display: "flex",
            height: "100%",
            minHeight: "inherit",
            flexDirection: "column",
            boxShadow: "var(--rd-shadow-lg)",
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
            <div
              style={{
                fontSize: 12,
                letterSpacing: 0.12,
                textTransform: "uppercase",
                color: "var(--ink-3)",
                fontWeight: 600,
              }}
            >
              Field guide
            </div>
            <DialogTitle asChild className="text-h1">
              <h2 style={{ margin: "4px 0 0" }}>
                How to use <em style={{ fontStyle: "italic", color: "var(--accent)" }}>GSD</em>
              </h2>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Overview of the Eisenhower matrix, capture bar syntax, keyboard shortcuts, and sync guidance.
            </DialogDescription>
          </div>
        </header>

        <div
          data-testid="help-drawer-scroll"
          className="pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[1.375rem]"
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 28 }}
        >
          <Section label="One board, one capture bar">
            <Concept title="The matrix" accent="var(--accent)">
              The classic 2×2 Eisenhower board is your home view. Drag a task between quadrants to reclassify it; hover a
              quadrant while dragging to see the drop target highlight.
            </Concept>
            <Concept title="The capture bar" accent="var(--accent)">
              Every task starts in the bar at the top. Type your task, hit{" "}
              <kbd>Enter</kbd>, and the parser routes it to the right quadrant based on{" "}
              <code style={codeStyle}>!</code> / <code style={codeStyle}>*</code> markers — or press{" "}
              <kbd>Tab</kbd> to reach the destination control, then use <kbd>Enter</kbd> or <kbd>Space</kbd> to cycle it
              manually.
            </Concept>
          </Section>

          <Section label="The four quadrants">
            <QuadrantLine rdKey="q1" title="Do First" hint="Urgent & important: crises, deadlines. Handle now." />
            <QuadrantLine rdKey="q2" title="Schedule" hint="Important, not urgent: strategy, growth. Protect time." />
            <QuadrantLine rdKey="q3" title="Delegate" hint="Urgent, not important: interruptions. Hand these off." />
            <QuadrantLine rdKey="q4" title="Eliminate" hint="Neither: noise. Stop doing these." />
          </Section>

          <Section label="Quick-add smart syntax">
            <p style={bodyStyle}>
              Type into the bar at the top. It parses priority markers from your text as you type. The dot on the left previews
              which quadrant the task will land in.
            </p>
            <SyntaxRow symbol="!" meaning="Marks the task urgent" />
            <SyntaxRow symbol="!!" meaning="Urgent and important (Do First)" />
            <SyntaxRow symbol="*" meaning="Marks the task important" />
            <SyntaxRow symbol="#tag" meaning="Adds a tag (any word-like token)" />
            <p style={{ ...bodyStyle, color: "var(--ink-3)" }}>
              Example: <code style={codeStyle}>!! ship the deck #work #q2</code> creates an urgent + important task tagged{" "}
              <code style={codeStyle}>#work</code> and <code style={codeStyle}>#q2</code>.
            </p>
          </Section>

          <Section label="Keyboard shortcuts">
            <ShortcutRow keys={["n"]} action="Jump to the capture bar" />
            <ShortcutRow keys={["⌘", "K"]} action="Open the command palette" />
            <ShortcutRow keys={["Shift", "N"]} action="Open the full composer" />
            <ShortcutRow keys={["/"]} action="Focus the search field" />
            <ShortcutRow keys={["⌥", "/"]} action="Open universal search" />
            <ShortcutRow keys={["⌥", "N"]} action="Focus Quick Capture from anywhere" />
            <ShortcutRow keys={["⌥", "R"]} action="Open Review" />
            <ShortcutRow keys={["⌥", "1–4"]} action="Focus a matrix quadrant" />
            <ShortcutRow keys={["Enter"]} action="Submit the task (in the capture bar)" />
            <ShortcutRow keys={["?"]} action="Open this help drawer" />
            <ShortcutRow keys={["Esc"]} action="Close any open drawer" />
            <p style={{ ...bodyStyle, color: "var(--ink-3)", fontSize: 12 }}>
              Option shortcuts follow the physical key position and are suppressed while a text field or modal is active,
              so typing in Quick Capture or the composer won&rsquo;t hijack keys.
            </p>
          </Section>

          <Section label="Editing, completing, and drag-drop">
            <p style={bodyStyle}>
              <strong>Complete</strong>: tap the checkbox on any task card. Recurring tasks automatically spawn the next instance.
            </p>
            <p style={bodyStyle}>
              <strong>Edit</strong>: hover a task card and click the pencil to open the composer pre-filled with that
              task&rsquo;s details. On a phone the pencil is always visible. Save to update, close without saving to cancel.
            </p>
            <p style={bodyStyle}>
              <strong>Drag to reclassify</strong>: drag a task onto any other quadrant. An 8-pixel activation distance
              means a stray click never starts a drag.
            </p>
          </Section>

          <Section label="Cloud sync (optional)">
            <p style={bodyStyle}>
              The cloud icon in the top bar is your sync control. Click it to sign in with Google, Apple, or GitHub — once
              enabled, your tasks sync across devices against a self-hosted PocketBase backend.
            </p>
            <p style={{ ...bodyStyle, color: "var(--ink-3)" }}>
              An aubergine badge means there are pending changes to push; a coral&nbsp;<em>!</em> badge means the session expired and you
              need to re-authenticate. Visit{" "}
              <Link href={"/sync-history" as const} style={linkStyle} onClick={onClose}>
                Sync history
              </Link>{" "}
              for a recent log, or{" "}
              <Link href={ROUTES.SETTINGS} style={linkStyle} onClick={onClose}>
                Settings
              </Link>{" "}
              to change the auto-sync interval or disable sync entirely.
            </p>
          </Section>

          <PrivacySection onClose={onClose} />
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Split out so the drawer body stays under the code-shape ceiling; it is the
 * one section that grows as new settings surfaces (sync, feedback) need a
 * pointer from here.
 */
function PrivacySection({ onClose }: { onClose: () => void }) {
  return (
    <Section label="Privacy">
      <p style={bodyStyle}>
        Tasks live in your browser&rsquo;s IndexedDB. Nothing is sent to a server unless you explicitly enable sync in{" "}
        <Link href={ROUTES.SETTINGS} style={linkStyle} onClick={onClose}>
          Settings
        </Link>
        . The app works fully offline.
      </p>
      <p style={bodyStyle}>
        Something rough or missing?{" "}
        <Link href="/settings#feedback" style={linkStyle} onClick={onClose}>
          Send feedback
        </Link>
        . It&rsquo;s anonymous, and you can read exactly what is sent before it goes.
      </p>
      <p style={bodyStyle}>
        Want the full story?{" "}
        <Link href={"/about" as const} style={linkStyle} onClick={onClose}>
          Read the About page →
        </Link>
      </p>
    </Section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.12,
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

function Concept({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{ width: 4, borderRadius: 3, background: accent, alignSelf: "stretch", flexShrink: 0, minHeight: 36 }}
      />
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: "var(--ink)" }}>
          {title}
        </div>
        <p style={{ ...bodyStyle, marginTop: 2 }}>{children}</p>
      </div>
    </div>
  );
}

function QuadrantLine({
  rdKey,
  title,
  hint,
}: {
  rdKey: "q1" | "q2" | "q3" | "q4";
  title: string;
  hint: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "12px 1fr",
        gap: 12,
        alignItems: "center",
        padding: "8px 10px",
        background: `var(--${rdKey}-soft)`,
        borderRadius: 10,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: `var(--${rdKey})`,
          display: "inline-block",
        }}
      />
      <div>
        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13.5 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.4 }}>{hint}</div>
      </div>
    </div>
  );
}

function SyntaxRow({ symbol, meaning }: { symbol: string; meaning: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
      <code style={{ ...codeStyle, minWidth: 40, textAlign: "center" }}>{symbol}</code>
      <span style={{ color: "var(--ink-2)" }}>{meaning}</span>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 4, minWidth: 80 }}>
        {keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </div>
      <span style={{ color: "var(--ink-2)" }}>{action}</span>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.55,
  color: "var(--ink-2)",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: "var(--r-xs)",
  border: "var(--line)",
  background: "var(--bg-inset)",
  color: "var(--ink)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
