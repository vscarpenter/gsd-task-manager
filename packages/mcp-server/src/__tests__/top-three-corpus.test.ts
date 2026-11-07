import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { evaluateEscalation, suggestTopThree, todaysPicks, type TopThreeTask } from '../top-three.js';

/**
 * Pins this package's copy of the top three and escalation rules to the shared
 * corpora, as the capture parser copy is pinned. MCP implements only the ops it
 * serves: picks, suggest, and the escalation rule suggest reads.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readCorpus = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(REPO_ROOT, 'tests/fixtures/cross-platform', name), 'utf8')) as T;

interface CorpusTask {
  id: string;
  urgent?: boolean;
  important?: boolean;
  completed?: boolean;
  savedAt?: string | null;
  dueDate?: string | null;
  focusDate?: string | null;
  focusRank?: number | null;
  createdAt?: string;
  updatedAt?: string;
  location?: 'active' | 'archived' | 'trashed';
}

interface TopThreeCase {
  name: string;
  op: string;
  zone?: string;
  now?: string;
  windowDays?: number | null;
  tasks?: CorpusTask[];
  expect: Record<string, unknown>;
}

const STAMP = '2026-10-01T00:00:00.000Z';

function activeTasks(rows: CorpusTask[] = []): TopThreeTask[] {
  return rows
    .filter((row) => (row.location ?? 'active') === 'active')
    .map(({ savedAt, dueDate, focusDate, focusRank, location: _location, ...rest }) => ({
      urgent: false,
      important: false,
      completed: false,
      createdAt: STAMP,
      updatedAt: STAMP,
      ...rest,
      ...(savedAt ? { savedAt } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(focusDate ? { focusDate } : {}),
      ...(focusRank ? { focusRank } : {}),
    }));
}

const topThree = readCorpus<{ version: number; cases: TopThreeCase[] }>('top-three-corpus.json');
const served = topThree.cases.filter((c) => c.op === 'picks' || c.op === 'suggest');

describe('top three corpus, MCP copy', () => {
  it('runs every picks and suggest case', () => {
    expect(topThree.version).toBe(1);
    expect(served).toHaveLength(54);
  });

  for (const c of served) {
    it(`${c.op}: ${c.name}`, () => {
      const tasks = activeTasks(c.tasks);
      const now = new Date(c.now ?? STAMP);
      const zone = c.zone ?? 'UTC';
      const actual =
        c.op === 'picks'
          ? todaysPicks(tasks, now, zone)
          : { ids: suggestTopThree(tasks, now, c.windowDays ?? null, zone) };
      expect(actual).toEqual(c.expect);
    });
  }
});

interface EscalationCase {
  name: string;
  zone: string;
  now: string;
  windowDays: number | null;
  task: {
    urgent: boolean;
    important: boolean;
    completed: boolean;
    savedAt: string | null;
    dueDate: string | null;
  };
  expect: unknown;
}

const escalation = readCorpus<{ cases: EscalationCase[] }>('escalation-corpus.json');

describe('escalation corpus, MCP copy', () => {
  it('has the full corpus', () => {
    expect(escalation.cases).toHaveLength(38);
  });

  for (const c of escalation.cases) {
    it(c.name, () => {
      const { savedAt, dueDate, ...rest } = c.task;
      const task = { ...rest, ...(savedAt ? { savedAt } : {}), ...(dueDate ? { dueDate } : {}) };
      expect(evaluateEscalation(task, new Date(c.now), c.windowDays, c.zone)).toEqual(c.expect);
    });
  }
});
