import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getStreakData } from "@/lib/analytics/streaks";
import { calculateMetrics, getQuadrantPerformance } from "@/lib/analytics/metrics";
import type { TaskRecord } from "@/lib/types";

/**
 * Pins the web copy of the completion metrics and streaks to a fixture the MCP
 * suite also reads (packages/mcp-server/src/__tests__/pinned-copies/
 * completion-metrics.test.ts). A scenario tagged "[encodes §7 defect]" pins
 * today's behavior on purpose: when Phase 3 fixes that defect, update the
 * scenario from its encodesDefect note in the same change.
 */

type Copy = "web" | "mcp";

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
  webOnly: { last7Days: boolean[] };
}

interface MetricsFixture {
  taskDefaults: Record<string, unknown>;
  scenarios: Scenario[];
}

const fixture: MetricsFixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/pinned-copies/completion-metrics.json"), "utf8")
);

const scenarios = fixture.scenarios.map((s) => ({
  ...s,
  title: s.encodesDefect ? `${s.name} [encodes §7 defect]` : s.name,
}));

/** The agreed values plus this copy's side of each divergence. */
function expectedFor(s: Scenario, copy: Copy): Expected {
  const out = structuredClone(s.expected);
  for (const divergence of s.divergences ?? []) {
    const [group, field] = divergence.path.split(".") as ["streak" | "metrics", string];
    if (copy in divergence) out[group][field] = divergence[copy];
  }
  return out;
}

function tasksFor(s: Scenario): TaskRecord[] {
  return s.tasks.map((t) => ({ ...fixture.taskDefaults, ...t })) as unknown as TaskRecord[];
}

const originalTimezone = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("pinned copy: completion metrics and streaks (web)", () => {
  it.each(scenarios)("$title", (s) => {
    process.env.TZ = s.timezone;
    vi.setSystemTime(new Date(s.now));
    const tasks = tasksFor(s);
    const expected = expectedFor(s, "web");

    const { last7Days, ...streak } = getStreakData(tasks);

    expect(streak).toEqual(expected.streak);
    expect(last7Days).toEqual(s.webOnly.last7Days);
    expect(calculateMetrics(tasks)).toEqual(expected.metrics);
    expect(getQuadrantPerformance(tasks)).toEqual(expected.quadrantPerformance);
  });
});
