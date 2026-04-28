"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { XIcon, CheckIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import { resolveDuePreset, DUE_PRESETS, type DuePreset } from "@/lib/due-date-presets";
import { cn } from "@/lib/utils";

export interface EditDraft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
}

interface EditDrawerProps {
  open: boolean;
  task?: TaskRecord | null;
  /** Pre-fill fields when opening in create mode (task is null/absent). */
  initialDraft?: Partial<EditDraft>;
  onClose: () => void;
  onSubmit: (draft: EditDraft, taskId?: string) => void | Promise<void>;
}

const ACCENT: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

function classifyExistingDate(iso: string | undefined): DuePreset {
  if (!iso) return "none";
  const todayIso = new Date().toISOString().slice(0, 10);
  // Support both date-only ("2026-04-27") and full datetime ("2026-04-27T14:00:00Z")
  const dateOnly = iso.slice(0, 10);
  if (dateOnly === todayIso) return "today";
  const target = new Date(`${dateOnly}T00:00:00`);
  const today = new Date(`${todayIso}T00:00:00`);
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 0 && diff <= 7) return "this-week";
  if (diff > 7 && diff <= 14) return "next-week";
  return "none";
}

export function EditDrawer({ open, task, initialDraft, onClose, onSubmit }: EditDrawerProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [duePreset, setDuePreset] = useState<DuePreset>("none");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setUrgent(task.urgent);
      setImportant(task.important);
      setDuePreset(classifyExistingDate(task.dueDate));
      setTags(task.tags ?? []);
    } else {
      setTitle(initialDraft?.title ?? "");
      setDescription(initialDraft?.description ?? "");
      setUrgent(initialDraft?.urgent ?? false);
      setImportant(initialDraft?.important ?? false);
      setDuePreset("none");
      setTags(initialDraft?.tags ?? []);
    }
    setTagInput("");
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, task, initialDraft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const isCreateMode = !task;

  const activeQuadrant = quadrants.find((q) => q.urgent === urgent && q.important === important);
  const accent = activeQuadrant ? ACCENT[activeQuadrant.rdKey] : "#c2410c";

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    const rawDate = resolveDuePreset(duePreset);
    // Convert date-only "YYYY-MM-DD" to full ISO datetime required by taskDraftSchema
    const dueDate = rawDate ? new Date(`${rawDate}T00:00:00`).toISOString() : undefined;
    void onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        urgent,
        important,
        dueDate,
        tags,
      },
      task?.id
    );
  };

  const addTag = () => {
    const v = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!v || tags.includes(v)) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex justify-end bg-black/30">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-2xl"
        aria-label={isCreateMode ? "New task" : "Edit task"}
      >
        <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <h2 className="rd-serif text-[22px] text-foreground">{isCreateMode ? "New task" : "Edit task"}</h2>
          {activeQuadrant ? (
            <span
              className="ml-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {activeQuadrant.title}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 py-5">
          <Field label="Title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] font-medium text-foreground outline-none focus:border-foreground-muted"
              aria-label="Title"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Optional details, links, context"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-foreground-muted"
            />
          </Field>

          <Field label="Quadrant">
            <div className="grid grid-cols-2 gap-2">
              {quadrants.map((q) => {
                const active = q.urgent === urgent && q.important === important;
                const a = ACCENT[q.rdKey];
                return (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={q.title}
                    onClick={() => {
                      setUrgent(q.urgent);
                      setImportant(q.important);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active ? "border-2" : "border-border hover:bg-background-muted/50"
                    )}
                    style={active ? { borderColor: a, backgroundColor: `${a}14`, color: a } : undefined}
                    aria-pressed={active}
                  >
                    <div className="text-[12px] font-bold uppercase tracking-wider">{q.title}</div>
                    <div className="mt-0.5 text-[11.5px] opacity-80">{q.rdTag}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Due date">
            <div className="inline-flex rounded-lg border border-border bg-background-muted p-1">
              {DUE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDuePreset(p.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    duePreset === p.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                  aria-pressed={duePreset === p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
                >
                  <span className="opacity-60">#</span>
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="hover:text-foreground"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === "Backspace" && !tagInput && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={addTag}
                placeholder={tags.length ? "" : "Add a tag…"}
                className="min-w-[80px] flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
              />
            </div>
          </Field>
        </div>

        <footer className="flex items-center gap-2.5 border-t border-border/60 bg-background px-5 py-3.5">
          <span className="text-[12px] text-foreground-muted">
            <kbd>Esc</kbd> to cancel
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background",
              "hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {isCreateMode ? "Create task" : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
