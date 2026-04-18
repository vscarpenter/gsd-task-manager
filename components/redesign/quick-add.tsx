"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Flame, MoreHorizontal, Sparkles } from "lucide-react";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";

export interface QuickAddSubmit {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

export interface QuickAddProps {
  onSubmit: (draft: QuickAddSubmit) => void;
  onOpenFull: () => void;
  presetQuadrant?: RedesignQuadrantKey | null;
}

export function QuickAdd({ onSubmit, onOpenFull, presetQuadrant }: QuickAddProps) {
  const [value, setValue] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!presetQuadrant) return;
    const q = quadrantByRdKey(presetQuadrant);
    setUrgent(q.urgent);
    setImportant(q.important);
  }, [presetQuadrant]);

  const parsed = useMemo(() => {
    const v = value;
    let u = urgent;
    let i = important;
    if (v.includes("!!")) {
      u = true;
      i = true;
    } else if (/(^|\s)!/.test(v)) {
      u = true;
    }
    if (v.includes("*")) i = true;
    const tags = Array.from(v.matchAll(/#([\w-]+)/g)).map((m) => m[1]);
    const clean = v
      .replace(/#[\w-]+/g, "")
      .replace(/!+|\*+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return { urgent: u, important: i, tags, clean };
  }, [value, urgent, important]);

  const inferredKey: RedesignQuadrantKey =
    parsed.urgent && parsed.important
      ? "q1"
      : !parsed.urgent && parsed.important
        ? "q2"
        : parsed.urgent
          ? "q3"
          : "q4";

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!parsed.clean) return;
    onSubmit({
      title: parsed.clean,
      urgent: parsed.urgent,
      important: parsed.important,
      tags: parsed.tags,
    });
    setValue("");
    setUrgent(false);
    setImportant(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: "relative",
        background: "var(--paper)",
        border: `1px solid ${focused ? "var(--ink-2)" : "var(--line)"}`,
        borderRadius: 14,
        padding: "4px 4px 4px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "border-color .15s, box-shadow .15s",
        boxShadow: focused ? "0 0 0 4px rgba(24,24,27,.05)" : "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: `var(--${inferredKey})`,
          transition: "background .15s",
          flexShrink: 0,
        }}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Tell me what needs doing…   use ! urgent  * important  #tag"
        style={{
          flex: 1,
          border: 0,
          outline: 0,
          background: "transparent",
          fontSize: 14.5,
          padding: "10px 0",
          color: "var(--ink)",
        }}
      />
      {focused && (
        <span className="rd-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginRight: 6 }}>
          <kbd>⏎</kbd>
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <TogglePill
          active={parsed.urgent}
          onClick={() => setUrgent((u) => !u)}
          label="Urgent"
          activeColor="var(--q1)"
          icon={<Flame size={12} strokeWidth={2.2} />}
        />
        <TogglePill
          active={parsed.important}
          onClick={() => setImportant((i) => !i)}
          label="Important"
          activeColor="var(--q2)"
          icon={<Sparkles size={12} strokeWidth={2.2} />}
        />
        <button
          type="button"
          onClick={onOpenFull}
          title="Open full composer"
          aria-label="Open full composer"
          className="inline-flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid transparent",
            background: "transparent",
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5"
          style={{
            height: 30,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid var(--ink)",
            background: "var(--ink)",
            color: "var(--paper)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Add
          <ArrowRight size={13} strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}

function TogglePill({
  active,
  onClick,
  label,
  activeColor,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeColor: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1.5"
      style={{
        height: 30,
        padding: "0 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: active ? activeColor : "var(--paper)",
        color: active ? "#fff" : "var(--ink-2)",
        fontSize: 12,
        fontWeight: 600,
        transition: "all .15s",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
