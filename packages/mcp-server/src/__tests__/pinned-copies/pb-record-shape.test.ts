import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pbTaskToTask, taskToPBFields, type PBTask, type Task } from '../../types.js';

/**
 * Pins the MCP copy of the task <-> PocketBase record mapping to a fixture the
 * root suite also reads (tests/data/pinned-copies/pb-record-shape.test.ts).
 * Fields the copies agree on live once in the fixture, so a mapping changed in
 * one copy alone turns one suite red. Today's differences are pinned as
 * divergences, not fixed here.
 */

type Copy = 'web' | 'mcp';

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
  wireFields: string[];
  toRecord: ToRecordCase[];
  fromRecord: FromRecordCase[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

const fixture: RecordShapeFixture = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'tests/fixtures/pinned-copies/pb-record-shape.json'), 'utf8')
);

/** The agreed values plus this copy's side of each divergence. */
function expectedFor(c: MappingCase, copy: Copy): Record<string, unknown> {
  const out = { ...c.expected };
  for (const [field, divergence] of Object.entries(c.divergences ?? {})) {
    if (copy in divergence) out[field] = divergence[copy];
  }
  return out;
}

describe('pinned copy: PocketBase record shape (mcp)', () => {
  describe('task to record', () => {
    it.each(fixture.toRecord)('$name', (c) => {
      const task = c.task as unknown as Task;
      const record = taskToPBFields(task, fixture.ownerId, fixture.deviceId);

      expect(Object.keys(record).sort()).toEqual([...fixture.wireFields].sort());
      expect(record).toStrictEqual(expectedFor(c, 'mcp'));
    });
  });

  describe('record to task', () => {
    it.each(fixture.fromRecord)('$name', (c) => {
      const task = pbTaskToTask(c.record as unknown as PBTask);
      const expected = c.rejects?.mcp ? null : expectedFor(c, 'mcp');

      expect(task).toEqual(expected);
    });
  });
});
