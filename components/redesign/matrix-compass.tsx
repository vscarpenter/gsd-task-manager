"use client";

import { useMemo } from "react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import { Divider } from "./primitives";

export type MatrixCompassVariant = "grid" | "list";

export interface MatrixCompassProps {
  tasks: TaskRecord[];
  variant: MatrixCompassVariant;
  label: string;
  onAdd?: (quadrantKey: RedesignQuadrantKey) => void;
}

function computeCounts(tasks: TaskRecord[]) {
  const byQuadrant: Record<RedesignQuadrantKey, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
  let total = 0;
  tasks.forEach((t) => {
    if (t.completed) return;
    total++;
    const key: RedesignQuadrantKey =
      t.urgent && t.important ? "q1" : !t.urgent && t.important ? "q2" : t.urgent ? "q3" : "q4";
    byQuadrant[key]++;
  });
  return { byQuadrant, total };
}

export function MatrixCompass({ tasks, variant, label, onAdd }: MatrixCompassProps) {
  const { byQuadrant, total } = useMemo(() => computeCounts(tasks), [tasks]);
  const growthPct = Math.round((byQuadrant.q2 / Math.max(total, 1)) * 100);

  return (
    <aside className="rd-compass" style={{ position: "sticky", top: 20 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.12,
          textTransform: "uppercase",
          color: "var(--ink-3)",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rd-radius-lg)",
          padding: 14,
        }}
      >
        {variant === "grid" ? (
          <CompassGrid byQuadrant={byQuadrant} onAdd={onAdd} />
        ) : (
          <CompassList byQuadrant={byQuadrant} total={total} />
        )}
        <Divider style={{ margin: "12px 0" }} />
        <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--ink)" }}>{total}</strong> active · {growthPct}% in the{" "}
          <em className="rd-serif" style={{ fontStyle: "italic" }}>
            growth
          </em>{" "}
          quadrant
        </div>
      </div>
    </aside>
  );
}

function CompassGrid({
  byQuadrant,
  onAdd,
}: {
  byQuadrant: Record<RedesignQuadrantKey, number>;
  onAdd?: (quadrantKey: RedesignQuadrantKey) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {quadrants.map((q) => {
        const count = byQuadrant[q.rdKey];
        const interactive = Boolean(onAdd);
        const content = (
          <>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: `var(--${q.rdKey})`,
                letterSpacing: 0.04,
                textTransform: "uppercase",
              }}
            >
              {q.rdShort}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{q.title}</div>
            <div
              className="rd-serif"
              style={{
                position: "absolute",
                right: 10,
                bottom: 6,
                fontSize: 26,
                color: `var(--${q.rdKey})`,
                lineHeight: 1,
              }}
            >
              {count}
            </div>
          </>
        );
        const sharedStyle: React.CSSProperties = {
          background: `var(--${q.rdKey}-tint)`,
          borderRadius: 10,
          padding: "10px 10px 12px",
          minHeight: 78,
          position: "relative",
          border: 0,
          textAlign: "left",
        };
        return interactive ? (
          <button
            key={q.rdKey}
            type="button"
            onClick={() => onAdd?.(q.rdKey)}
            style={{ ...sharedStyle, cursor: "pointer" }}
          >
            {content}
          </button>
        ) : (
          <div key={q.rdKey} style={sharedStyle}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function CompassList({
  byQuadrant,
  total,
}: {
  byQuadrant: Record<RedesignQuadrantKey, number>;
  total: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {quadrants.map((q) => {
        const count = byQuadrant[q.rdKey];
        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <div
            key={q.rdKey}
            style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: `var(--${q.rdKey})`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: "var(--ink-2)",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {q.title}
            </span>
            <span className="rd-mono" style={{ color: "var(--ink-3)", fontSize: 11.5 }}>
              {count}
            </span>
            <span style={{ width: 40, textAlign: "right", color: "var(--ink-4)", fontSize: 11 }}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
