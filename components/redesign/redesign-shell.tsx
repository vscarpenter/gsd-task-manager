"use client";

import Link from "next/link";
import type { Route } from "next";
import { Focus, Grid2x2, HelpCircle, Info, LineChart, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { ROUTES } from "@/lib/routes";
import { Segmented } from "./primitives";
import { RedesignSyncButton } from "./sync-button";
import { RedesignLogo } from "./redesign-logo";

export type RedesignView = "focus" | "editorial" | "canvas";

export interface RedesignShellProps {
  view: RedesignView;
  onViewChange: (v: RedesignView) => void;
  onOpenComposer: () => void;
  onOpenHelp: () => void;
  searchQuery: string;
  onSearchChange: (s: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  children: ReactNode;
}

const VIEW_LABELS: Record<RedesignView, string> = {
  focus: "Focus",
  editorial: "Matrix",
  canvas: "Canvas",
};

export function RedesignShell({
  view,
  onViewChange,
  onOpenComposer,
  onOpenHelp,
  searchQuery,
  onSearchChange,
  searchInputRef,
  children,
}: RedesignShellProps) {
  return (
    <div className="redesign-scope" style={{ display: "grid", gridTemplateColumns: "232px minmax(0, 1fr)", minHeight: "100dvh" }}>
      <Sidebar view={view} onViewChange={onViewChange} onOpenHelp={onOpenHelp} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar
          view={view}
          onViewChange={onViewChange}
          onOpenComposer={onOpenComposer}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
        />
        <main style={{ flex: 1, padding: "22px 36px 48px", maxWidth: 1320, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onViewChange,
  onOpenHelp,
}: {
  view: RedesignView;
  onViewChange: (v: RedesignView) => void;
  onOpenHelp: () => void;
}) {
  const items: { id: RedesignView; label: string; icon: ReactNode; hint: string }[] = [
    { id: "focus", label: "Focus", icon: <Focus size={15} />, hint: "What to do now" },
    { id: "editorial", label: "Matrix", icon: <Grid2x2 size={15} />, hint: "Four quadrants" },
    { id: "canvas", label: "Canvas", icon: <LineChart size={15} />, hint: "2D plane" },
  ];
  return (
    <aside
      style={{
        background: "var(--bg)",
        borderRight: "1px solid var(--line-soft)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100dvh",
      }}
      className="rd-sidebar"
    >
      <div style={{ padding: "4px 10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <RedesignLogo size={30} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>GSD</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Focus on what matters</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionLabel>Workspace</SectionLabel>
        {items.map((it) => {
          const active = view === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onViewChange(it.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: 0,
                background: active ? "var(--bg-inset)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-2)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                textAlign: "left",
              }}
            >
              <span style={{ color: active ? "var(--ink)" : "var(--ink-3)" }}>{it.icon}</span>
              <span>{it.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-4)" }}>{it.hint}</span>
            </button>
          );
        })}

        <SectionLabel style={{ marginTop: 18 }}>Elsewhere</SectionLabel>
        <SidebarLink href={ROUTES.DASHBOARD} label="Dashboard" />
        <SidebarLink href={"/archive" as Route} label="Archive" />
        <SidebarLink href={"/sync-history" as Route} label="Sync history" />
        <SidebarLink href={ROUTES.SETTINGS} label="Settings" />

        <SectionLabel style={{ marginTop: 18 }}>Learn</SectionLabel>
        <SidebarAction icon={<HelpCircle size={14} />} label="Help" hint="?" onClick={onOpenHelp} />
        <SidebarLink href={ROUTES.ABOUT} label="About" icon={<Info size={14} />} />
      </nav>

      <SidebarFooter />
    </aside>
  );
}

function SidebarFooter() {
  const version = process.env.NEXT_PUBLIC_BUILD_NUMBER || "dev";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;
  return (
    <div
      style={{
        marginTop: "auto",
        fontSize: 11,
        color: "var(--ink-3)",
        padding: "0 10px",
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--q3)" }} />
        <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Saved locally</span>
      </div>
      <div>No account needed · Works offline</div>
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid var(--line-soft)",
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 10.5,
          color: "var(--ink-4)",
        }}
      >
        <span className="rd-mono" style={{ color: "var(--ink-3)", fontWeight: 500 }}>
          v{version}
        </span>
        {buildDate && (
          <>
            <span aria-hidden>·</span>
            <span title={`Built ${buildDate}`}>{buildDate}</span>
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: 0.14,
        textTransform: "uppercase",
        color: "var(--ink-4)",
        fontWeight: 600,
        padding: "0 10px",
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SidebarLink({ href, label, icon }: { href: Route; label: string; icon?: ReactNode }) {
  return (
    <Link
      href={href}
      className="rd-nav-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        color: "var(--ink-2)",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
      }}
    >
      {icon ? (
        <span style={{ color: "var(--ink-3)", display: "inline-flex", width: 14, justifyContent: "center" }}>{icon}</span>
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--ink-4)" }} />
      )}
      {label}
    </Link>
  );
}

function SidebarAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        border: 0,
        background: "transparent",
        color: "var(--ink-2)",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "left",
      }}
    >
      <span style={{ color: "var(--ink-3)", display: "inline-flex", width: 14, justifyContent: "center" }}>{icon}</span>
      <span>{label}</span>
      {hint && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-4)" }}>{hint}</span>}
    </button>
  );
}

function TopBar({
  view,
  onViewChange,
  onOpenComposer,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: {
  view: RedesignView;
  onViewChange: (v: RedesignView) => void;
  onOpenComposer: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <header
      className="rd-topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        // Fallback to opaque --bg for browsers without relative color syntax support.
        background: "var(--bg)",
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line-soft)",
        padding: "12px 36px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Segmented<RedesignView>
          size="sm"
          value={view}
          onChange={onViewChange}
          ariaLabel="View"
          options={[
            { value: "focus", label: "Focus", icon: <Focus size={13} /> },
            { value: "editorial", label: "Matrix", icon: <Grid2x2 size={13} /> },
            { value: "canvas", label: "Canvas", icon: <LineChart size={13} /> },
          ]}
        />
      </div>

      <div
        className="rd-topbar__search"
        style={{
          flex: 1,
          maxWidth: 440,
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          borderRadius: 10,
          background: "var(--bg-inset)",
          color: "var(--ink-3)",
        }}
      >
        <Search size={14} />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${VIEW_LABELS[view]}…`}
          aria-label={`Search ${VIEW_LABELS[view]}`}
          style={{
            border: 0,
            background: "transparent",
            outline: 0,
            flex: 1,
            fontSize: 13,
            color: "var(--ink)",
          }}
        />
        <kbd>/</kbd>
      </div>

      <div className="rd-topbar__actions">
        <RedesignSyncButton />

        <button
          type="button"
          onClick={onOpenComposer}
          className="inline-flex items-center gap-2"
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid var(--ink)",
            background: "var(--ink)",
            color: "var(--paper)",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> New task
          <kbd
            className="hidden sm:inline-flex"
            style={{
              marginLeft: 2,
              background: "rgba(255,255,255,.12)",
              color: "#fff",
              borderColor: "rgba(255,255,255,.2)",
            }}
          >
            N
          </kbd>
        </button>
      </div>
    </header>
  );
}
