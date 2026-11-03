import Link from "next/link";
import type { Route } from "next";

/**
 * Presentational pieces of the Field Guide (help-drawer.tsx). Split out so the
 * section content in help-drawer-sections.tsx reads as copy, not markup.
 */

export const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--t-small)",
  lineHeight: 1.55,
  color: "var(--gray-700)",
};

export const codeStyle: React.CSSProperties = {
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

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 className="text-eyebrow uppercase" style={{ margin: 0, color: "var(--gray-500)" }}>
        {label}
      </h3>
      {children}
    </section>
  );
}

/** One short paragraph, optionally led by a bold term ("Complete: …"). */
export function Para({ lead, muted, children }: { lead?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <p style={muted ? { ...bodyStyle, color: "var(--gray-500)" } : bodyStyle}>
      {lead ? <strong>{lead}</strong> : null}
      {lead ? ": " : null}
      {children}
    </p>
  );
}

/** An in-app link that closes the drawer as it navigates. */
export function HelpLink({ href, onClose, children }: { href: Route; onClose: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} style={linkStyle} onClick={onClose}>
      {children}
    </Link>
  );
}

export function QuadrantLine({ rdKey, title, hint }: { rdKey: "q1" | "q2" | "q3" | "q4"; title: string; hint: string }) {
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
        style={{ width: 10, height: 10, borderRadius: 999, background: `var(--${rdKey})`, display: "inline-block" }}
      />
      <div>
        <div style={{ fontWeight: 600, color: "var(--slate)", fontSize: "var(--t-small)" }}>{title}</div>
        <div style={{ fontSize: "var(--t-caption)", color: "var(--gray-500)", lineHeight: 1.4 }}>{hint}</div>
      </div>
    </div>
  );
}

export function SyntaxRow({ symbol, meaning }: { symbol: string; meaning: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "var(--t-small)" }}>
      <code style={{ ...codeStyle, minWidth: 40, textAlign: "center" }}>{symbol}</code>
      <span style={{ color: "var(--gray-700)" }}>{meaning}</span>
    </div>
  );
}

export function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
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
