"use client";

import { useEffect, useRef, type ReactElement, type RefObject } from "react";

import {
  DESIGN_QUADRANTS,
  type DesignQuadrant,
  type DesignQuadrantId,
  type DesignTask,
  type DueTone,
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
} from "../prototype-shared";

const QUADRANT_RANK: Record<DesignQuadrantId, number> = { q1: 0, q2: 1, q3: 2, q4: 3 };
const DUE_RANK: Record<DueTone, number> = { overdue: 0, today: 1, upcoming: 2 };

interface OperatorMetric {
  label: string;
  value: string;
  detail: string;
  primary?: boolean;
}

export function PrecisionUtility({ state }: { state: PrototypeState }): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  usePrecisionShortcuts(rootRef, state);
  return (
    <div className="dl-precision-shell" ref={rootRef}>
      <div className="dl-precision-frame">
        <PrecisionHeader state={state} />
        <main id="prototype-main" tabIndex={-1} className="dl-precision-main">
          <PrecisionStatus state={state} />
          <QuickCapture
            state={state}
            className="dl-precision-capture"
            placeholder={`Capture directly to ${state.activeQuadrant.toUpperCase()}…`}
          />
          {state.view === "matrix" ? <PrecisionMatrix state={state} /> : <PrecisionReview state={state} />}
        </main>
      </div>
      <PrecisionRail state={state} />
    </div>
  );
}

function PrecisionRail({ state }: { state: PrototypeState }): ReactElement {
  return (
    <nav className="dl-precision-rail" aria-label="Priority command rail">
      <a className="dl-precision-wordmark touch-target" href="/design-lab/precision-utility" aria-label="GSD 03 · Precision Utility home">
        <strong>GSD</strong><span>03</span>
      </a>
      <ol className="dl-precision-destinations">
        {DESIGN_QUADRANTS.map((quadrant, index) => (
          <li key={quadrant.id}>
            <button
              type="button"
              className="touch-target"
              aria-pressed={state.activeQuadrant === quadrant.id}
              onClick={() => state.setActiveQuadrant(quadrant.id)}
            >
              <kbd aria-hidden="true">⌥{index + 1}</kbd>
              <QuadrantIcon quadrant={quadrant.id} />
              <span>{quadrant.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <section className="dl-precision-shortcuts" aria-label="Keyboard shortcuts">
        <span><kbd>⌥/</kbd>Search</span><span><kbd>⌥N</kbd>Capture</span><span><kbd>⌥R</kbd>Review</span>
      </section>
      <PrototypeThemeToggle state={state} />
    </nav>
  );
}

function PrecisionHeader({ state }: { state: PrototypeState }): ReactElement {
  return (
    <header className="dl-precision-header">
      <div>
        <p>Local workspace / Week 31</p>
        <h1>Priority control</h1>
      </div>
      <div className="dl-precision-header-tools">
        <PrototypeSearch state={state} className="dl-precision-search" />
        <PrototypeViewSwitch state={state} matrixLabel="Queues" />
      </div>
    </header>
  );
}

function PrecisionStatus({ state }: { state: PrototypeState }): ReactElement {
  const queue = DESIGN_QUADRANTS.find((quadrant) => quadrant.id === state.activeQuadrant);
  const queueCount = state.groupedTasks[state.activeQuadrant].filter((task) => !task.completed).length;
  const active = state.tasks.filter((task) => !task.completed).length;
  return (
    <section className="dl-precision-status" aria-label="Workspace status">
      <span><b>{String(active).padStart(2, "0")}</b> active</span>
      <span><b>{String(queueCount).padStart(2, "0")}</b> in {queue?.title}</span>
      <span><i aria-hidden="true" />Local state ready</span>
      <span>Capture route <kbd>{state.activeQuadrant.toUpperCase()}</kbd></span>
    </section>
  );
}

function PrecisionMatrix({ state }: { state: PrototypeState }): ReactElement {
  return (
    <section className="dl-precision-matrix" data-testid="prototype-matrix" aria-label="Priority work queues">
      {state.visibleTasks.length === 0 ? <PrototypeEmptyState state={state} /> : (
        <div className="dl-precision-table-wrap">
          <table className="dl-precision-table">
            <caption className="sr-only">Tasks grouped into four priority work queues</caption>
            <thead><tr><th scope="col">Ref</th><th scope="col">Work item</th><th scope="col">Signals</th><th scope="col">State</th></tr></thead>
            {DESIGN_QUADRANTS.map((quadrant) => (
              <PrecisionQueue
                key={quadrant.id}
                quadrant={quadrant}
                tasks={state.groupedTasks[quadrant.id]}
                state={state}
              />
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

function PrecisionQueue({ quadrant, tasks, state }: {
  quadrant: DesignQuadrant;
  tasks: DesignTask[];
  state: PrototypeState;
}): ReactElement {
  return (
    <tbody className="dl-precision-queue" data-quadrant={quadrant.id}>
      <tr className="dl-precision-queue-heading">
        <th scope="rowgroup" colSpan={4}>
          <span><QuadrantIcon quadrant={quadrant.id} /><b>{quadrant.id.toUpperCase()} · {quadrant.title}</b><small>{quadrant.axis}</small></span>
          <span>{tasks.filter((task) => !task.completed).length} open</span>
        </th>
      </tr>
      {tasks.map((task, index) => (
        <PrecisionTaskRow key={task.id} index={index} task={task} state={state} />
      ))}
      {tasks.length === 0 ? <tr><td colSpan={4} className="dl-precision-queue-empty">Queue clear</td></tr> : null}
    </tbody>
  );
}

function PrecisionTaskRow({ index, task, state }: {
  index: number;
  task: DesignTask;
  state: PrototypeState;
}): ReactElement {
  return (
    <tr className="dl-precision-task" data-completed={task.completed}>
      <td><code>{task.quadrant.toUpperCase()}.{String(index + 1).padStart(2, "0")}</code></td>
      <th scope="row" className="dl-precision-work-item">
        <button
          type="button"
          className="dl-precision-task-open touch-target"
          data-testid={`prototype-task-${task.id}`}
          onClick={(event) => state.openEditor(task, event.currentTarget)}
        >
          <strong>{task.title}</strong><small>{task.description}</small>
        </button>
      </th>
      <td><TaskMetadata task={task} compact /></td>
      <td><span className="dl-precision-state">{task.completed ? "Done" : "Open"}<TaskCompleteButton task={task} state={state} /></span></td>
    </tr>
  );
}

function PrecisionReview({ state }: { state: PrototypeState }): ReactElement {
  const ranked = rankTasks(state.visibleTasks);
  return (
    <section className="dl-precision-review" data-testid="prototype-review" aria-labelledby="precision-review-title" tabIndex={-1}>
      <header>
        <div><p>Operator review / Week 31</p><h2 id="precision-review-title">Queue health and next actions</h2></div>
        <span>Ranked by quadrant, then due state</span>
      </header>
      <div className="dl-precision-metrics">
        {buildOperatorMetrics(state.tasks).map((metric) => (
          <div key={metric.label} className={metric.primary ? "is-primary" : undefined}>
            <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
          </div>
        ))}
      </div>
      {ranked.length === 0 ? <PrototypeEmptyState state={state} /> : <PrecisionRankedTable tasks={ranked} state={state} />}
    </section>
  );
}

function PrecisionRankedTable({ tasks, state }: {
  tasks: DesignTask[];
  state: PrototypeState;
}): ReactElement {
  return (
    <div className="dl-precision-ranked-wrap">
      <table className="dl-precision-ranked">
        <caption>Ranked active queue</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Work item</th><th scope="col">Queue</th><th scope="col">Signals</th><th scope="col">State</th></tr></thead>
        <tbody>
          {tasks.map((task, index) => (
            <tr key={task.id} data-quadrant={task.quadrant}>
              <td><b>{String(index + 1).padStart(2, "0")}</b></td>
              <th scope="row" className="dl-precision-work-item">
                <button
                  type="button"
                  className="dl-precision-ranked-open touch-target"
                  data-testid={`prototype-task-${task.id}`}
                  onClick={(event) => state.openEditor(task, event.currentTarget)}
                >
                  {task.title}
                </button>
              </th>
              <td><span className="dl-precision-quadrant"><QuadrantIcon quadrant={task.quadrant} />{task.quadrant.toUpperCase()}</span></td>
              <td><TaskMetadata task={task} compact /></td>
              <td><span className="dl-precision-state">Open<TaskCompleteButton task={task} state={state} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rankTasks(tasks: readonly DesignTask[]): DesignTask[] {
  return tasks
    .filter((task) => !task.completed)
    .sort((left, right) => taskRank(left) - taskRank(right));
}

function usePrecisionShortcuts(rootRef: RefObject<HTMLDivElement | null>, state: PrototypeState): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (state.editorTask || ignoreShortcut(event)) return;
      const quadrantIndex = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (quadrantIndex >= 0) {
        const quadrant = DESIGN_QUADRANTS[quadrantIndex];
        if (!quadrant) return;
        event.preventDefault();
        state.setActiveQuadrant(quadrant.id);
      } else if (event.code === "Slash") {
        event.preventDefault();
        focusControl(rootRef, 'input[type="search"]');
      } else if (event.code === "KeyN") {
        event.preventDefault();
        focusControl(rootRef, '[data-testid="prototype-capture-input"]');
      } else if (event.code === "KeyR") {
        event.preventDefault();
        state.setView("review");
        requestAnimationFrame(() => {
          rootRef.current?.querySelector<HTMLElement>('[data-testid="prototype-review"]')?.focus();
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [rootRef, state]);
}

function ignoreShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return true;
  const target = event.target;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

function focusControl(rootRef: RefObject<HTMLDivElement | null>, selector: string): void {
  rootRef.current?.querySelector<HTMLElement>(selector)?.focus();
}

function taskRank(task: DesignTask): number {
  const dueRank = task.dueTone ? DUE_RANK[task.dueTone] : 3;
  return (QUADRANT_RANK[task.quadrant] * 10) + dueRank;
}

function buildOperatorMetrics(tasks: readonly DesignTask[]): OperatorMetric[] {
  const active = tasks.filter((task) => !task.completed);
  const completed = tasks.length - active.length;
  const q2Active = active.filter((task) => task.quadrant === "q2").length;
  const overdue = active.filter((task) => task.dueTone === "overdue").length;
  const completionRate = Math.round((completed / tasks.length) * 100);
  const q2Share = active.length === 0 ? 0 : Math.round((q2Active / active.length) * 100);
  return [
    { label: "Open queue", value: String(active.length).padStart(2, "0"), detail: "Across all priorities", primary: true },
    { label: "Past due", value: String(overdue).padStart(2, "0"), detail: "Needs immediate routing" },
    { label: "Completion", value: `${completionRate}%`, detail: `${completed} of ${tasks.length} closed` },
    { label: "Q2 share", value: `${q2Share}%`, detail: `${q2Active} strategic items open` },
  ];
}
