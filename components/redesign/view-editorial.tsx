"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, type QuadrantMeta, type RedesignQuadrantKey } from "@/lib/quadrants";
import { DraggableTaskCard } from "./draggable-task-card";
import { MatrixCompass } from "./matrix-compass";
import { RdButton, RdIconButton, RdQuadrantIcon } from "./primitives";

export interface ViewEditorialProps {
  tasks: TaskRecord[];
  onToggle: (task: TaskRecord, completed: boolean) => void;
  onOpen: (task: TaskRecord) => void;
  onAdd: (quadrantKey: RedesignQuadrantKey) => void;
}

function groupByQuadrant(tasks: TaskRecord[]): Record<RedesignQuadrantKey, TaskRecord[]> {
  const by: Record<RedesignQuadrantKey, TaskRecord[]> = { q1: [], q2: [], q3: [], q4: [] };
  tasks.forEach((t) => {
    const active = !t.completed;
    if (!active) return;
    const key: RedesignQuadrantKey =
      t.urgent && t.important ? "q1" : !t.urgent && t.important ? "q2" : t.urgent ? "q3" : "q4";
    by[key].push(t);
  });
  return by;
}

export function ViewEditorial({ tasks, onToggle, onOpen, onAdd }: ViewEditorialProps) {
  const by = groupByQuadrant(tasks);
  return (
    <div className="rd-focus-grid">
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}
        className="rd-editorial-grid"
      >
        {quadrants.map((q) => (
          <EditorialColumn
            key={q.id}
            quadrant={q}
            tasks={by[q.rdKey]}
            onToggle={onToggle}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ))}
      </div>
      <MatrixCompass tasks={tasks} variant="list" label="Balance" onAdd={onAdd} />
    </div>
  );
}

function EditorialColumn({
  quadrant,
  tasks,
  onToggle,
  onOpen,
  onAdd,
}: {
  quadrant: QuadrantMeta;
  tasks: TaskRecord[];
  onToggle: (task: TaskRecord, completed: boolean) => void;
  onOpen: (task: TaskRecord) => void;
  onAdd: (quadrantKey: RedesignQuadrantKey) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });
  return (
    <section
      ref={setNodeRef}
      style={{
        background: `var(--${quadrant.rdKey}-soft)`,
        borderRadius: "var(--rd-radius-lg)",
        padding: "20px 20px 16px",
        minHeight: 280,
        position: "relative",
        overflow: "hidden",
        boxShadow: isOver ? `inset 0 0 0 2px var(--${quadrant.rdKey})` : "none",
        transition: "box-shadow .15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <span
            className="inline-grid place-items-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: `var(--${quadrant.rdKey}-tint)`,
              color: `var(--${quadrant.rdKey})`,
            }}
          >
            <RdQuadrantIcon icon={quadrant.rdIcon} size={16} strokeWidth={2} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <h2 className="rd-serif" style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
                {quadrant.title}
              </h2>
              <span style={{ fontSize: 12, color: `var(--${quadrant.rdKey})`, fontWeight: 600 }}>
                {tasks.length}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)", letterSpacing: 0.02 }}>
              {quadrant.rdHint}
            </div>
          </div>
        </div>
        <RdIconButton
          onClick={() => onAdd(quadrant.rdKey)}
          title="Add task to this quadrant"
          style={{ color: `var(--${quadrant.rdKey})` }}
        >
          <Plus size={16} />
        </RdIconButton>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.length === 0 ? (
          <EmptyState quadrant={quadrant} onAdd={onAdd} />
        ) : (
          tasks.map((t) => <DraggableTaskCard key={t.id} task={t} onToggle={onToggle} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

function EmptyState({
  quadrant,
  onAdd,
}: {
  quadrant: QuadrantMeta;
  onAdd: (quadrantKey: RedesignQuadrantKey) => void;
}) {
  return (
    <div
      style={{
        padding: "28px 20px",
        textAlign: "center",
        border: "1px dashed var(--line)",
        borderRadius: 12,
        color: "var(--ink-3)",
        fontSize: 13,
      }}
    >
      <div
        className="rd-serif"
        style={{ fontSize: 18, color: "var(--ink-2)", marginBottom: 4, fontStyle: "italic" }}
      >
        {quadrant.rdEmpty}
      </div>
      <RdButton variant="ghost" onClick={() => onAdd(quadrant.rdKey)} style={{ marginTop: 8, height: 30, fontSize: 12.5 }}>
        <Plus size={13} /> Add task
      </RdButton>
    </div>
  );
}
