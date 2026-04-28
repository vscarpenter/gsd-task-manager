"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="redesign-scope rd-fade-in border-card-border bg-transparent p-0 md:left-auto md:right-0 md:top-0 md:h-[100dvh] md:max-h-[100dvh] md:w-[520px] md:max-w-[520px] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-l md:border-t-0 md:overflow-hidden md:p-0"
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
          style={{
            padding: "20px 52px 16px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.12,
                textTransform: "uppercase",
                color: "var(--ink-3)",
                fontWeight: 600,
              }}
            >
              Field guide
            </div>
            <DialogTitle asChild>
              <h2 className="rd-serif" style={{ margin: "4px 0 0", fontSize: 28, lineHeight: 1.1 }}>
                How to use <em style={{ fontStyle: "italic", color: "var(--q2)" }}>GSD</em>
              </h2>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Overview of the focus, matrix, and canvas views plus shortcuts and sync guidance.
            </DialogDescription>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
          <Section label="Three lenses on one list">
            <Concept title="Focus" accent="var(--q2)">
              Default view. An editorial feed grouped{" "}
              <em className="rd-serif" style={{ fontStyle: "italic" }}>Now → Today → Next → Later</em>. Answers{" "}
              <strong>&ldquo;what should I do next?&rdquo;</strong> A small compass shows how many tasks live in each quadrant.
            </Concept>
            <Concept title="Matrix" accent="var(--q1)">
              The classic 2×2 Eisenhower board. Drag a task between quadrants to reclassify it. Hover a quadrant while dragging to
              see the drop target highlight.
            </Concept>
            <Concept title="Canvas" accent="var(--q3)">
              Tasks plotted on a real urgency × importance plane. Useful when you want to see distribution at a glance. Click any
              pill to open its editor.
            </Concept>
          </Section>

          <Section label="The four quadrants">
            <QuadrantLine rdKey="q1" title="Do First" hint="Urgent & important — crises, deadlines. Handle now." />
            <QuadrantLine rdKey="q2" title="Schedule" hint="Important, not urgent — strategy, growth. Protect time." />
            <QuadrantLine rdKey="q3" title="Delegate" hint="Urgent, not important — interruptions. Hand these off." />
            <QuadrantLine rdKey="q4" title="Eliminate" hint="Neither — noise. Stop doing these." />
          </Section>

          <Section label="Quick-add smart syntax">
            <p style={bodyStyle}>
              Type into the bar at the top. It parses priority markers from your text as you type — the dot on the left previews
              which quadrant the task will land in.
            </p>
            <SyntaxRow symbol="!" meaning="Marks the task urgent" />
            <SyntaxRow symbol="!!" meaning="Urgent and important (Do First)" />
            <SyntaxRow symbol="*" meaning="Marks the task important" />
            <SyntaxRow symbol="#tag" meaning="Adds a tag — any word-like token" />
            <p style={{ ...bodyStyle, color: "var(--ink-3)" }}>
              Example: <code style={codeStyle}>!! ship the deck #work #q2</code> creates an urgent + important task tagged{" "}
              <code style={codeStyle}>#work</code> and <code style={codeStyle}>#q2</code>.
            </p>
          </Section>

          <Section label="Keyboard shortcuts">
            <ShortcutRow keys={["N"]} action="Open the full composer" />
            <ShortcutRow keys={["/"]} action="Focus the search field" />
            <ShortcutRow keys={["1"]} action="Switch to Focus view" />
            <ShortcutRow keys={["2"]} action="Switch to Matrix view" />
            <ShortcutRow keys={["3"]} action="Switch to Canvas view" />
            <ShortcutRow keys={["?"]} action="Open this help drawer" />
            <ShortcutRow keys={["Esc"]} action="Close any open drawer" />
            <p style={{ ...bodyStyle, color: "var(--ink-3)", fontSize: 12 }}>
              Shortcuts are suppressed while a text field is focused.
            </p>
          </Section>

          <Section label="Editing, completing, and drag-drop">
            <p style={bodyStyle}>
              <strong>Complete</strong> — tap the checkbox on any task card. Recurring tasks automatically spawn the next instance.
            </p>
            <p style={bodyStyle}>
              <strong>Edit</strong> — click anywhere on a task card (except the checkbox) to open the composer pre-filled with that
              task&rsquo;s details. Save to update, close without saving to cancel.
            </p>
            <p style={bodyStyle}>
              <strong>Drag to reclassify</strong> — in the Matrix view, drag a task onto any other quadrant. An 8-pixel activation
              distance means plain clicks still open the editor.
            </p>
          </Section>

          <Section label="Cloud sync (optional)">
            <p style={bodyStyle}>
              The cloud icon in the top bar is your sync control. Click it to sign in with Google or GitHub — once enabled, your
              tasks sync across devices against a self-hosted PocketBase backend.
            </p>
            <p style={{ ...bodyStyle, color: "var(--ink-3)" }}>
              A blue badge means there are pending changes to push; a red&nbsp;<em>!</em> badge means the session expired and you
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

          <Section label="Privacy">
            <p style={bodyStyle}>
              Tasks live in your browser&rsquo;s IndexedDB. Nothing is sent to a server unless you explicitly enable sync in{" "}
              <Link href={ROUTES.SETTINGS} style={linkStyle} onClick={onClose}>
                Settings
              </Link>
              . The app works fully offline; install it as a PWA from your browser&rsquo;s menu to keep it one tap away.
            </p>
            <p style={bodyStyle}>
              Want the full story?{" "}
              <Link href={"/about" as const} style={linkStyle} onClick={onClose}>
                Read the About page →
              </Link>
            </p>
          </Section>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 11,
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
        <div className="rd-serif" style={{ fontSize: 18, lineHeight: 1.2, color: "var(--ink)" }}>
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
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "var(--bg-inset)",
  color: "var(--ink)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--q2)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
