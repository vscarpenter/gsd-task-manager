"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Flame, Sparkles, X } from "lucide-react";
import { quadrantByRdKey, quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import { isSamePresetDue, presetDueDate, presetLabel } from "@/lib/redesign/due";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TaskRecord } from "@/lib/types";

export interface ComposerSubmit {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
}

export interface ComposerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: ComposerSubmit, editingId?: string) => void;
  presetQuadrant?: RedesignQuadrantKey | null;
  editingTask?: TaskRecord | null;
}

const DUE_KEYS = ["none", "today", "tomorrow", "thisfri", "nextweek"] as const;
type DueKey = (typeof DUE_KEYS)[number];

interface Draft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
}

function emptyDraft(preset?: RedesignQuadrantKey | null): Draft {
  const q = preset ? quadrantByRdKey(preset) : null;
  return {
    title: "",
    description: "",
    urgent: q?.urgent ?? true,
    important: q?.important ?? true,
    dueDate: undefined,
    tags: [],
  };
}

function draftFromTask(task: TaskRecord): Draft {
  return {
    title: task.title,
    description: task.description,
    urgent: task.urgent,
    important: task.important,
    dueDate: task.dueDate,
    tags: [...task.tags],
  };
}

export function ComposerDrawer({ open, onClose, onSubmit, presetQuadrant, editingTask }: ComposerDrawerProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    editingTask ? draftFromTask(editingTask) : emptyDraft(presetQuadrant)
  );
  const [tagInput, setTagInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const notesId = useId();
  const tagsId = useId();

  useEffect(() => {
    if (open) {
      setDraft(editingTask ? draftFromTask(editingTask) : emptyDraft(presetQuadrant));
      setTagInput("");
    }
  }, [open, presetQuadrant, editingTask]);

  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const activeKey: RedesignQuadrantKey =
    draft.urgent && draft.important ? "q1" : !draft.urgent && draft.important ? "q2" : draft.urgent ? "q3" : "q4";
  const q = quadrantByRdKey(activeKey);

  function addTag(raw: string) {
    const clean = raw.trim().replace(/^#/, "").toLowerCase();
    if (!clean || draft.tags.includes(clean)) return;
    setDraft((d) => ({ ...d, tags: [...d.tags, clean] }));
    setTagInput("");
  }

  function submit() {
    const trimmed = draft.title.trim();
    if (!trimmed) return;
    onSubmit(
      {
        title: trimmed,
        description: draft.description.trim(),
        urgent: draft.urgent,
        important: draft.important,
        dueDate: draft.dueDate,
        tags: draft.tags,
      },
      editingTask?.id
    );
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="redesign-scope rd-fade-in border-card-border bg-transparent p-0 md:left-auto md:right-0 md:top-0 md:h-[100dvh] md:w-[460px] md:max-w-[460px] md:translate-x-0 md:translate-y-0 md:rounded-none md:border-l md:border-t-0 md:p-0"
      >
        <div
          style={{
            background: "var(--paper)",
            display: "flex",
            minHeight: "inherit",
            flexDirection: "column",
            boxShadow: "var(--rd-shadow-lg)",
          }}
        >
        <div
          style={{
            padding: "18px 52px 16px 22px",
            background: `var(--${activeKey}-soft)`,
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.12,
                textTransform: "uppercase",
                color: `var(--${activeKey})`,
                fontWeight: 600,
              }}
            >
              {editingTask ? "Editing · " : "Goes in · "}
              {q.rdTag}
            </div>
            <DialogTitle asChild>
              <h2 className="rd-serif" style={{ margin: "4px 0 0", fontSize: 26, lineHeight: 1 }}>
                {q.title}
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>{q.rdHint}</div>
            </DialogDescription>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Field label="Task" htmlFor={titleId}>
            <input
              id={titleId}
              ref={titleInputRef}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="What needs doing?"
              style={inputStyle}
            />
          </Field>

          <Field label="Notes" htmlFor={notesId}>
            <textarea
              id={notesId}
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Optional context, links, next step…"
              style={{ ...inputStyle, resize: "vertical", minHeight: 70, lineHeight: 1.45, padding: "10px 12px", height: "auto" }}
            />
          </Field>

          <Field label="Priority">
            <div
              style={{
                background: "var(--bg-inset)",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <ToggleTile
                  active={draft.urgent}
                  onClick={() => setDraft((d) => ({ ...d, urgent: !d.urgent }))}
                  icon={<Flame size={14} strokeWidth={2.2} />}
                  label="Urgent"
                  sub="Time-sensitive"
                  activeColor="var(--q1)"
                />
                <ToggleTile
                  active={draft.important}
                  onClick={() => setDraft((d) => ({ ...d, important: !d.important }))}
                  icon={<Sparkles size={14} strokeWidth={2.2} />}
                  label="Important"
                  sub="Moves the needle"
                  activeColor="var(--q2)"
                />
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "34px 34px",
                  gap: 4,
                }}
              >
                {(["q2", "q1", "q4", "q3"] as RedesignQuadrantKey[]).map((id) => {
                  const quadrant = quadrants.find((x) => x.rdKey === id)!;
                  const active = id === activeKey;
                  return (
                    <div
                      key={id}
                    style={{
                      background: active ? `var(--${id})` : "var(--paper)",
                      color: active ? "#fff" : "var(--ink-3)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      fontWeight: 600,
                      transition: "background-color .15s ease, color .15s ease",
                    }}
                    >
                      {quadrant.title}
                    </div>
                  );
                })}
              </div>
            </div>
          </Field>

          <Field label="Due">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DUE_KEYS.map((key) => {
                const active = isSamePresetDue(draft.dueDate, key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, dueDate: presetDueDate(key) }))}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: active ? "var(--ink)" : "var(--paper)",
                      color: active ? "var(--paper)" : "var(--ink-2)",
                      fontSize: 12.5,
                      fontWeight: 500,
                      transition: "background-color .15s ease, color .15s ease, border-color .15s ease",
                      cursor: "pointer",
                    }}
                  >
                    {presetLabel(key)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Tags" htmlFor={tagsId}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {draft.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1"
                  style={{
                    height: 26,
                    padding: "0 8px 0 10px",
                    borderRadius: 6,
                    background: "var(--bg-inset)",
                    color: "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== t) }))}
                    aria-label={`Remove tag ${t}`}
                    style={{
                      background: "none",
                      border: 0,
                      color: "var(--ink-3)",
                      padding: 0,
                      marginLeft: 4,
                      cursor: "pointer",
                      display: "inline-flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                id={tagsId}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Add tag…"
                style={{ ...inputStyle, width: 120, height: 26, padding: "0 8px", fontSize: 12 }}
              />
            </div>
          </Field>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--ink-2)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.title.trim()}
            className="inline-flex items-center gap-2"
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid var(--ink)",
              background: "var(--ink)",
              color: "var(--paper)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: draft.title.trim() ? "pointer" : "not-allowed",
              opacity: draft.title.trim() ? 1 : 0.5,
            }}
          >
            {editingTask ? "Save" : `Add to ${q.title}`}
            <ArrowRight size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.08,
          textTransform: "uppercase",
          color: "var(--ink-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleTile({
  active,
  onClick,
  icon,
  label,
  sub,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
  activeColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        background: active ? activeColor : "var(--paper)",
        color: active ? "#fff" : "var(--ink-2)",
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "left",
        transition: "background-color .15s ease, color .15s ease, transform .15s ease",
        cursor: "pointer",
      }}
      aria-pressed={active}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 11.5, opacity: active ? 0.85 : 0.7, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
  fontSize: 14,
  outline: 0,
  transition: "border-color .15s, box-shadow .15s",
};
