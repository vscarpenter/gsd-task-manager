import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateEscalation, type EscalationResult } from "@/lib/escalation";

/**
 * Runs the shared cross-platform escalation corpus. Byte-identical copies live in the
 * iOS and Android repos and every suite executes every case, so the three
 * implementations cannot drift apart unnoticed. The corpus is frozen: if a case looks
 * wrong, change the spec (tasks/spec-escalation.md) and all three repos together.
 */

interface CorpusCase {
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
    recurrence?: string;
    snoozedUntil?: string | null;
  };
  expect: EscalationResult;
}

const corpus: { version: number; cases: CorpusCase[] } = JSON.parse(
  readFileSync(
    join(process.cwd(), "tests/fixtures/cross-platform/escalation-corpus.json"),
    "utf8"
  )
);

describe("cross-platform escalation corpus", () => {
  it("has the full version 1 corpus", () => {
    expect(corpus.version).toBe(1);
    expect(corpus.cases).toHaveLength(38);
  });

  for (const c of corpus.cases) {
    it(c.name, () => {
      const { savedAt, dueDate, snoozedUntil, ...rest } = c.task;
      const task = {
        ...rest,
        ...(savedAt ? { savedAt } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(snoozedUntil ? { snoozedUntil } : {}),
      };
      expect(evaluateEscalation(task, new Date(c.now), c.windowDays, c.zone)).toEqual(
        c.expect
      );
    });
  }
});
