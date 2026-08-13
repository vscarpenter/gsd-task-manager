"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { XIcon, CheckIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, QUADRANT_ACCENT, QUADRANT_INK } from "@/lib/quadrants";
import { cn } from "@/lib/utils";
import { DrawerHint } from "@/components/ui/drawer-hint";
import { useModalSurface } from "./use-modal-surface";
import { useDialogFocus } from "./use-dialog-focus";
import { useEditDraftState } from "./use-edit-draft-state";
import { Field, QuadrantField, DueDateField, TagsField } from "./edit-drawer-fields";
import { DependenciesField, findDependencyCycleError } from "./edit-drawer-dependencies";
import type { EditDraft } from "./edit-draft";
export type { EditDraft } from "./edit-draft";

interface EditDrawerProps {
  open: boolean;
  task?: TaskRecord | null;
  /** Pre-fill fields when opening in create mode (task is null/absent). */
  initialDraft?: Partial<EditDraft>;
  /** Full live task list — candidate pool for the dependency picker. */
  allTasks?: TaskRecord[];
  onClose: () => void;
  onSubmit: (draft: EditDraft, taskId?: string) => void | Promise<void>;
}

type EditDrawerFormProps = Omit<EditDrawerProps, "open">;

export function EditDrawer({ open, task, initialDraft, allTasks, onClose, onSubmit }: EditDrawerProps): React.ReactElement | null {
  if (!open) return null;
  // Remount the form when the selected task changes so its field state is
  // seeded fresh from props — no effect-based rehydration needed.
  return (
    <EditDrawerForm
      key={task?.id ?? "__create__"}
      task={task}
      initialDraft={initialDraft}
      allTasks={allTasks}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

/**
 * Close on Escape.
 *
 * `onClose` may change identity between renders, so useEffectEvent keeps the
 * listener subscribed once while always calling the latest handler.
 */
function useEscapeToClose(onClose: () => void): void {
  const handleEscape = useEffectEvent(() => onClose());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleEscape(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Pigment for whichever quadrant the current urgent/important pair names. */
function quadrantChrome(urgent: boolean, important: boolean) {
  const activeQuadrant = quadrants.find((q) => q.urgent === urgent && q.important === important);
  return {
    activeQuadrant,
    accent: activeQuadrant ? QUADRANT_ACCENT[activeQuadrant.rdKey] : "var(--accent)",
    quadrantInk: activeQuadrant ? QUADRANT_INK[activeQuadrant.rdKey] : "var(--accent)",
  };
}

function EditDrawerForm({ task, initialDraft, allTasks = [], onClose, onSubmit }: EditDrawerFormProps): React.ReactElement {
  const titleRef = useRef<HTMLInputElement>(null);
  const modalSurface = useModalSurface(onClose);

  const drawerRef = useRef<HTMLFormElement>(null);
  const draft = useEditDraftState(task, initialDraft, titleRef);
  const trapKeyDown = useDialogFocus(true, drawerRef);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  const handleDependenciesChange = (ids: string[]): void => {
    setDependencyError(null);
    draft.setDependencies(ids);
  };

  useEscapeToClose(onClose);

  const isCreateMode = !task;
  const { activeQuadrant, accent, quadrantInk } = quadrantChrome(draft.urgent, draft.important);

  const submit = (e?: FormEvent): void => {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    const cycleError = task
      ? findDependencyCycleError(task.id, draft.dependencies, allTasks)
      : null;
    if (cycleError) {
      setDependencyError(cycleError);
      return;
    }
    void onSubmit(draft.toDraft(), task?.id);
  };

  const heading = isCreateMode ? "New task" : "Edit task";

  // Deliberately hand-rolled rather than Radix <Dialog>. ui-craft-detect flags
  // this as a11y/modal-without-dialog, but the behaviours that rule protects are
  // covered by explicit tests here (role/aria-modal, focus restore on close, and
  // Escape layering). Radix's DismissableLayer handles Escape at the document
  // level, which would break the layered-Escape contract the dependency
  // suggestion popup relies on — a first Escape closes the popup, a second
  // closes the drawer. See .ui-craft/decisions.md (2026-07-31).
  return (
    <div
      {...modalSurface}
      role="presentation"
      // ui-craft-detect-ignore-next-line
      className="fixed inset-0 z-[60] flex justify-end bg-[var(--backdrop)] animate-drawer-overlay"
    >
      <form
        data-testid="edit-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapKeyDown}
        onSubmit={submit}
        className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-[var(--shadow-lg)] animate-drawer-slide-in"
        aria-label={heading}
      >
        <DrawerHeader
          heading={heading}
          accent={accent}
          quadrantInk={quadrantInk}
          activeQuadrantTitle={activeQuadrant?.title}
          onClose={onClose}
        />

        <EditDrawerBody
          draft={draft}
          titleRef={titleRef}
          taskId={task?.id}
          allTasks={allTasks}
          dependencyError={dependencyError}
          onDependenciesChange={handleDependenciesChange}
        />

        <DrawerFooter
          onClose={onClose}
          canSave={Boolean(draft.title.trim())}
          isCreateMode={isCreateMode}
        />
      </form>
    </div>
  );
}

/** The sticky action bar. Split out to keep the drawer body readable. */
function DrawerFooter({
  onClose,
  canSave,
  isCreateMode,
}: {
  onClose: () => void;
  canSave: boolean;
  isCreateMode: boolean;
}) {
  return (
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
            disabled={!canSave}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background",
              "hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {isCreateMode ? "Create task" : "Save changes"}
          </button>
        </footer>
  );
}

/** The drawer's title bar: quadrant dot, heading, and the close control. */
function DrawerHeader({
  heading,
  accent,
  quadrantInk,
  activeQuadrantTitle,
  onClose,
}: {
  heading: string;
  accent: string;
  quadrantInk: string;
  activeQuadrantTitle?: string;
  onClose: () => void;
}) {
  return (
        <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground">{heading}</h2>
          {activeQuadrantTitle ? (
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: quadrantInk }}>
              {activeQuadrantTitle}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-target ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
  );
}

/**
 * The scrolling field stack.
 *
 * Split from the form shell so each field group can be added or reordered
 * without growing the component that owns submit, focus, and dismissal.
 */
function EditDrawerBody({
  draft,
  titleRef,
  taskId,
  allTasks,
  dependencyError,
  onDependenciesChange,
}: {
  draft: ReturnType<typeof useEditDraftState>;
  titleRef: React.RefObject<HTMLInputElement | null>;
  taskId?: string;
  allTasks: TaskRecord[];
  dependencyError: string | null;
  onDependenciesChange: (ids: string[]) => void;
}) {
  return (
        <div className="flex flex-1 flex-col gap-5 overflow-auto overscroll-contain px-5 py-5">
          <TitleAndDescriptionFields draft={draft} titleRef={titleRef} />

          <QuadrantField
            urgent={draft.urgent}
            important={draft.important}
            onChange={(u, i) => { draft.setUrgent(u); draft.setImportant(i); }}
          />

          <SchedulingAndLinksFields
            draft={draft}
            taskId={taskId}
            allTasks={allTasks}
            dependencyError={dependencyError}
            onDependenciesChange={onDependenciesChange}
          />
        </div>
  );
}

/** The two free-text fields at the top of the drawer. */
function TitleAndDescriptionFields({
  draft,
  titleRef,
}: {
  draft: ReturnType<typeof useEditDraftState>;
  titleRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <input
        data-testid="edit-title"
        ref={titleRef}
        value={draft.title}
        onChange={(e) => draft.setTitle(e.target.value)}
        placeholder="What needs doing?"
        className="w-full rounded-lg border border-border bg-background px-3 py-3 text-[18px] font-medium text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 placeholder:font-normal"
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
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        />
      </Field>
    </>
  );
}

/** Enter/comma commits a tag; Backspace on an empty input removes the last one. */
function handleTagKeyDown(
  event: React.KeyboardEvent,
  draft: ReturnType<typeof useEditDraftState>
): void {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    draft.addTag();
    return;
  }
  if (event.key === "Backspace" && !draft.tagInput && draft.tags.length) {
    draft.setTags(draft.tags.slice(0, -1));
  }
}

/** Due date, tags, and dependencies — the fields that relate a task to others. */
interface SchedulingAndLinksFieldsProps {
  draft: ReturnType<typeof useEditDraftState>;
  taskId?: string;
  allTasks: TaskRecord[];
  dependencyError: string | null;
  onDependenciesChange: (ids: string[]) => void;
}

function SchedulingAndLinksFields({
  draft,
  taskId,
  allTasks,
  dependencyError,
  onDependenciesChange,
}: SchedulingAndLinksFieldsProps) {
  return (
    <>
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
            onTagKeyDown={(e) => handleTagKeyDown(e, draft)}
          />

          <DependenciesField
            taskId={taskId}
            dependencies={draft.dependencies}
            allTasks={allTasks}
            onChange={onDependenciesChange}
            error={dependencyError}
          />
    </>
  );
}
