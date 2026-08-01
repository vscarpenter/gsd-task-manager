"use client";

import type { ReactElement } from "react";
import { CalendarCheck2, CheckCircle2, Focus, TrendingUp } from "lucide-react";

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

export function SpatialFocus({ state }: { state: PrototypeState }): ReactElement {
  return (
    <div className="dl-spatial-shell">
      <SpatialHeader state={state} />
      <main id="prototype-main" tabIndex={-1} className="dl-spatial-main">
        <SpatialIntroduction state={state} />
        {state.view === "matrix" ? <SpatialMatrix state={state} /> : <SpatialReview state={state} />}
      </main>
    </div>
  );
}

function SpatialHeader({ state }: { state: PrototypeState }): ReactElement {
  return (
    <header className="dl-spatial-header">
      <a href="/design-lab/spatial-focus" className="dl-spatial-wordmark" aria-label="GSD · Spatial Focus home">
        <Focus aria-hidden="true" />
        <span>GSD</span>
      </a>
      <PrototypeViewSwitch state={state} />
      <div className="dl-spatial-header-actions">
        <PrototypeSearch state={state} />
        <PrototypeThemeToggle state={state} />
      </div>
    </header>
  );
}

function SpatialIntroduction({ state }: { state: PrototypeState }): ReactElement {
  const active = findQuadrant(state.activeQuadrant);
  return (
    <section className="dl-spatial-intro" aria-labelledby="spatial-heading">
      <div>
        <p className="dl-spatial-kicker">Attention field</p>
        <h1 id="spatial-heading">Make room for what matters.</h1>
        <p>{taskCountLabel(state.tasks)} · {active.title} is in focus</p>
      </div>
      <div className="dl-spatial-capture-context">
        <span><QuadrantIcon quadrant={active.id} />Capturing into {active.title}</span>
        <QuickCapture state={state} placeholder={`Add to ${active.title.toLowerCase()}…`} />
      </div>
    </section>
  );
}

function SpatialMatrix({ state }: { state: PrototypeState }): ReactElement {
  const active = findQuadrant(state.activeQuadrant);
  const orbiting = DESIGN_QUADRANTS.filter((quadrant) => quadrant.id !== active.id);
  return (
    <section className="dl-spatial-matrix" data-testid="prototype-matrix" data-active-quadrant={active.id}>
      <SpatialQ2Cue state={state} />
      {state.visibleTasks.length === 0 ? (
        <PrototypeEmptyState state={state} />
      ) : (
        <div className="dl-spatial-field">
          <SpatialActiveQuadrant quadrant={active} state={state} />
          <div className="dl-spatial-orbits">
            {orbiting.map((quadrant, index) => (
              <SpatialOrbit key={quadrant.id} quadrant={quadrant} orbit={index + 1} state={state} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SpatialQ2Cue({ state }: { state: PrototypeState }): ReactElement {
  const q2Active = state.groupedTasks.q2.filter((task) => !task.completed).length;
  return (
    <div className="dl-spatial-q2-cue" data-current={state.activeQuadrant === "q2"}>
      <CalendarCheck2 aria-hidden="true" />
      <div><strong>Q2 keeps the long game visible.</strong><span>{q2Active} strategic commitments need protected time.</span></div>
      <button
        type="button"
        aria-pressed={state.activeQuadrant === "q2"}
        onClick={() => state.setActiveQuadrant("q2")}
      >
        Focus Schedule
      </button>
    </div>
  );
}

function SpatialActiveQuadrant({ quadrant, state }: {
  quadrant: DesignQuadrant;
  state: PrototypeState;
}): ReactElement {
  const tasks = state.groupedTasks[quadrant.id];
  return (
    <section className="dl-spatial-active" data-quadrant={quadrant.id} aria-labelledby={`spatial-${quadrant.id}`}>
      <header>
        <span className="dl-spatial-quadrant-icon"><QuadrantIcon quadrant={quadrant.id} /></span>
        <div><p>{quadrant.axis}</p><h2 id={`spatial-${quadrant.id}`} tabIndex={-1}>{quadrant.title}</h2><span>{quadrant.prompt}</span></div>
        <strong className="dl-spatial-count">{activeCount(tasks)}</strong>
      </header>
      <div className="dl-spatial-task-list">
        {tasks.length === 0 ? <p className="dl-spatial-local-empty">No matching tasks in this priority.</p> : null}
        {tasks.map((task) => <SpatialTask key={task.id} task={task} state={state} />)}
      </div>
    </section>
  );
}

function SpatialOrbit({ quadrant, orbit, state }: {
  quadrant: DesignQuadrant;
  orbit: number;
  state: PrototypeState;
}): ReactElement {
  const tasks = state.groupedTasks[quadrant.id];
  return (
    <section className="dl-spatial-orbit" data-quadrant={quadrant.id} data-orbit={orbit}>
      <header>
        <span><QuadrantIcon quadrant={quadrant.id} /></span>
        <div><h2>{quadrant.title}</h2><p>{activeCount(tasks)} active</p></div>
        <button
          type="button"
          onClick={() => {
            state.setActiveQuadrant(quadrant.id);
            requestAnimationFrame(() => document.getElementById(`spatial-${quadrant.id}`)?.focus());
          }}
          aria-label={`Bring forward ${quadrant.title}`}
        >
          Bring forward
        </button>
      </header>
      <div className="dl-spatial-orbit-tasks">
        {tasks.map((task) => <SpatialTask key={task.id} task={task} state={state} compact />)}
      </div>
    </section>
  );
}

function SpatialTask({ task, state, compact = false }: {
  task: DesignTask;
  state: PrototypeState;
  compact?: boolean;
}): ReactElement {
  return (
    <article className={`dl-spatial-task ${compact ? "is-compact" : ""}`.trim()} data-completed={task.completed}>
      <TaskCompleteButton task={task} state={state} />
      <button
        type="button"
        className="dl-spatial-task-open"
        data-testid={`prototype-task-${task.id}`}
        onClick={(event) => state.openEditor(task, event.currentTarget)}
      >
        <strong>{task.title}</strong>
        <TaskMetadata task={task} compact={compact} />
      </button>
    </article>
  );
}

function SpatialReview({ state }: { state: PrototypeState }): ReactElement {
  const activeTasks = state.visibleTasks.filter((task) => !task.completed);
  const completed = state.tasks.filter((task) => task.completed).length;
  const q2Active = state.groupedTasks.q2.filter((task) => !task.completed).length;
  const overdue = state.tasks.filter((task) => task.dueTone === "overdue" && !task.completed).length;
  return (
    <section className="dl-spatial-review" data-testid="prototype-review" aria-labelledby="spatial-review-title" tabIndex={-1}>
      <header>
        <div><p className="dl-spatial-kicker">Focus and momentum</p><h2 id="spatial-review-title">Keep intention ahead of reaction.</h2></div>
        <span>This week</span>
      </header>
      <div className="dl-spatial-momentum">
        <SpatialMetric icon={<TrendingUp aria-hidden="true" />} label="Momentum" value={`${completionRate(state.tasks)}%`} detail={`${completed} tasks complete`} primary />
        <SpatialMetric icon={<CalendarCheck2 aria-hidden="true" />} label="Protected Q2" value={`${q2Active}`} detail="Strategic commitments" />
        <SpatialMetric icon={<CheckCircle2 aria-hidden="true" />} label="Needs rescue" value={`${overdue}`} detail="Overdue commitments" />
      </div>
      {activeTasks.length === 0 ? <PrototypeEmptyState state={state} /> : <SpatialReviewList tasks={activeTasks} state={state} />}
    </section>
  );
}

function SpatialMetric({ icon, label, value, detail, primary = false }: {
  icon: ReactElement;
  label: string;
  value: string;
  detail: string;
  primary?: boolean;
}): ReactElement {
  return (
    <article className="dl-spatial-metric" data-primary={primary}>
      {icon}<span>{label}</span><strong>{value}</strong><small>{detail}</small>
    </article>
  );
}

function SpatialReviewList({ tasks, state }: { tasks: DesignTask[]; state: PrototypeState }): ReactElement {
  return (
    <div className="dl-spatial-review-list">
      <div><h3>Next focus</h3><p>Active work ordered by the matrix, not by noise.</p></div>
      <div>{tasks.map((task) => <SpatialTask key={task.id} task={task} state={state} compact />)}</div>
    </div>
  );
}

function findQuadrant(id: DesignQuadrantId): DesignQuadrant {
  return DESIGN_QUADRANTS.find((quadrant) => quadrant.id === id) ?? DESIGN_QUADRANTS[1];
}

function activeCount(tasks: readonly DesignTask[]): number {
  return tasks.filter((task) => !task.completed).length;
}

function completionRate(tasks: readonly DesignTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100);
}
