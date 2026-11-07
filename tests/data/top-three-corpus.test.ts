import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  carryOver,
  fromWire,
  nextRank,
  pullMerge,
  pushFocus,
  suggest,
  tidy,
  todaysPicks,
  toWire,
  type TopThreeTask,
} from "@/lib/top-three";

/**
 * Runs the shared cross-platform top three corpus (spec: tasks/spec-top-three.md).
 * Byte-identical copies live in the iOS and Android repos and every suite executes
 * every case. The corpus is frozen: if a case looks wrong, change the spec and all
 * three repos together.
 */

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
  location?: "active" | "archived" | "trashed";
}

interface CorpusCase {
  name: string;
  op: string;
  zone?: string;
  now?: string;
  windowDays?: number | null;
  tasks?: CorpusTask[];
  wire?: Parameters<typeof fromWire>[0];
  task?: { focusDate: string | null; focusRank: number | null };
  payload?: unknown;
  current?: { focusDate: string | null; focusRank: number | null } | null;
  storedContract?: number | null;
  tombstoned?: boolean;
  local?: Parameters<typeof pullMerge>[0]["local"];
  remote?: Parameters<typeof pullMerge>[0]["remote"];
  expect: unknown;
}

const corpus: { version: number; cases: CorpusCase[] } = JSON.parse(
  readFileSync(
    join(process.cwd(), "tests/fixtures/cross-platform/top-three-corpus.json"),
    "utf8"
  )
);

const DEFAULT_STAMP = "2026-10-01T00:00:00.000Z";

/** Applies the corpus defaults, and keeps only active rows as the real stores do. */
function activeTasks(rows: CorpusTask[] = []): TopThreeTask[] {
  return rows
    .filter((row) => (row.location ?? "active") === "active")
    .map(({ savedAt, dueDate, focusDate, focusRank, location: _location, ...rest }) => ({
      urgent: false,
      important: false,
      completed: false,
      createdAt: DEFAULT_STAMP,
      updatedAt: DEFAULT_STAMP,
      ...rest,
      ...(savedAt ? { savedAt } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(focusDate ? { focusDate } : {}),
      ...(focusRank ? { focusRank } : {}),
    }));
}

function run(c: CorpusCase): unknown {
  const tasks = activeTasks(c.tasks);
  const now = new Date(c.now ?? DEFAULT_STAMP);
  const zone = c.zone ?? "UTC";
  switch (c.op) {
    case "picks":
      return todaysPicks(tasks, now, zone);
    case "nextRank":
      return { rank: nextRank(tasks, now, zone) };
    case "tidy":
      return { writes: tidy(tasks, now, zone) };
    case "suggest":
      return { ids: suggest(tasks, now, c.windowDays ?? null, zone) };
    case "carryOver":
      return carryOver(tasks, now, zone);
    case "fromWire":
      return fromWire(c.wire!);
    case "toWire":
      return toWire(c.task!);
    case "pushFocus":
      return pushFocus(c.current ?? null);
    case "pullMerge":
      return pullMerge({
        storedContract: c.storedContract ?? null,
        tombstoned: c.tombstoned ?? false,
        local: c.local ?? null,
        remote: c.remote!,
      });
    default:
      throw new Error(`Unknown corpus op: ${c.op}`);
  }
}

describe("cross-platform top three corpus", () => {
  it("has the full version 1 corpus", () => {
    expect(corpus.version).toBe(1);
    expect(corpus.cases).toHaveLength(123);
  });

  for (const c of corpus.cases) {
    it(`${c.op}: ${c.name}`, () => {
      expect(run(c)).toEqual(c.expect);
    });
  }
});
