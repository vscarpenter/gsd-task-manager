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
            <DialogTitle asChild className="text-h1">
              <h2 style={{ margin: 0 }}>How to use GSD</h2>
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
            <Concept title="The matrix">
              The classic 2×2 Eisenhower board is your home view. Drag a task onto another quadrant to move it. The
              quadrant under the task lights up as the place it will land.
            </Concept>
            <Concept title="The capture bar">
              Every task starts in the Add a task bar. It is at the top on a computer and at the bottom on a phone. Type
              your task and press <kbd>Enter</kbd>. Markers in the text pick the quadrant (see below). To pick it
              yourself, click or tap the quadrant pill at the right end of the bar. Keyboard tip: press{" "}
              <kbd>Tab</kbd> to reach the destination control, then use <kbd>Enter</kbd> or <kbd>Space</kbd> to cycle it
              manually.
            </Concept>
          </Section>

          <Section label="The four quadrants">
            <QuadrantLine rdKey="q1" title="Do First" hint="Urgent and important. Do these now." />
            <QuadrantLine rdKey="q2" title="Schedule" hint="Important, not urgent. Plan a time for these." />
            <QuadrantLine rdKey="q3" title="Delegate" hint="Urgent, not important. Give these to someone else if you can." />
            <QuadrantLine rdKey="q4" title="Eliminate" hint="Not urgent, not important. Drop or defer these." />
          </Section>

          <Section label="Markers in the Add a task bar">
            <p style={bodyStyle}>
              Add markers to your text. The quadrant pill at the right end of the bar shows where the task will go, and
              you can click or tap it to change that.
            </p>
            <SyntaxRow symbol="!!" meaning="Urgent and important (Do First)" />
            <SyntaxRow symbol="*" meaning="Important (Schedule)" />
            <SyntaxRow symbol="!" meaning="Urgent (Delegate)" />
            <SyntaxRow symbol="none" meaning="No marker: the task goes to Eliminate" />
            <SyntaxRow symbol="#tag" meaning="Adds a tag" />
            <p style={{ ...bodyStyle, color: "var(--gray-500)" }}>
              Example: <code style={codeStyle}>!! send the deck #work #client</code> creates an urgent and important task
              (Do First) tagged <code style={codeStyle}>#work</code> and <code style={codeStyle}>#client</code>.
            </p>
          </Section>

          <Section label="Keyboard tips">
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
            <p style={{ ...bodyStyle, color: "var(--gray-500)", fontSize: "var(--t-caption)" }}>
              Option shortcuts use the key&rsquo;s position on the keyboard. They are off while you type in a text field
              or have a dialog open.
            </p>
          </Section>

          <Section label="Complete, edit, and move tasks">
            <p style={bodyStyle}>
              <strong>Complete</strong>: tap the circle on a task card. Recurring tasks automatically create the next one.
            </p>
            <p style={bodyStyle}>
              <strong>Swipe on a touch screen</strong>: swipe a task right to complete it. Swipe left to snooze it for
              1 hour or delete it.
            </p>
            <p style={bodyStyle}>
              <strong>Edit</strong>: hover a task card and click the pencil to open the composer pre-filled with that
              task&rsquo;s details. On a phone the pencil is always visible. Save to update, close without saving to cancel.
            </p>
            <p style={bodyStyle}>
              <strong>Move</strong>: drag a task onto any other quadrant. A plain click never starts a drag.
            </p>
          </Section>

          <Section label="Cloud sync (optional)">
            <p style={bodyStyle}>
              The cloud icon at the top is your sync control. Click it to sign in with Google, Apple, or GitHub. Signing
              in creates a sync account and uploads the tasks already in this browser to a server run by GSD&rsquo;s
              developer. After that, your devices stay in step.
            </p>
            <p style={{ ...bodyStyle, color: "var(--gray-500)" }}>
              A number on the icon counts changes waiting to sync. An exclamation mark means your session expired. Click
              the icon to sign in again. Visit{" "}
              <Link href={"/sync-history" as const} style={linkStyle} onClick={onClose}>
                Sync history
              </Link>{" "}
              for a recent log, or{" "}
              <Link href={ROUTES.SETTINGS} style={linkStyle} onClick={onClose}>
                Settings
              </Link>{" "}
              to change how often it syncs, sign out, or delete the account.
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
        Tasks live in your browser&rsquo;s IndexedDB. Nothing is sent to a server unless you turn on sync with the cloud icon at the top. The app works fully offline.
        Sync settings are in{" "}
        <Link href={ROUTES.SETTINGS} style={linkStyle} onClick={onClose}>
          Settings
        </Link>{" "}
        once you are signed in.
      </p>
      <p style={bodyStyle}>
        Something rough or missing?{" "}
        <Link href="/settings#feedback" style={linkStyle} onClick={onClose}>
          Send feedback
        </Link>
        . It has no account or device identifier, and you can read exactly what is sent before it goes.
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
      <h3 className="text-eyebrow uppercase" style={{ margin: 0, color: "var(--gray-500)" }}>
        {label}
      </h3>
      {children}
    </section>
  );
}

function Concept({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-h3" style={{ color: "var(--slate)" }}>
        {title}
      </div>
      <p style={{ ...bodyStyle, marginTop: 2 }}>{children}</p>
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
        background: `var(--${rdKey}-wash)`,
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
        <div style={{ fontWeight: 600, color: "var(--slate)", fontSize: "var(--t-small)" }}>{title}</div>
        <div style={{ fontSize: "var(--t-caption)", color: "var(--gray-500)", lineHeight: 1.4 }}>{hint}</div>
      </div>
    </div>
  );
}

function SyntaxRow({ symbol, meaning }: { symbol: string; meaning: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "var(--t-small)" }}>
      <code style={{ ...codeStyle, minWidth: 40, textAlign: "center" }}>{symbol}</code>
      <span style={{ color: "var(--gray-700)" }}>{meaning}</span>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "var(--t-small)" }}>
      <div style={{ display: "flex", gap: 4, minWidth: 80 }}>
        {keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </div>
      <span style={{ color: "var(--gray-700)" }}>{action}</span>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--t-small)",
  lineHeight: 1.55,
  color: "var(--gray-700)",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: "var(--t-caption)",
  padding: "2px 8px",
  borderRadius: "var(--r-xs)",
  background: "var(--gray-100)",
  color: "var(--slate)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
