"use client";

import { useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  CircleDot,
  Clock3,
  Flame,
  ListChecks,
  Moon,
  Repeat2,
  Search,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  DESIGN_QUADRANTS,
  type DesignDirection,
  type DesignQuadrantId,
  type DesignTask,
} from "./design-data";
import type { PrototypeState } from "./prototype-state";

const QUADRANT_ICONS = {
  q1: Flame,
  q2: CalendarDays,
  q3: Users,
  q4: Trash2,
} as const;

export function QuadrantIcon({ quadrant, className }: { quadrant: DesignQuadrantId; className?: string }): ReactElement {
  const Icon = QUADRANT_ICONS[quadrant];
  return <Icon aria-hidden="true" className={className} />;
}

export function PrototypeSearch({ state, className = "" }: { state: PrototypeState; className?: string }): ReactElement {
  const clearSearch = (): void => {
    state.setQuery("");
    requestAnimationFrame(() => document.getElementById("prototype-search")?.focus());
  };
  return (
    <div className={`dl-search ${className}`.trim()} role="search" aria-label="Task search">
      <Search aria-hidden="true" className="dl-search-icon" />
      <input
        id="prototype-search"
        type="search"
        value={state.query}
        onChange={(event) => state.setQuery(event.target.value)}
        aria-label="Search tasks"
        placeholder="Search tasks, tags, or dependencies"
      />
      {state.query ? (
        <button type="button" onClick={clearSearch} aria-label="Clear search input">
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function PrototypeViewSwitch({ state, matrixLabel = "Priorities" }: {
  state: PrototypeState;
  matrixLabel?: string;
}): ReactElement {
  return (
    <div className="dl-view-switch" role="group" aria-label="Prototype view">
      <button
        type="button"
        aria-pressed={state.view === "matrix"}
        onClick={() => state.setView("matrix")}
      >
        {matrixLabel}
      </button>
      <button
        type="button"
        aria-pressed={state.view === "review"}
        onClick={() => state.setView("review")}
      >
        Review
      </button>
    </div>
  );
}

export function PrototypeThemeToggle({ state }: { state: PrototypeState }): ReactElement {
  const darkNext = state.theme === "light";
  return (
    <button
      type="button"
      className="dl-icon-control"
      onClick={state.toggleTheme}
      aria-label={darkNext ? "Use dark theme" : "Use light theme"}
    >
      {darkNext ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}

export function QuickCapture({ state, className = "", placeholder = "Capture what needs attention…" }: {
  state: PrototypeState;
  className?: string;
  placeholder?: string;
}): ReactElement {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const destinationId = useId();
  const destination = DESIGN_QUADRANTS.find((quadrant) => quadrant.id === state.activeQuadrant)?.title ?? "Schedule";

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("Enter a task before adding it.");
      inputRef.current?.focus();
      return;
    }
    state.addTask(title);
    setTitle("");
    setTitleError("");
  };

  return (
    <form className={`dl-capture ${className}`.trim()} onSubmit={submit} data-motion="state-feedback" noValidate>
      <label>
        <span className="sr-only">Task to capture</span>
        <input
          ref={inputRef}
          data-testid="prototype-capture-input"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim()) setTitleError("");
          }}
          placeholder={placeholder}
          autoComplete="off"
          required
          aria-invalid={titleError ? "true" : undefined}
          aria-describedby={[destinationId, titleError ? errorId : null].filter(Boolean).join(" ")}
        />
        {titleError ? <span id={errorId} className="dl-capture-error" role="alert">{titleError}</span> : null}
      </label>
      <span id={destinationId} className="dl-capture-destination">
        <span className="sr-only">Capture destination:</span>{" "}{destination}
      </span>
      <button data-testid="prototype-capture-submit" type="submit">
        Add task
      </button>
    </form>
  );
}

export function TaskMetadata({ task, compact = false }: { task: DesignTask; compact?: boolean }): ReactElement {
  const dueLabel = task.dueLabel?.startsWith("Due ") ? task.dueLabel : `Due ${task.dueLabel}`;
  return (
    <div className={`dl-task-meta ${compact ? "is-compact" : ""}`.trim()}>
      {task.dueLabel ? (
        <span data-tone={task.dueTone}>
          <Clock3 aria-hidden="true" />
          {dueLabel}
        </span>
      ) : null}
      {task.recurrence ? (
        <span><Repeat2 aria-hidden="true" />Repeats {task.recurrence.toLowerCase()}</span>
      ) : null}
      {task.subtasks ? (
        <span><ListChecks aria-hidden="true" />{task.subtasks.completed} of {task.subtasks.total} subtasks complete</span>
      ) : null}
      {task.dependency ? (
        <span><CircleDot aria-hidden="true" />Blocked by {task.dependency}</span>
      ) : null}
      {task.tags.map((tag) => <span className="dl-tag" key={tag}>#{tag}</span>)}
    </div>
  );
}

export function TaskCompleteButton({ task, state }: { task: DesignTask; state: PrototypeState }): ReactElement {
  return (
    <button
      type="button"
      className="dl-complete"
      aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
      aria-pressed={task.completed}
      onClick={(event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        state.toggleTask(task.id);
        requestAnimationFrame(() => {
          if (!button.isConnected) {
            document.querySelector<HTMLElement>('[data-testid="prototype-review"]')?.focus();
          }
        });
      }}
    >
      {task.completed ? <Check aria-hidden="true" /> : null}
    </button>
  );
}

export function PrototypeEmptyState({ state }: { state: PrototypeState }): ReactElement {
  const clearSearch = (): void => {
    state.setQuery("");
    requestAnimationFrame(() => document.getElementById("prototype-search")?.focus());
  };
  return (
    <div className="dl-empty" role="status">
      <Search aria-hidden="true" />
      <strong>No tasks match this view</strong>
      <span>Try a broader word or return to the full matrix.</span>
      <button type="button" onClick={clearSearch}>Clear search</button>
    </div>
  );
}

export function PrototypeEditor({ task, direction, state }: {
  task: DesignTask;
  direction: DesignDirection;
  state: PrototypeState;
}): ReactElement {
  const [title, setTitle] = useState(task.title);
  const [quadrant, setQuadrant] = useState<DesignQuadrantId>(task.quadrant);
  const [titleError, setTitleError] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const save = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("Enter a task title before saving.");
      titleInputRef.current?.focus();
      return;
    }
    state.updateTask(task.id, title, quadrant);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) state.closeEditor(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dl-dialog-overlay" data-motion="dialog" />
        <Dialog.Content
          className={`dl-editor dl-editor-${direction.slug}`}
          aria-describedby="dl-editor-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleInputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="dl-editor-heading">
            <div>
              <Dialog.Title>Edit task</Dialog.Title>
              <Dialog.Description id="dl-editor-description">
                Prototype changes stay in this browser tab and never reach GSD data.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="dl-icon-control" aria-label="Close editor">
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={save}>
            <label className="dl-field">
              <span>Task title</span>
              <input
                ref={titleInputRef}
                value={title}
                aria-required="true"
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? "dl-title-error" : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (titleError) setTitleError("");
                }}
              />
              {titleError ? <small id="dl-title-error" className="dl-field-error" role="alert">{titleError}</small> : null}
            </label>
            <fieldset className="dl-field">
              <legend>Priority</legend>
              <div className="dl-priority-options">
                {DESIGN_QUADRANTS.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name="editor-quadrant"
                      value={option.id}
                      checked={quadrant === option.id}
                      onChange={() => setQuadrant(option.id)}
                    />
                    <QuadrantIcon quadrant={option.id} />
                    <span>{option.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="dl-field">
              <span>Notes</span>
              <textarea defaultValue={task.description} rows={4} />
            </label>
            <div className="dl-editor-actions">
              <Dialog.Close asChild><button type="button">Cancel</button></Dialog.Close>
              <button type="submit" className="is-primary">Save task</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DesignLabBackLink(): ReactElement {
  return (
    <a className="dl-back-link" href="/design-lab">
      <ChevronLeft aria-hidden="true" />
      All directions
    </a>
  );
}

export function taskCountLabel(tasks: readonly DesignTask[]): string {
  const active = tasks.filter((task) => !task.completed).length;
  return `${active} active · ${tasks.length - active} complete`;
}
