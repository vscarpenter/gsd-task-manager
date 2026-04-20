"use client";

import { useState } from "react";
import type { TaskRecord } from "@/lib/types";
import { quadrantForTask } from "@/lib/quadrants";
import { isOverdue } from "@/lib/redesign/due";
import { DuePill, QuadrantBadge, SubtaskChip, TagChip } from "./primitives";

export interface TaskCardProps {
  task: TaskRecord;
  onToggle?: (task: TaskRecord, checked: boolean) => void;
  onOpen?: (task: TaskRecord) => void;
  compact?: boolean;
  showQuadrant?: boolean;
}

export function TaskCard({ task, onToggle, onOpen, compact, showQuadrant }: TaskCardProps) {
  const quadrant = quadrantForTask(task.urgent, task.important);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const overdue = isOverdue(task);

  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;
  const hasMeta = !compact && (task.tags.length > 0 || task.dueDate || task.subtasks.length > 0);
  const isRaised = hover || focused;

  return (
    <div
      className="rd-task-card rd-fade-in"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: overdue ? `3px solid var(--${quadrant.rdKey})` : "1px solid var(--line)",
        borderRadius: "var(--rd-radius)",
        cursor: onOpen ? "pointer" : "default",
        boxShadow: isRaised ? "var(--rd-shadow)" : "var(--rd-shadow-sm)",
        transform: isRaised ? "translateY(-1px)" : "none",
        transition: "background .18s, border-color .18s, transform .18s, box-shadow .18s",
        opacity: task.completed ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "flex-start",
            justifyContent: "center",
            width: 32,
            minWidth: 32,
            paddingTop: 2,
            cursor: "pointer",
          }}
        >
          <span className="sr-only">{task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}</span>
          <input
            className="rd-checkbox"
            type="checkbox"
            checked={task.completed}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggle?.(task, e.target.checked)}
            aria-label={`Complete ${task.title}`}
          />
        </label>

        {onOpen ? (
          <button
            type="button"
            className="rd-task-card-main"
            onClick={() => onOpen(task)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: "transparent",
              padding: 0,
              textAlign: "left",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 550,
                    lineHeight: 1.35,
                    color: "var(--ink)",
                    textDecoration: task.completed ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </div>
                {task.description && !compact && (
                  <div
                    className="rd-task-desc"
                    style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}
                  >
                    {task.description}
                  </div>
                )}
              </div>
              {showQuadrant && <QuadrantBadge quadrant={quadrant} size="sm" />}
            </div>

            {hasMeta && (
              <div
                className="rd-task-meta"
                style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}
              >
                {task.dueDate && <DuePill dueDate={task.dueDate} />}
                <SubtaskChip done={doneSubtasks} total={task.subtasks.length} />
                {task.tags.slice(0, 4).map((t) => (
                  <TagChip key={t}>{t}</TagChip>
                ))}
              </div>
            )}
          </button>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 550,
                    lineHeight: 1.35,
                    color: "var(--ink)",
                    textDecoration: task.completed ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </div>
                {task.description && !compact && (
                  <div
                    className="rd-task-desc"
                    style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}
                  >
                    {task.description}
                  </div>
                )}
              </div>
              {showQuadrant && <QuadrantBadge quadrant={quadrant} size="sm" />}
            </div>

            {hasMeta && (
              <div
                className="rd-task-meta"
                style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}
              >
                {task.dueDate && <DuePill dueDate={task.dueDate} />}
                <SubtaskChip done={doneSubtasks} total={task.subtasks.length} />
                {task.tags.slice(0, 4).map((t) => (
                  <TagChip key={t}>{t}</TagChip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
