"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, quadrantForTask, type RedesignQuadrantKey } from "@/lib/quadrants";
import { isOverdue } from "@/lib/redesign/due";

export interface ViewCanvasProps {
  tasks: TaskRecord[];
  onOpen: (task: TaskRecord) => void;
}

function idJitter(id: string): { jx: number; jy: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const jx = ((h % 1000) / 1000) * 0.04 - 0.02;
  const jy = (((h / 1000) % 1000) / 1000) * 0.02 - 0.01;
  return { jx, jy };
}

// Per-quadrant grid layout. Each quadrant occupies a 50% × 50% area of the plane;
// pills are placed in a 2-column grid that stacks downward from each quadrant's top,
// with a small deterministic jitter to keep the layout feeling organic.
function layoutTasks(tasks: TaskRecord[]): { task: TaskRecord; x: number; y: number }[] {
  const buckets: Record<RedesignQuadrantKey, TaskRecord[]> = { q1: [], q2: [], q3: [], q4: [] };
  tasks.forEach((t) => {
    const key: RedesignQuadrantKey =
      t.urgent && t.important ? "q1" : !t.urgent && t.important ? "q2" : t.urgent ? "q3" : "q4";
    buckets[key].push(t);
  });

  const COL_OFFSET = 0.09; // distance from quadrant center to each column (9% of plane width)
  const ROW_START_TOP = 0.14; // first row y for top quadrants (q1, q2)
  const ROW_START_BOTTOM = 0.62; // first row y for bottom quadrants (q3, q4)
  const ROW_GAP = 0.09; // gap between rows (9% of plane height)

  const positioned: { task: TaskRecord; x: number; y: number }[] = [];

  (Object.keys(buckets) as RedesignQuadrantKey[]).forEach((key) => {
    const quadrantTasks = buckets[key];
    const centerX = key === "q1" || key === "q3" ? 0.75 : 0.25;
    const rowStart = key === "q1" || key === "q2" ? ROW_START_TOP : ROW_START_BOTTOM;
    // If only one task in the quadrant, center it rather than sticking it to column 0.
    const singleTask = quadrantTasks.length === 1;

    quadrantTasks.forEach((task, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const { jx, jy } = idJitter(task.id);
      const x = singleTask ? centerX : centerX + (col === 0 ? -COL_OFFSET : COL_OFFSET);
      const y = rowStart + row * ROW_GAP;
      positioned.push({ task, x: x + jx, y: y + jy });
    });
  });

  return positioned;
}

export function ViewCanvas({ tasks, onOpen }: ViewCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const active = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const positioned = useMemo(() => layoutTasks(active), [active]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
          flexWrap: "wrap",
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
            Decision canvas
          </div>
          <h1 className="rd-serif" style={{ margin: "4px 0 0", fontSize: 32, lineHeight: 1.15 }}>
            Where does your work actually{" "}
            <em style={{ fontStyle: "italic", color: "var(--q2)" }}>live</em>?
          </h1>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
          {quadrants.map((q) => (
            <span key={q.rdKey} className="inline-flex items-center gap-1.5">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: `var(--${q.rdKey})`,
                  display: "inline-block",
                }}
              />
              {q.title}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rd-radius-lg)",
          padding: 56,
          height: 620,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            backgroundImage: `
              linear-gradient(to right, transparent 49.5%, var(--line) 49.5%, var(--line) 50.5%, transparent 50.5%),
              linear-gradient(to bottom, transparent 49.5%, var(--line) 49.5%, var(--line) 50.5%, transparent 50.5%)
            `,
          }}
        >
          {/* Quadrant tints behind the gridlines */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              opacity: 0.5,
              zIndex: 0,
            }}
          >
            <div style={{ background: "var(--q2-soft)", margin: "0 2px 2px 0" }} />
            <div style={{ background: "var(--q1-soft)", margin: "0 0 2px 2px" }} />
            <div style={{ background: "var(--q4-soft)", margin: "2px 2px 0 0" }} />
            <div style={{ background: "var(--q3-soft)", margin: "2px 0 0 2px" }} />
          </div>

          <QLabel pos={{ top: 12, left: 14 }} rdKey="q2" />
          <QLabel pos={{ top: 12, right: 14 }} rdKey="q1" align="right" />
          <QLabel pos={{ bottom: 12, left: 14 }} rdKey="q4" />
          <QLabel pos={{ bottom: 12, right: 14 }} rdKey="q3" align="right" />

          <AxisLabel pos={{ left: "50%", top: -32, transform: "translateX(-50%)" }}>
            ← Not urgent · <strong>Urgency</strong> · Urgent →
          </AxisLabel>
          <AxisLabel
            pos={{
              left: -38,
              top: "50%",
              transform: "rotate(-90deg) translateX(-50%)",
              transformOrigin: "left center",
            }}
          >
            ← Not important · <strong>Importance</strong> · Important →
          </AxisLabel>

          {positioned.map(({ task, x, y }) => {
            const q = quadrantForTask(task.urgent, task.important);
            const isHovered = hoveredId === task.id;
            const overdue = isOverdue(task);
            return (
              <div
                key={task.id}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onOpen(task)}
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isHovered ? 10 : 1,
                  cursor: "pointer",
                }}
              >
                <div
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: isHovered ? "6px 12px 6px 8px" : "5px 10px 5px 8px",
                    background: "var(--paper)",
                    border: `1px solid var(--${q.rdKey})`,
                    borderRadius: 999,
                    boxShadow: isHovered ? "var(--rd-shadow)" : "var(--rd-shadow-sm)",
                    transform: isHovered ? "scale(1.04)" : "none",
                    transition: "all .15s",
                    maxWidth: isHovered ? 320 : 180,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: `var(--${q.rdKey})`,
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "var(--ink)",
                    }}
                  >
                    {task.title}
                  </span>
                  {overdue && (
                    <AlertCircle size={11} strokeWidth={2.4} style={{ color: "var(--q1)", flexShrink: 0 }} />
                  )}
                </div>
                {isHovered && task.description && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      padding: "8px 10px",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      borderRadius: 8,
                      fontSize: 11.5,
                      maxWidth: 280,
                      lineHeight: 1.4,
                    }}
                  >
                    {task.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "var(--ink-3)",
            textAlign: "center",
          }}
        >
          Tasks near the axes are borderline. Click a pill to open it.
        </div>
      </div>
    </div>
  );
}

function QLabel({
  pos,
  rdKey,
  align,
}: {
  pos: React.CSSProperties;
  rdKey: RedesignQuadrantKey;
  align?: "right";
}) {
  const q = quadrants.find((x) => x.rdKey === rdKey)!;
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        textAlign: align ?? "left",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.14,
          textTransform: "uppercase",
          fontWeight: 600,
          color: `var(--${q.rdKey})`,
        }}
      >
        {q.rdTag}
      </div>
      <div className="rd-serif" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1.05, marginTop: 2 }}>
        {q.title}
      </div>
    </div>
  );
}

function AxisLabel({ pos, children }: { pos: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        ...pos,
        fontSize: 11,
        color: "var(--ink-3)",
        letterSpacing: 0.04,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
}
