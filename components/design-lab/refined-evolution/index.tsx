"use client";

import type { ReactElement } from "react";
import { CalendarCheck2, LockKeyhole, Sparkles } from "lucide-react";

import { DESIGN_QUADRANTS, type DesignQuadrant, type DesignTask } from "../design-data";
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

export function RefinedEvolution({ state }: { state: PrototypeState }): ReactElement {
  return (
    <div className="dl-refined-shell">
      <RefinedHeader state={state} />
      <main id="prototype-main" tabIndex={-1} className="dl-refined-main">
        <section className="dl-refined-intro">
          <div>
            <p className="dl-refined-kicker">Today’s matrix</p>
            <h1>Decide what deserves you.</h1>
            <p>{taskCountLabel(state.tasks)} · In-memory prototype</p>
          </div>
          <aside>
            <CalendarCheck2 aria-hidden="true" />
            <span><strong>Protect Q2</strong>Reserve one strategic block before reacting.</span>
          </aside>
        </section>
        <QuickCapture state={state} className="dl-refined-capture" />
        {state.view === "matrix" ? <RefinedMatrix state={state} /> : <RefinedReview state={state} />}
      </main>
    </div>
  );
}

function RefinedHeader({ state }: { state: PrototypeState }): ReactElement {
  return (
    <header className="dl-refined-header">
      <a href="/design-lab/refined-evolution" className="dl-wordmark">GSD</a>
      <PrototypeViewSwitch state={state} />
      <div className="dl-refined-actions">
        <PrototypeSearch state={state} />
        <PrototypeThemeToggle state={state} />
      </div>
    </header>
  );
}

function RefinedMatrix({ state }: { state: PrototypeState }): ReactElement {
  if (state.visibleTasks.length === 0) return <PrototypeEmptyState state={state} />;
  return (
    <div className="dl-refined-matrix" data-testid="prototype-matrix">
      {DESIGN_QUADRANTS.map((quadrant) => (
        <RefinedPane
          key={quadrant.id}
          quadrant={quadrant}
          tasks={state.groupedTasks[quadrant.id]}
          state={state}
        />
      ))}
    </div>
  );
}

function RefinedPane({ quadrant, tasks, state }: {
  quadrant: DesignQuadrant;
  tasks: DesignTask[];
  state: PrototypeState;
}): ReactElement {
  return (
    <section className="dl-refined-pane" data-quadrant={quadrant.id} aria-labelledby={`refined-${quadrant.id}`}>
      <header>
        <span className="dl-quadrant-mark"><QuadrantIcon quadrant={quadrant.id} /></span>
        <div><h2 id={`refined-${quadrant.id}`}>{quadrant.title}</h2><p>{quadrant.axis}</p></div>
        <span className="dl-count">{tasks.filter((task) => !task.completed).length}</span>
      </header>
      <div className="dl-refined-task-list">
        {tasks.map((task) => <RefinedTask key={task.id} task={task} state={state} />)}
      </div>
    </section>
  );
}

function RefinedTask({ task, state }: { task: DesignTask; state: PrototypeState }): ReactElement {
  return (
    <article className="dl-refined-task" data-completed={task.completed}>
      <TaskCompleteButton task={task} state={state} />
      <button
        type="button"
        className="dl-task-open"
        data-testid={`prototype-task-${task.id}`}
        onClick={(event) => state.openEditor(task, event.currentTarget)}
      >
        <strong>{task.title}</strong>
        <TaskMetadata task={task} compact />
      </button>
    </article>
  );
}

function RefinedReview({ state }: { state: PrototypeState }): ReactElement {
  const active = state.tasks.filter((task) => !task.completed).length;
  const q2Active = state.tasks.filter((task) => task.quadrant === "q2" && !task.completed).length;
  const strategicShare = active === 0 ? 0 : Math.round((q2Active / active) * 100);
  const overdue = state.tasks.filter((task) => task.dueTone === "overdue" && !task.completed).length;
  return (
    <section className="dl-refined-review" data-testid="prototype-review" aria-labelledby="refined-review-title" tabIndex={-1}>
      <header><div><p>Weekly review</p><h2 id="refined-review-title">Move from reaction to intention.</h2></div><span>Aug 1–7</span></header>
      <div className="dl-refined-metrics">
        <article className="is-primary"><Sparkles aria-hidden="true" /><span>Strategic share</span><strong>{strategicShare}%</strong><small>{q2Active} active Q2 tasks</small></article>
        <article><CalendarCheck2 aria-hidden="true" /><span>Active work</span><strong>{active}</strong><small>Across four priorities</small></article>
        <article><LockKeyhole aria-hidden="true" /><span>Needs rescue</span><strong>{overdue}</strong><small>Overdue commitment</small></article>
      </div>
      <div className="dl-refined-distribution">
        <h3>Where attention is sitting</h3>
        {DESIGN_QUADRANTS.map((quadrant) => {
          const count = state.tasks.filter((task) => task.quadrant === quadrant.id && !task.completed).length;
          return <div key={quadrant.id} data-quadrant={quadrant.id}><span>{quadrant.title}</span><i style={{ width: `${count * 26}%` }} /><b>{count}</b></div>;
        })}
      </div>
    </section>
  );
}
