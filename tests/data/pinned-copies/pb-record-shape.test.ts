import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RecordModel } from "pocketbase";
import { pocketBaseToTaskRecord, taskRecordToPocketBase } from "@/lib/sync/task-mapper";
import type { TaskRecord } from "@/lib/types";

/**
 * Pins the web copy of the task <-> PocketBase record mapping to a fixture the
 * MCP suite also reads (packages/mcp-server/src/__tests__/pinned-copies/
 * pb-record-shape.test.ts). Fields the copies agree on live once in the
 * fixture, so a mapping changed in one copy alone turns one suite red. Today's
 * differences are pinned as divergences, not fixed here.
 */

// The mapper logs every record it skips; keep that out of the test output.
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

type Copy = "web" | "mcp";

interface Divergence {
  web?: unknown;
  mcp?: unknown;
  note: string;
}

interface MappingCase {
  name: string;
  expected: Record<string, unknown>;
  divergences?: Record<string, Divergence>;
}

interface ToRecordCase extends MappingCase {
  task: Record<string, unknown>;
}

interface FromRecordCase extends MappingCase {
  record: Record<string, unknown>;
  rejects?: Partial<Record<Copy, string>>;
}

interface RecordShapeFixture {
  ownerId: string;
  deviceId: string;
  now: string;
  wireFields: string[];
  toRecord: ToRecordCase[];
  fromRecord: FromRecordCase[];
}

const fixture: RecordShapeFixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/pinned-copies/pb-record-shape.json"), "utf8")
);

/** The agreed values plus this copy's side of each divergence. */
function expectedFor(c: MappingCase, copy: Copy): Record<string, unknown> {
  const out = { ...c.expected };
  for (const [field, divergence] of Object.entries(c.divergences ?? {})) {
    if (copy in divergence) out[field] = divergence[copy];
  }
  return out;
}

describe("pinned copy: PocketBase record shape (web)", () => {
  describe("task to record", () => {
    it.each(fixture.toRecord)("$name", (c) => {
      const task = c.task as unknown as TaskRecord;
      const record = taskRecordToPocketBase(task, fixture.ownerId, fixture.deviceId);

      expect(Object.keys(record).sort()).toEqual([...fixture.wireFields].sort());
      expect(record).toStrictEqual(expectedFor(c, "web"));
    });
  });

  describe("record to task", () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(fixture.now));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(fixture.fromRecord)("$name", (c) => {
      const task = pocketBaseToTaskRecord(c.record as unknown as RecordModel);
      const expected = c.rejects?.web ? null : expectedFor(c, "web");

      expect(task).toEqual(expected);
    });
  });

  it("never lists a divergent field among the agreed values", () => {
    const cases: MappingCase[] = [...fixture.toRecord, ...fixture.fromRecord];
    for (const c of cases) {
      const overlap = Object.keys(c.divergences ?? {}).filter((field) => field in c.expected);
      expect(overlap, c.name).toEqual([]);
    }
  });
});
