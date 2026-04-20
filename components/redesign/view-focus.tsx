"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import type { RedesignQuadrantKey } from "@/lib/quadrants";
import { dueBucket } from "@/lib/redesign/due";
import { TaskCard } from "./task-card";
import { RdButton } from "./primitives";
import { MatrixCompass } from "./matrix-compass";

export interface ViewFocusProps {
  tasks: TaskRecord[];
  onToggle: (task: TaskRecord, completed: boolean) => void;
  onOpen: (task: TaskRecord) => void;
  onAdd: (quadrantKey?: RedesignQuadrantKey) => void;
}

function formatDateCaption(now: Date): string {
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const month = now.toLocaleDateString(undefined, { month: "long" });
  const day = now.getDate();
  return `${weekday} · ${month} ${day}`;
}

export function ViewFocus({ tasks, onToggle, onOpen, onAdd }: ViewFocusProps) {
  const { now, today, next, later } = useMemo(() => {
    const active = tasks.filter((t) => !t.completed);
    const now = active.filter((t) => t.urgent && t.important);
    const today = active.filter(
      (t) => !(t.urgent && t.important) && dueBucket(t.dueDate) === "today"
    );
    const next = active.filter(
      (t) => !(t.urgent && t.important) && dueBucket(t.dueDate) !== "today" && t.important
    );
    const later = active.filter(
      (t) => !(t.urgent && t.important) && dueBucket(t.dueDate) !== "today" && !t.important
    );
    return { now, today, next, later };
  }, [tasks]);

  const caption = formatDateCaption(new Date());

  return (
    <div className="rd-focus-grid">
      <div>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 0.12,
              textTransform: "uppercase",
              color: "var(--ink-3)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {caption}
          </div>
          <h1
            className="rd-serif"
            style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 42px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            {now.length > 0 ? (
              <>
                You have <em style={{ color: "var(--q1)", fontStyle: "italic" }}>{now.length}</em> thing
                {now.length === 1 ? "" : "s"} to handle now.
              </>
            ) : (
              <>
                Nothing urgent. Time for <em style={{ color: "var(--q2)", fontStyle: "italic" }}>meaningful</em> work.
              </>
            )}
          </h1>
        </div>

        <FocusSection label="Now" sub="Urgent & important — handle first" tone="q1" tasks={now} onToggle={onToggle} onOpen={onOpen} />
        <FocusSection label="Today" sub="Due today" tone="neutral" tasks={today} onToggle={onToggle} onOpen={onOpen} />
        <FocusSection label="Next" sub="Important, but not urgent" tone="q2" tasks={next} onToggle={onToggle} onOpen={onOpen} />
        <FocusSection label="Later" sub="Delegate or drop" tone="muted" tasks={later} onToggle={onToggle} onOpen={onOpen} />

        <div style={{ marginTop: 8 }}>
          <RdButton onClick={() => onAdd("q1")}>
            <Plus size={14} /> Add task
          </RdButton>
        </div>
      </div>

      <MatrixCompass tasks={tasks} variant="grid" label="Matrix compass" onAdd={onAdd} />
    </div>
  );
}

function FocusSection({
  label,
  sub,
  tone,
  tasks,
  onToggle,
  onOpen,
}: {
  label: string;
  sub: string;
  tone: "q1" | "q2" | "neutral" | "muted";
  tasks: TaskRecord[];
  onToggle: (task: TaskRecord, completed: boolean) => void;
  onOpen: (task: TaskRecord) => void;
}) {
  if (tasks.length === 0 && tone !== "q1") return null;
  const toneMap = {
    q1: { dot: "var(--q1)", label: "var(--q1)" },
    q2: { dot: "var(--q2)", label: "var(--q2)" },
    neutral: { dot: "var(--ink-2)", label: "var(--ink-2)" },
    muted: { dot: "var(--ink-4)", label: "var(--ink-3)" },
  }[tone];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: toneMap.dot }} />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: toneMap.label,
            letterSpacing: 0.02,
            textTransform: "uppercase",
          }}
        >
          {label}
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{sub}</span>
        <span className="rd-mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div
          className="rd-serif"
          style={{ fontStyle: "italic", fontSize: 18, color: "var(--ink-3)", paddingLeft: 18 }}
        >
          Nothing here. Nice.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} showQuadrant />
          ))}
        </div>
      )}
    </div>
  );
}
