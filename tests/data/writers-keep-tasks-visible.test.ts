/**
 * The matrix hides a row that fails the schema, so a writer that pushes a task
 * past a limit makes it vanish. Each writer runs on a task at every limit. A
 * new export needs a case here before `typecheck:tests` passes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_LIMITS } from '@/lib/constants/schema';
import { getDb } from '@/lib/db';
import * as tasks from '@/lib/tasks';
import { taskValidationMessage } from '@/lib/tasks/crud/validation-error';
import * as saved from '@/lib/tasks/saved';
import * as topThree from '@/lib/tasks/top-three-actions';
import type { TaskRecord } from '@/lib/types';
import { keepValidTaskRecords } from '@/lib/use-tasks';
import { createMockTask } from '@/tests/fixtures';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ID = 'full-task';
const NOW = new Date('2026-10-20T12:00:00.000Z');
const L = SCHEMA_LIMITS;
const list = <T>(length: number, make: (index: number) => T): T[] => Array.from({ length }, (_, index) => make(index));

function atEveryLimit(extra: Partial<TaskRecord> = {}): TaskRecord {
  return createMockTask({
    id: ID,
    title: 't'.repeat(L.TASK_TITLE_MAX_LENGTH),
    description: 'd'.repeat(L.TASK_DESCRIPTION_MAX_LENGTH),
    recurrence: 'daily',
    dueDate: '2026-10-20T09:00:00.000Z',
    tags: list(L.MAX_TAGS, (i) => `tag-${i}`),
    subtasks: list(L.MAX_SUBTASKS, (i) => ({ id: `step-${i}`, title: 's'.repeat(L.SUBTASK_TITLE_MAX_LENGTH), completed: false })),
    dependencies: list(L.MAX_DEPENDENCIES, (i) => `other-${i}`),
    timeEntries: list(L.MAX_TIME_ENTRIES, (i) => ({
      id: `entry-${i}`, startedAt: '2026-10-01T09:00:00.000Z', endedAt: '2026-10-01T09:05:00.000Z',
    })),
    timeSpent: L.MAX_TIME_ENTRIES * 5,
    ...extra,
  });
}

/** Puts the full task in the state an act needs, then acts on it. */
function from(extra: Partial<TaskRecord>, act: (task: TaskRecord) => Promise<unknown>) {
  return async () => {
    const task = atEveryLimit(extra);
    await getDb().tasks.put(task);
    return act(task);
  };
}

const PICKED = { focusDate: '2026-10-20', focusRank: 2 } as const;
const READS = 'writes no task';
const ELSEWHERE = 'validated at the import boundary, with suites of its own';

type Writer = keyof typeof tasks | keyof typeof saved | keyof typeof topThree;
const WRITERS = {
  listTasks: READS,
  isTaskSnoozed: READS,
  getRemainingSnoozeMinutes: READS,
  formatSnoozeRemaining: READS,
  hasRunningTimer: READS,
  getRunningEntry: READS,
  formatTimeSpent: READS,
  exportTasks: READS,
  exportToJson: READS,
  exportToJsonWithReport: READS,
  importTasks: ELSEWHERE,
  importFromJson: ELSEWHERE,
  clearTasks: () => tasks.clearTasks(),
  createTask: from({}, (task) => tasks.createTask({
    title: task.title, description: task.description, urgent: true, important: true, tags: task.tags, subtasks: task.subtasks,
  })),
  updateTask: from({}, () => tasks.updateTask(ID, { urgent: true })),
  toggleCompleted: from({}, () => tasks.toggleCompleted(ID, true)),
  deleteTask: from({}, () => tasks.deleteTask(ID)),
  restoreTask: async () => tasks.restoreTask(atEveryLimit()),
  moveTaskToQuadrant: from({}, () => tasks.moveTaskToQuadrant(ID, 'urgent-important')),
  duplicateTask: from({}, () => tasks.duplicateTask(ID)),
  snoozeTask: from({}, () => tasks.snoozeTask(ID, 15)),
  clearSnooze: from({ snoozedUntil: '2026-10-21T09:00:00.000Z' }, () => tasks.clearSnooze(ID)),
  startTimeTracking: from({}, () => tasks.startTimeTracking(ID)),
  stopTimeTracking: from(
    { timeEntries: [...atEveryLimit().timeEntries!.slice(1), { id: 'running', startedAt: '2026-10-20T08:00:00.000Z' }] },
    () => tasks.stopTimeTracking(ID),
  ),
  toggleSubtask: from({}, () => tasks.toggleSubtask(ID, 'step-0', true)),
  addSubtask: from({}, () => tasks.addSubtask(ID, 'one more')),
  deleteSubtask: from({}, () => tasks.deleteSubtask(ID, 'step-0')),
  addDependency: from({}, () => tasks.addDependency(ID, 'one-more')),
  removeDependency: from({}, () => tasks.removeDependency(ID, 'other-0')),
  removeDependencyReferences: from({}, () => tasks.removeDependencyReferences('other-0')),
  saveTaskForLater: from({}, () => saved.saveTaskForLater(ID)),
  returnSavedTask: from({ savedAt: '2026-10-19T09:00:00.000Z' }, () => saved.returnSavedTask(ID, 'urgent-important', undefined)),
  addToToday: from({}, (task) => topThree.addToToday(ID, [task], NOW, 'UTC')),
  removeFromToday: from(PICKED, () => topThree.removeFromToday(ID)),
  movePick: from(PICKED, (task) => topThree.movePick(ID, 'up', [task], NOW, 'UTC')),
  tidyPicks: from(PICKED, (task) => topThree.tidyPicks([task], NOW, 'UTC')),
  reorderPicks: from(PICKED, (task) => topThree.reorderPicks([ID], [task], NOW, 'UTC')),
} satisfies Record<Writer, string | (() => Promise<unknown>)>;

beforeEach(async () => {
  await Promise.all(getDb().tables.map((table) => table.clear()));
});

describe('no writer hides a task', () => {
  it('starts from a task the matrix shows', () => {
    expect(keepValidTaskRecords([atEveryLimit()])).toHaveLength(1);
  });

  const acts = Object.entries(WRITERS).filter((entry): entry is [string, () => Promise<unknown>] => typeof entry[1] === 'function');

  it.each(acts)('%s', async (_name, act) => {
    // Refusing at a limit is a right answer. Writing past it isn't.
    await act().catch(() => undefined);

    const rows = await getDb().tasks.toArray();
    expect(keepValidTaskRecords(rows).map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });

  it('says why a timer will not start on a full task', async () => {
    await getDb().tasks.put(atEveryLimit());

    const error = await tasks.startTimeTracking(ID).catch((caught: unknown) => caught);

    expect(taskValidationMessage(error)).toBe('A task can have up to 1000 timer sessions.');
  });
});
