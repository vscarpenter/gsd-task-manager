"use client";

import { Calendar, Clock, Flame, Layers, Trash2, Users, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { quadrantByRdKey, type QuadrantMeta, type RedesignIconKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { formatDueShort, dueBucket } from "@/lib/redesign/due";

export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2"
      style={{
        height: 20,
        background: "var(--bg-inset)",
        color: "var(--ink-3)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.02,
      }}
    >
      <span style={{ opacity: 0.55 }}>#</span>
      {children}
    </span>
  );
}

export function DuePill({ dueDate }: { dueDate: string | undefined }) {
  const label = formatDueShort(dueDate);
  if (!label) return null;
  const bucket = dueBucket(dueDate);
  const isOverdue = bucket === "overdue";
  const isToday = bucket === "today";
  const color = isOverdue ? "var(--q1)" : isToday ? "var(--q2)" : "var(--ink-3)";
  const bg = isOverdue ? "var(--q1-soft)" : isToday ? "var(--q2-soft)" : "transparent";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2"
      style={{
        height: 20,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        border: bg === "transparent" ? "1px solid var(--line)" : "none",
      }}
    >
      {isOverdue ? <AlertCircle size={10} strokeWidth={2.2} /> : <Clock size={10} strokeWidth={2.2} />}
      {label}
    </span>
  );
}

const ICON_MAP: Record<RedesignIconKey, typeof Flame> = {
  flame: Flame,
  calendar: Calendar,
  users: Users,
  trash: Trash2,
};

export function RdQuadrantIcon({ icon, size = 14, strokeWidth = 2 }: { icon: RedesignIconKey; size?: number; strokeWidth?: number }) {
  const I = ICON_MAP[icon];
  return <I size={size} strokeWidth={strokeWidth} />;
}

export function QuadrantBadge({ quadrant, size = "md" }: { quadrant: QuadrantMeta | RedesignQuadrantKey; size?: "sm" | "md" }) {
  const meta = typeof quadrant === "string" ? quadrantByRdKey(quadrant) : quadrant;
  const dim = size === "sm" ? 20 : 26;
  return (
    <span
      title={meta.title}
      className="inline-grid place-items-center"
      style={{
        width: dim,
        height: dim,
        borderRadius: 7,
        background: `var(--${meta.rdKey}-tint)`,
        color: `var(--${meta.rdKey})`,
      }}
    >
      <RdQuadrantIcon icon={meta.rdIcon} size={size === "sm" ? 11 : 14} strokeWidth={2} />
    </span>
  );
}

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
}: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const h = size === "sm" ? 28 : 34;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-[2px] rounded-[10px] p-[3px]"
      style={{
        background: "var(--bg-inset)",
        height: h + 6,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className="inline-flex items-center gap-1.5 rounded-lg"
            style={{
              border: 0,
              background: active ? "var(--paper)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
              padding: "0 12px",
              fontWeight: 500,
              fontSize: 13,
              height: h,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Divider({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={{ height: 1, background: "var(--line-soft)", ...style }} />;
}

export function SubtaskChip({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2"
      style={{
        height: 20,
        border: "1px solid var(--line)",
        color: "var(--ink-3)",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      <Layers size={10} strokeWidth={2} />
      {done}/{total}
    </span>
  );
}

export function RdIconButton({
  children,
  onClick,
  title,
  style,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      className="inline-flex items-center justify-center transition-colors"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        border: "1px solid transparent",
        background: "transparent",
        color: "var(--ink-3)",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-inset)";
        e.currentTarget.style.color = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (style?.background as string) ?? "transparent";
        e.currentTarget.style.color = (style?.color as string) ?? "var(--ink-3)";
      }}
    >
      {children}
    </button>
  );
}

export function RdButton({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "default" | "primary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    fontWeight: 500,
    fontSize: 13.5,
    transition: "background .15s, border-color .15s, transform .05s",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    default: { border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" },
    primary: { border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--paper)" },
    ghost: { border: "1px solid transparent", background: "transparent", color: "var(--ink-2)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
