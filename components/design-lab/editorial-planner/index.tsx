"use client";

import type { ReactElement } from "react";
import { BookOpenText, CalendarRange, PenLine } from "lucide-react";

import {
  DESIGN_QUADRANTS,
  type DesignQuadrant,
  type DesignQuadrantId,
  type DesignTask,
} from "../design-data";
import type { PrototypeState } from "../prototype-state";
import {
  PrototypeEmptyState,
  PrototypeSearch,
  PrototypeThemeToggle,
  PrototypeViewSwitch,
  QuadrantIcon,
  QuickCapture,
  TaskCompleteButton,
  TaskMetadata,
  taskCountLabel,
} from "../prototype-shared";

const CHAPTER_NUMERALS: Record<DesignQuadrantId, string> = {
  q1: "I",
  q2: "II",
  q3: "III",
  q4: "IV",
};

export function EditorialPlanner({ state }: { state: PrototypeState }): ReactElement {
  return (
    <div className="dl-editorial-shell">
      <EditorialHeader state={state} />
      <main id="prototype-main" tabIndex={-1} className="dl-editorial-main">
        <EditorialFolio state={state} />
        <div className="dl-editorial-layout">
          <EditorialMargin state={state} />
          {state.view === "matrix" ? <EditorialMatrix state={state} /> : <EditorialReview state={state} />}
        </div>
      </main>
    </div>
  );
}

function EditorialHeader({ state }: { state: PrototypeState }): ReactElement {
  return (
    <header className="dl-editorial-header">
      <a href="/design-lab/editorial-planner" className="dl-editorial-wordmark touch-target">
        <strong>GSD</strong><span>Weekly planner</span>
      </a>
      <PrototypeViewSwitch state={state} />
      <div className="dl-editorial-actions">
        <PrototypeSearch state={state} className="dl-editorial-search" />
        <PrototypeThemeToggle state={state} />
      </div>
    </header>
  );
}

function EditorialFolio({ state }: { state: PrototypeState }): ReactElement {
  return (
    <section className="dl-editorial-folio" aria-labelledby="editorial-title">
      <div>
        <p className="dl-editorial-date">Week 31 · August 1–7, 2026</p>
        <h1 id="editorial-title">A week shaped around what matters.</h1>
        <p>{taskCountLabel(state.tasks)}. Read the matrix in order, then protect the work that prevents urgency.</p>
      </div>
      <span className="dl-editorial-edition">
        <CalendarRange aria-hidden="true" />Personal edition · In-memory prototype
      </span>
    </section>
  );
}

function EditorialMargin({ state }: { state: PrototypeState }): ReactElement {
  const q2Active = state.tasks.filter((task) => task.quadrant === "q2" && !task.completed).length;
  return (
    <aside className="dl-editorial-margin" aria-label="Weekly intention and quick capture">
      <div className="dl-editorial-intention">
        <span className="dl-editorial-margin-icon"><QuadrantIcon quadrant="q2" /></span>
        <p>Weekly intention</p>
        <h2>Protect what matters before it becomes urgent.</h2>
        <span>Schedule commitments currently open: {q2Active}.</span>
      </div>
      <div className="dl-editorial-margin-note">
        <p><PenLine aria-hidden="true" />Margin note</p>
        <QuickCapture
          state={state}
          className="dl-editorial-capture"
          placeholder="Add a thought for this week…"
        />
        <small>New notes enter Schedule without leaving the page.</small>
      </div>
    </aside>
  );
}

function EditorialMatrix({ state }: { state: PrototypeState }): ReactElement {
  return (
    <section className="dl-editorial-matrix" data-testid="prototype-matrix" aria-label="Weekly priority chapters">
      {state.visibleTasks.length === 0 ? <PrototypeEmptyState state={state} /> : (
        <div className="dl-editorial-chapters">
          {DESIGN_QUADRANTS.map((quadrant) => (
            <EditorialChapter
              key={quadrant.id}
              quadrant={quadrant}
              tasks={state.groupedTasks[quadrant.id]}
              state={state}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EditorialChapter({ quadrant, tasks, state }: {
  quadrant: DesignQuadrant;
  tasks: DesignTask[];
  state: PrototypeState;
}): ReactElement {
  return (
    <section className="dl-editorial-chapter" data-quadrant={quadrant.id} aria-labelledby={`editorial-${quadrant.id}`}>
      <header className="dl-editorial-chapter-heading">
        <span className="dl-editorial-chapter-number">Chapter {CHAPTER_NUMERALS[quadrant.id]}</span>
        <span className="dl-editorial-chapter-icon"><QuadrantIcon quadrant={quadrant.id} /></span>
        <div><h2 id={`editorial-${quadrant.id}`}>{quadrant.title}</h2><p>{quadrant.axis}</p></div>
        <span className="dl-editorial-chapter-count">{tasks.filter((task) => !task.completed).length} open</span>
      </header>
      <p className="dl-editorial-chapter-prompt">{quadrant.prompt}</p>
      <ul className="dl-editorial-task-list">
        {tasks.map((task) => <EditorialTask key={task.id} task={task} state={state} />)}
        {tasks.length === 0 ? <li className="dl-editorial-chapter-empty">Nothing is waiting in this chapter.</li> : null}
      </ul>
    </section>
  );
}

function EditorialTask({ task, state }: { task: DesignTask; state: PrototypeState }): ReactElement {
  return (
    <li className="dl-editorial-task" data-completed={task.completed}>
      <TaskCompleteButton task={task} state={state} />
      <div className="dl-editorial-task-content">
        <button
          type="button"
          className="dl-editorial-task-open touch-target"
          data-testid={`prototype-task-${task.id}`}
          onClick={(event) => state.openEditor(task, event.currentTarget)}
        >
          <strong>{task.title}</strong>
          <span className="dl-editorial-task-description">{task.description}</span>
        </button>
        <TaskMetadata task={task} />
      </div>
    </li>
  );
}

function EditorialReview({ state }: { state: PrototypeState }): ReactElement {
  const completed = state.tasks.filter((task) => task.completed).length;
  const q2Completed = state.tasks.filter((task) => task.quadrant === "q2" && task.completed).length;
  const q1Open = state.tasks.filter((task) => task.quadrant === "q1" && !task.completed).length;
  const q4Open = state.tasks.filter((task) => task.quadrant === "q4" && !task.completed).length;
  return (
    <section className="dl-editorial-review" data-testid="prototype-review" aria-labelledby="editorial-review-title" tabIndex={-1}>
      <header>
        <p>Weekly reflection · August 1–7</p>
        <h2 id="editorial-review-title">What did this week make room for?</h2>
      </header>
      <div className="dl-editorial-review-spread">
        <article className="dl-editorial-review-lede">
          <BookOpenText aria-hidden="true" />
          <p><strong>{completed} commitments closed.</strong> {q2Completed} came from deliberate Schedule work.</p>
          <blockquote>Urgency is loud. Important work needs an appointment.</blockquote>
        </article>
        <div className="dl-editorial-prompts">
          <EditorialPrompt quadrant="q1" title="What still needs an answer?" copy={`Do First commitments still open: ${q1Open}.`} />
          <EditorialPrompt quadrant="q2" title="What received protected time?" copy={`Strategic commitments completed: ${q2Completed}.`} />
          <EditorialPrompt quadrant="q4" title="What can leave the list?" copy={`Low-consequence items still open: ${q4Open}.`} />
        </div>
      </div>
    </section>
  );
}

function EditorialPrompt({ quadrant, title, copy }: {
  quadrant: DesignQuadrantId;
  title: string;
  copy: string;
}): ReactElement {
  return (
    <article className="dl-editorial-prompt" data-quadrant={quadrant}>
      <QuadrantIcon quadrant={quadrant} />
      <div><h3>{title}</h3><p>{copy}</p></div>
    </article>
  );
}
