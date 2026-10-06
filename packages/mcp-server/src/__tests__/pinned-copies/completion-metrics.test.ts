import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getStreakData } from '../../analytics/streaks.js';
import { calculateMetrics, getQuadrantPerformance } from '../../analytics/metrics.js';
import type { Task } from '../../types.js';

/**
 * Pins the MCP copy of the completion metrics and streaks to a fixture the
 * root suite also reads (tests/data/pinned-copies/completion-metrics.test.ts).
 * A scenario tagged "[encodes §7 defect]" pins today's behavior on purpose:
 * when Phase 3 fixes that defect, update the scenario from its encodesDefect
 * note in the same change.
 */

type Copy = 'web' | 'mcp';

interface Expected {
  streak: Record<string, unknown>;
  metrics: Record<string, unknown>;
  quadrantPerformance: Array<Record<string, unknown>>;
}

interface Divergence {
  path: string;
  web?: unknown;
  mcp?: unknown;
  note: string;
}

interface Scenario {
  name: string;
  timezone: string;
  now: string;
  encodesDefect?: string;
  tasks: Array<Record<string, unknown>>;
  expected: Expected;
  divergences?: Divergence[];
}

interface MetricsFixture {
  taskDefaults: Record<string, unknown>;
  scenarios: Scenario[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

const fixture: MetricsFixture = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'tests/fixtures/pinned-copies/completion-metrics.json'), 'utf8')
);

const scenarios = fixture.scenarios.map((s) => ({
  ...s,
  title: s.encodesDefect ? `${s.name} [encodes §7 defect]` : s.name,
}));

/** The agreed values plus this copy's side of each divergence. */
function expectedFor(s: Scenario, copy: Copy): Expected {
  const out = structuredClone(s.expected);
  for (const divergence of s.divergences ?? []) {
    const [group, field] = divergence.path.split('.') as ['streak' | 'metrics', string];
    if (copy in divergence) out[group][field] = divergence[copy];
  }
  return out;
}

function tasksFor(s: Scenario): Task[] {
  return s.tasks.map((t) => ({ ...fixture.taskDefaults, ...t })) as unknown as Task[];
}

const originalTimezone = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe('pinned copy: completion metrics and streaks (mcp)', () => {
  it.each(scenarios)('$title', (s) => {
    process.env.TZ = s.timezone;
    vi.setSystemTime(new Date(s.now));
    const tasks = tasksFor(s);
    const expected = expectedFor(s, 'mcp');

    // The MCP copy adds name and activeTasks; only the shared fields are pinned.
    const performance = getQuadrantPerformance(tasks).map(
      ({ quadrantId, completionRate, totalTasks, completedTasks }) => ({
        quadrantId,
        completionRate,
        totalTasks,
        completedTasks,
      })
    );

    expect(getStreakData(tasks)).toEqual(expected.streak);
    expect(calculateMetrics(tasks)).toEqual(expected.metrics);
    expect(performance).toEqual(expected.quadrantPerformance);
  });
});
