import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { entryShown, nextReminder, sweepCards, type SweepReminder } from "@/lib/weekly-sweep";
import type { TaskRecord } from "@/lib/types";
import { createMockTask } from "@/tests/fixtures";

/**
 * Runs the shared cross-platform weekly sweep corpus (tasks/spec-weekly-sweep.md,
 * decision D-14). iOS and Android keep byte-identical copies and run every case.
 * The corpus is frozen: change the spec and all three repos together.
 */

interface CorpusTask {
  id: string;
  urgent?: boolean;
  important?: boolean;
  completed?: boolean;
  savedAt?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  location?: string;
}

type CorpusCase =
  | { name: string; op: "cards"; zone: string; now: string; windowDays: number | null; tasks: CorpusTask[]; expect: { cards: { id: string; reason: string }[] } }
  | { name: string; op: "entryShown"; zone: string; now: string; lastSweptAt: string | null; cardCount: number; expect: { shown: boolean } }
  | { name: string; op: "nextReminder"; zone: string; now: string; reminder: SweepReminder; expect: { fire: string | null } };

const corpus: { version: number; cases: CorpusCase[] } = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/cross-platform/sweep-corpus.json"), "utf8")
);

const DEFAULT_STAMP = "2026-11-07T00:00:00.000Z";

/** A task field left out takes the model's default, as the corpus note says. */
function toTask(t: CorpusTask): TaskRecord {
  const { savedAt, dueDate, location: _location, ...rest } = t;
  return createMockTask({
    title: t.id,
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    createdAt: DEFAULT_STAMP,
    updatedAt: DEFAULT_STAMP,
    ...rest,
    ...(savedAt ? { savedAt } : {}),
    ...(dueDate ? { dueDate } : {}),
  });
}

describe("cross-platform weekly sweep corpus", () => {
  it("has the full version 1 corpus", () => {
    expect(corpus.version).toBe(1);
    expect(corpus.cases).toHaveLength(74);
  });

  for (const c of corpus.cases) {
    it(c.name, () => {
      const now = new Date(c.now);
      if (c.op === "cards") {
        // Archived and trashed rows live in their own stores, so the rule never sees them.
        const active = c.tasks.filter((t) => (t.location ?? "active") === "active").map(toTask);
        expect({ cards: sweepCards(active, now, c.windowDays, c.zone) }).toEqual(c.expect);
      } else if (c.op === "entryShown") {
        const last = c.lastSweptAt ? new Date(c.lastSweptAt) : null;
        expect({ shown: entryShown(last, c.cardCount, now, c.zone) }).toEqual(c.expect);
      } else {
        const fire = nextReminder(c.reminder, now, c.zone);
        expect({ fire: fire ? fire.toISOString() : null }).toEqual(c.expect);
      }
    });
  }
});
