import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RULE = 'gsd-sync/claimed-task-writes';
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === RULE });
});

async function findings(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((message) => message.ruleId === RULE).map((message) => message.message);
}

describe('the claimed task write lint', () => {
  // The three sends as they stood in pb-push.ts when they could lose a restored task.
  it.each([
    ['the delete', "export const write = (pb: any, id: string) => pb.send(`/api/gsd/tasks/${id}`, { method: 'DELETE' });"],
    ['the update', "export const write = (pb: any) => pb.send('/api/gsd/tasks/rec', { method: 'PATCH' });"],
    ['the create', "export const write = (pb: any, data: object) => pb.collection('tasks').create(data);"],
    ['a write through a variable', "export const write = (pb: any) => { const tasks = pb.collection('tasks'); return tasks.delete('rec'); };"],
  ])('rejects %s outside queued-write.ts, and names the fix', async (_name, code) => {
    const [message] = await findings(code, 'lib/sync/new-writer.ts');

    expect(message).toContain('claimQueuedWrite(kind, queueId, ownerId)');
  });

  it('allows a read', async () => {
    const code = "export const read = (pb: any) => { const tasks = pb.collection('tasks'); return tasks.getList(1, 50); };";

    expect(await findings(code, 'lib/sync/new-reader.ts')).toEqual([]);
  });

  it('allows the send inside queued-write.ts', async () => {
    const code = "export const write = (pb: any) => pb.send('/api/gsd/tasks/rec');";

    expect(await findings(code, 'lib/sync/queued-write.ts')).toEqual([]);
  });
});
