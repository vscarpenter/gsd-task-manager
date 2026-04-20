"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const active = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const positioned = useMemo(() => layoutTasks(active), [active]);
  const groupedTasks = useMemo(() => {
    const grouped: Record<RedesignQuadrantKey, TaskRecord[]> = { q1: [], q2: [], q3: [], q4: [] };
    active.forEach((task) => {
      const quadrantKey: RedesignQuadrantKey =
        task.urgent && task.important ? "q1" : !task.urgent && task.important ? "q2" : task.urgent ? "q3" : "q4";
      grouped[quadrantKey].push(task);
    });
    return grouped;
  }, [active]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsCompactViewport(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  if (isCompactViewport) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--rd-radius-lg)",
            background: "var(--paper)",
            padding: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.12,
              textTransform: "uppercase",
              color: "var(--ink-3)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Decision canvas
          </div>
          <h1 className="rd-serif" style={{ margin: 0, fontSize: 28, lineHeight: 1.12 }}>
            Canvas condenses into a quadrant list on smaller screens.
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
            Open the app on a wider screen to see the full urgency × importance map. Tasks stay grouped here so you can still scan and edit them quickly.
          </p>
        </div>

        {quadrants.map((quadrant) => (
          <section
            key={quadrant.rdKey}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--rd-radius-lg)",
              background: `var(--${quadrant.rdKey}-soft)`,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.12, color: `var(--${quadrant.rdKey})`, fontWeight: 600 }}>
                  {quadrant.rdTag}
                </div>
                <h2 className="rd-serif" style={{ margin: "4px 0 0", fontSize: 22 }}>
                  {quadrant.title}
                </h2>
              </div>
              <span className="rd-mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {groupedTasks[quadrant.rdKey].length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupedTasks[quadrant.rdKey].length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{quadrant.rdEmpty}</div>
              ) : (
                groupedTasks[quadrant.rdKey].map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpen(task)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      background: "var(--paper)",
                      color: "var(--ink)",
                      padding: "12px 14px",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: `var(--${quadrant.rdKey})`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500 }}>{task.title}</span>
                    {isOverdue(task) ? (
                      <AlertCircle size={14} strokeWidth={2.2} style={{ color: "var(--q1)", flexShrink: 0 }} />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    );
  }

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
          {/* Quadrant tints behind the gridlines (also drop targets) */}
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
            <CanvasDropZone rdKey="q2" margin="0 2px 2px 0" />
            <CanvasDropZone rdKey="q1" margin="0 0 2px 2px" />
            <CanvasDropZone rdKey="q4" margin="2px 2px 0 0" />
            <CanvasDropZone rdKey="q3" margin="2px 0 0 2px" />
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

          {positioned.map(({ task, x, y }) => (
            <CanvasPill
              key={task.id}
              task={task}
              x={x}
              y={y}
              hovered={hoveredId === task.id}
              onHover={setHoveredId}
              onOpen={onOpen}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "var(--ink-3)",
            textAlign: "center",
          }}
        >
          Drag a pill to re-quadrant. Click to open.
        </div>
      </div>
    </div>
  );
}

function CanvasDropZone({ rdKey, margin }: { rdKey: RedesignQuadrantKey; margin: string }) {
  const quadrant = quadrants.find((q) => q.rdKey === rdKey)!;
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: `var(--${rdKey}-soft)`,
        margin,
        transition: "box-shadow .15s ease, background-color .15s ease",
        boxShadow: isOver ? `inset 0 0 0 2px var(--${rdKey})` : "none",
      }}
    />
  );
}

function CanvasPill({
  task,
  x,
  y,
  hovered,
  onHover,
  onOpen,
}: {
  task: TaskRecord;
  x: number;
  y: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: (task: TaskRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const q = quadrantForTask(task.urgent, task.important);
  const overdue = isOverdue(task);
  const pillTransform = transform
    ? `translate(-50%, -50%) ${CSS.Translate.toString(transform)}`
    : "translate(-50%, -50%)";

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onOpen(task)}
      aria-label={`Open task: ${task.title}`}
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: pillTransform,
        zIndex: isDragging ? 20 : hovered ? 10 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1,
        touchAction: "manipulation",
        background: "transparent",
        border: 0,
        padding: 0,
      }}
    >
      <div
        className="inline-flex items-center gap-1.5"
        style={{
          padding: hovered ? "6px 12px 6px 8px" : "5px 10px 5px 8px",
          background: "var(--paper)",
          border: `1px solid var(--${q.rdKey})`,
          borderRadius: 999,
          boxShadow: hovered ? "var(--rd-shadow)" : "var(--rd-shadow-sm)",
          transform: hovered && !isDragging ? "scale(1.04)" : "none",
          transition: "transform .15s ease, box-shadow .15s ease, padding .15s ease, max-width .15s ease",
          maxWidth: hovered ? 320 : 180,
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
        {overdue && <AlertCircle size={11} strokeWidth={2.4} style={{ color: "var(--q1)", flexShrink: 0 }} />}
      </div>
      {hovered && !isDragging && task.description && (
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
            pointerEvents: "none",
            textAlign: "left",
          }}
        >
          {task.description}
        </div>
      )}
    </button>
  );
}

export function CanvasPillPreview({ task }: { task: TaskRecord }) {
  const q = quadrantForTask(task.urgent, task.important);
  const overdue = isOverdue(task);
  return (
    <div
      className="inline-flex items-center gap-1.5"
      style={{
        padding: "6px 12px 6px 8px",
        background: "var(--paper)",
        border: `1px solid var(--${q.rdKey})`,
        borderRadius: 999,
        boxShadow: "var(--rd-shadow)",
        maxWidth: 260,
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
      {overdue && <AlertCircle size={11} strokeWidth={2.4} style={{ color: "var(--q1)", flexShrink: 0 }} />}
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
