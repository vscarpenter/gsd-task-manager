"use client";

import { useState, type ReactElement } from "react";
import { CalendarClock, CheckCircle2, ListChecks, PanelLeft, SearchCheck } from "lucide-react";

import {
  DESIGN_QUADRANTS,
  DESIGN_TASKS,
  type DesignQuadrant,
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

export function NativeCalm({ state }: { state: PrototypeState }): ReactElement {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(DESIGN_TASKS[0]?.id ?? null);
  const inspectTask = (taskId: string): void => {
    setSelectedTaskId(taskId);
    requestAnimationFrame(() => document.getElementById("native-inspector-title")?.focus());
  };
  return (
    <div className="dl-native-shell">
      <div className="dl-native-stage">
        <NativeToolbar state={state} />
        <main id="prototype-main" tabIndex={-1} className="dl-native-main">
          {state.view === "matrix" ? (
            <NativeMatrix state={state} selectedTaskId={selectedTaskId} onInspect={inspectTask} />
          ) : <NativeReview state={state} />}
        </main>
        <div className="dl-native-bottom-capture">
          <QuickCapture state={state} placeholder={`New task in ${activeTitle(state)}…`} />
        </div>
      </div>
      <NativeSidebar state={state} />
    </div>
  );
}

function NativeSidebar({ state }: { state: PrototypeState }): ReactElement {
  return (
    <aside className="dl-native-sidebar">
      <a href="/design-lab/native-calm" className="dl-native-brand" aria-label="GSD · Native Calm home">
        <span className="dl-native-brand-mark"><ListChecks aria-hidden="true" /></span>
        <span><strong>GSD</strong><small>Personal priorities</small></span>
      </a>
      <nav aria-label="Priority sources">
        <p>Priorities</p>
        {DESIGN_QUADRANTS.map((quadrant) => (
          <button
            key={quadrant.id}
            type="button"
            data-quadrant={quadrant.id}
            aria-label={`Focus ${quadrant.title}`}
            aria-pressed={state.activeQuadrant === quadrant.id}
            onClick={() => state.setActiveQuadrant(quadrant.id)}
          >
            <QuadrantIcon quadrant={quadrant.id} />
            <span>{quadrant.title}</span>
            <b>{state.groupedTasks[quadrant.id].filter((task) => !task.completed).length}</b>
          </button>
        ))}
      </nav>
      <div className="dl-native-sidebar-summary"><PanelLeft aria-hidden="true" /><span>{taskCountLabel(state.tasks)}</span></div>
    </aside>
  );
}

function NativeToolbar({ state }: { state: PrototypeState }): ReactElement {
  return (
    <header className="dl-native-toolbar">
      <div><p>My workspace</p><h1>{state.view === "matrix" ? activeTitle(state) : "Weekly review"}</h1></div>
      <PrototypeViewSwitch state={state} matrixLabel="Priorities" />
      <div className="dl-native-toolbar-actions">
        <PrototypeSearch state={state} />
        <PrototypeThemeToggle state={state} />
      </div>
    </header>
  );
}

function NativeMatrix({ state, selectedTaskId, onInspect }: {
  state: PrototypeState;
  selectedTaskId: string | null;
  onInspect: (taskId: string) => void;
}): ReactElement {
  const selected = state.visibleTasks.find((task) => task.id === selectedTaskId);
  const inspected = selected ?? state.groupedTasks[state.activeQuadrant][0] ?? state.visibleTasks[0];
  const effectiveSelectedTaskId = inspected?.id ?? null;
  return (
    <section className="dl-native-matrix" data-testid="prototype-matrix" aria-label="Priority list and detail">
      {state.visibleTasks.length === 0 ? (
        <PrototypeEmptyState state={state} />
      ) : (
        <div className="dl-native-list-detail">
          <div className="dl-native-groups">
            {DESIGN_QUADRANTS.map((quadrant) => (
              <NativeGroup key={quadrant.id} quadrant={quadrant} state={state} selectedTaskId={effectiveSelectedTaskId} onInspect={onInspect} />
            ))}
          </div>
          <NativeInspector task={inspected} state={state} />
        </div>
      )}
    </section>
  );
}

function NativeGroup({ quadrant, state, selectedTaskId, onInspect }: {
  quadrant: DesignQuadrant;
  state: PrototypeState;
  selectedTaskId: string | null;
  onInspect: (taskId: string) => void;
}): ReactElement {
  const tasks = state.groupedTasks[quadrant.id];
  return (
    <section className="dl-native-group" data-quadrant={quadrant.id} aria-labelledby={`native-${quadrant.id}`}>
      <header>
        <span><QuadrantIcon quadrant={quadrant.id} /></span>
        <div><h2 id={`native-${quadrant.id}`}>{quadrant.title}</h2><p>{quadrant.axis}</p></div>
        <b>{tasks.filter((task) => !task.completed).length}</b>
      </header>
      <div className="dl-native-rows">
        {tasks.length === 0 ? <p className="dl-native-group-empty">No matching tasks</p> : null}
        {tasks.map((task) => (
          <NativeTaskRow
            key={task.id}
            task={task}
            state={state}
            selected={task.id === selectedTaskId}
            onInspect={onInspect}
          />
        ))}
      </div>
    </section>
  );
}

function NativeTaskRow({ task, state, selected, onInspect }: {
  task: DesignTask;
  state: PrototypeState;
  selected: boolean;
  onInspect: (taskId: string) => void;
}): ReactElement {
  return (
    <article className="dl-native-row" data-completed={task.completed} data-selected={selected}>
      <TaskCompleteButton task={task} state={state} />
      <button
        type="button"
        className="dl-native-row-open"
        data-testid={`prototype-task-${task.id}`}
        aria-pressed={selected}
        aria-controls="native-task-inspector"
        onClick={() => {
          onInspect(task.id);
        }}
      >
        <span><strong>{task.title}</strong><small>{task.description}</small></span>
        <TaskMetadata task={task} compact />
      </button>
    </article>
  );
}

function NativeInspector({ task, state }: {
  task: DesignTask | undefined;
  state: PrototypeState;
}): ReactElement {
  if (!task) return <aside id="native-task-inspector" className="dl-native-inspector" aria-label="Task inspector" />;
  const quadrant = DESIGN_QUADRANTS.find((candidate) => candidate.id === task.quadrant);
  return (
    <aside id="native-task-inspector" className="dl-native-inspector" aria-label="Task inspector" data-quadrant={task.quadrant}>
      <header><span><QuadrantIcon quadrant={task.quadrant} /></span><div><p>{quadrant?.axis}</p><strong>{quadrant?.title}</strong></div></header>
      <div className="dl-native-inspector-body">
        <p>Selected task</p><h2 id="native-inspector-title" tabIndex={-1}>Review “{task.title}”</h2><p>{task.description}</p>
        <TaskMetadata task={task} />
      </div>
      <footer>
        <TaskCompleteButton task={task} state={state} />
        <button type="button" onClick={(event) => state.openEditor(task, event.currentTarget)}>Edit task</button>
      </footer>
    </aside>
  );
}

function NativeReview({ state }: { state: PrototypeState }): ReactElement {
  const completed = state.tasks.filter((task) => task.completed).length;
  const dueToday = state.tasks.filter((task) => task.dueTone === "today" && !task.completed).length;
  const q2Active = state.groupedTasks.q2.filter((task) => !task.completed).length;
  return (
    <section className="dl-native-review" data-testid="prototype-review" aria-labelledby="native-review-heading" tabIndex={-1}>
      <div className="dl-native-review-summary">
        <header><div><p>Inspector summary</p><h2 id="native-review-heading">A calm read on the week.</h2></div><span>Aug 1–7</span></header>
        <div className="dl-native-review-metrics">
          <NativeMetric icon={<CheckCircle2 aria-hidden="true" />} label="Completed" value={completed} detail="This working set" />
          <NativeMetric icon={<CalendarClock aria-hidden="true" />} label="Due today" value={dueToday} detail="Needs a decision" />
          <NativeMetric icon={<SearchCheck aria-hidden="true" />} label="Q2 protected" value={q2Active} detail="Strategic tasks active" />
        </div>
        <NativeReviewGroups state={state} />
      </div>
    </section>
  );
}

function NativeMetric({ icon, label, value, detail }: {
  icon: ReactElement;
  label: string;
  value: number;
  detail: string;
}): ReactElement {
  return (
    <article className="dl-native-review-metric">
      {icon}<span>{label}</span><strong>{value}</strong><small>{detail}</small>
    </article>
  );
}

function NativeReviewGroups({ state }: { state: PrototypeState }): ReactElement {
  if (state.visibleTasks.length === 0) return <PrototypeEmptyState state={state} />;
  return (
    <div className="dl-native-review-groups">
      <h3>Priority balance</h3>
      {DESIGN_QUADRANTS.map((quadrant) => {
        const count = state.groupedTasks[quadrant.id].filter((task) => !task.completed).length;
        return <div key={quadrant.id} data-quadrant={quadrant.id}><QuadrantIcon quadrant={quadrant.id} /><span>{quadrant.title}</span><b>{count}</b></div>;
      })}
    </div>
  );
}

function activeTitle(state: PrototypeState): string {
  return DESIGN_QUADRANTS.find((quadrant) => quadrant.id === state.activeQuadrant)?.title ?? "Priorities";
}
