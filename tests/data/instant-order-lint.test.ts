/** Each rejected case is the shape of a bug this repo shipped. */
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import { INSTANT_FIELDS } from '../../config/eslint/instant-order.mjs';

const RULE = 'gsd-time/instant-order';
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === RULE });
});

async function findings(code: string, filePath = 'lib/new-reader.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((message) => message.ruleId === RULE).map((message) => message.message);
}

describe('the instant order lint', () => {
  it.each([
    ['a cutoff as text (#579, the Trash purge)', `
      export const purge = (rows, cutoff) => rows.filter((task) => task.deletedAt < cutoff);`],
    ['a due date against a day as text (#714, overdue)', `
      export const overdue = (task, todayIso) => Boolean(task.dueDate) && task.dueDate < todayIso;`],
    ['a cutoff as text (auto-archive)', `
      export const eligible = (task, cutoffIso) => task.completedAt < cutoffIso;`],
    ['a stamp read into a local first (the Archive page)', `
      export const newest = (a, b) => {
        const aDate = a.archivedAt || '';
        const bDate = b.archivedAt || '';
        return bDate.localeCompare(aDate);
      };`],
    ['a sort by text (the matrix)', `
      export const byDue = (a, b) => a.dueDate.localeCompare(b.dueDate);`],
    ['a text helper (top three)', `
      export const byCreated = (a, b) => compareText(a.createdAt, b.createdAt);`],
    ['a wire stamp (the pull cursor)', `
      export const later = (record, max) => record.client_updated_at > max;`],
    ['a wire stamp read by key (0360078, the engine cursor)', `
      export const later = (record, max) => {
        const stamp = record['client_updated_at'] as string;
        return stamp > max;
      };`],
  ])('rejects %s, and names the fix', async (_name, code) => {
    const messages = await findings(code);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('compareInstants(a, b)');
  });

  it('covers the MCP server too', async () => {
    const code = 'export const newer = (a, b) => a.updatedAt > b.updatedAt;';

    expect(await findings(code, 'packages/mcp-server/src/new-reader.ts')).toHaveLength(1);
  });

  it.each([
    ['epoch time', 'export const old = (task, cutoffMs) => Date.parse(task.completedAt) < cutoffMs;'],
    ['a Date', 'export const late = (task, now) => new Date(task.dueDate) < now;'],
    ['a Date in a local of the same name', `
      export const late = (task, now) => { const dueDate = new Date(task.dueDate); return dueDate < now; };`],
    ['the helper', 'export const byCreated = (a, b) => compareInstants(a.createdAt, b.createdAt);'],
    ['a calendar day, which sorts as text', 'export const day = (a, b) => a.focusDate < b.focusDate;'],
    ['a number', 'export const ready = (config, now) => now >= config.nextRetryAt;'],
  ])('allows %s', async (_name, code) => {
    expect(await findings(code)).toEqual([]);
  });

  it.each(['lib/schema.ts', 'lib/sync/task-mapper.ts'])('knows every instant field in %s', (path) => {
    const declared = readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.includes('iso.datetime'))
      .flatMap((line) => /(\w+): z\b/.exec(line)?.[1] ?? []);

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((field) => !INSTANT_FIELDS.has(field))).toEqual([]);
  });
});
