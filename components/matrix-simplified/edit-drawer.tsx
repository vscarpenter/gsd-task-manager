"use client";

import { useEffect, useEffectEvent, useRef, type FormEvent } from "react";
import { XIcon, CheckIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, QUADRANT_ACCENT } from "@/lib/quadrants";
import { cn } from "@/lib/utils";
import { DrawerHint } from "@/components/ui/drawer-hint";
import { useDialogFocus } from "./use-dialog-focus";
import { useEditDraftState } from "./use-edit-draft-state";
import { Field, QuadrantField, DueDateField, TagsField } from "./edit-drawer-fields";

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

type EditDrawerFormProps = Omit<EditDrawerProps, "open">;

export function EditDrawer({ open, task, initialDraft, onClose, onSubmit }: EditDrawerProps): React.ReactElement | null {
  if (!open) return null;
  // Remount the form when the selected task changes so its field state is
  // seeded fresh from props — no effect-based rehydration needed.
  return (
    <EditDrawerForm
      key={task?.id ?? "__create__"}
      task={task}
      initialDraft={initialDraft}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function EditDrawerForm({ task, initialDraft, onClose, onSubmit }: EditDrawerFormProps): React.ReactElement {
  const titleRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLFormElement>(null);
  const draft = useEditDraftState(task, initialDraft, titleRef);
  const trapKeyDown = useDialogFocus(true, drawerRef);

  // `onClose` may change identity between renders; useEffectEvent keeps the
  // keydown listener subscribed once while always calling the latest handler.
  const handleEscape = useEffectEvent(() => onClose());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleEscape(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isCreateMode = !task;
  const activeQuadrant = quadrants.find((q) => q.urgent === draft.urgent && q.important === draft.important);
  const accent = activeQuadrant ? QUADRANT_ACCENT[activeQuadrant.rdKey] : "var(--rust)";

  const submit = (e?: FormEvent): void => {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    void onSubmit(draft.toDraft(), task?.id);
  };

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-[60] flex justify-end bg-black/30 animate-drawer-overlay"
    >
      <form
        data-testid="edit-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapKeyDown}
        onSubmit={submit}
        className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-2xl animate-drawer-slide-in"
        aria-label={isCreateMode ? "New task" : "Edit task"}
      >
        <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <h2 className="rd-serif text-[22px] text-foreground">{isCreateMode ? "New task" : "Edit task"}</h2>
          {activeQuadrant ? (
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {activeQuadrant.title}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-target ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 py-5">
          <input
            data-testid="edit-title"
            ref={titleRef}
            value={draft.title}
            onChange={(e) => draft.setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-[18px] font-medium text-foreground outline-none focus:border-foreground-muted placeholder:font-normal"
            aria-label="Title"
          />

          <Field label="Description">
            <textarea
              data-testid="edit-description"
              value={draft.description}
              onChange={(e) => draft.setDescription(e.target.value)}
              rows={4}
              placeholder="Optional details, links, context"
              aria-label="Description"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-foreground-muted"
            />
          </Field>

          <QuadrantField
            urgent={draft.urgent}
            important={draft.important}
            onChange={(u, i) => { draft.setUrgent(u); draft.setImportant(i); }}
          />

          <DueDateField
            duePreset={draft.duePreset}
            customDate={draft.customDate}
            showCustomDateInput={draft.showCustomDateInput}
            onPresetChange={draft.setDuePreset}
            onCustomDateChange={draft.setCustomDate}
            onToggleCustomInput={draft.setShowCustomDateInput}
          />

          <TagsField
            tags={draft.tags}
            tagInput={draft.tagInput}
            onTagInputChange={draft.setTagInput}
            onAddTag={draft.addTag}
            onRemoveTag={(t) => draft.setTags(draft.tags.filter((x) => x !== t))}
            onTagKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); draft.addTag(); }
              else if (e.key === "Backspace" && !draft.tagInput && draft.tags.length) {
                draft.setTags(draft.tags.slice(0, -1));
              }
            }}
          />
        </div>

        <footer className="flex items-center gap-2.5 border-t border-border/60 bg-background px-5 py-3.5">
          <DrawerHint />
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            data-testid="save-task"
            type="submit"
            disabled={!draft.title.trim()}
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
