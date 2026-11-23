/** Each rejected case is the shape of a bug this repo shipped. */
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RULE = 'gsd-db/atomic-writes';
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ ruleFilter: ({ ruleId }) => ruleId === RULE });
});

async function findings(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'lib/new-writer.ts' });
  return result.messages.filter((message) => message.ruleId === RULE).map((message) => message.message);
}

describe('the atomic write lint', () => {
  it.each([
    ['a read, then a write of that table (8ea7762)', 'modifyRow(table, key, change)', `
      export async function archive(id) {
        const task = await db.tasks.get(id);
        await db.tasks.put({ ...task, completed: true });
      }`],
    ['a whole settings row put (lost updates)', 'modifyRow(table, key, change)', `
      export async function update(changes) {
        const current = await load();
        const table = getDb().notificationSettings;
        await table.put({ ...current, ...changes });
      }`],
    ['a sync_config write from a helper read (#734)', 'modifyRow(table, key, change)', `
      export async function update(changes) {
        const current = await getSyncConfig();
        await db.syncMetadata.put({ ...current, ...changes });
      }`],
    ['a session read before the transaction (#735)', 'Move the sync_config read inside it', `
      export async function remove(id) {
        const config = await getSyncConfig();
        await db.transaction('rw', db.tasks, async () => { await finish(id, config); });
      }`],
    ['a session read one helper away (#735)', 'Move the sync_config read inside it', `
      async function dependencies() { return getSyncConfig(); }
      export async function importAll() {
        const config = await dependencies();
        await db.transaction('rw', db.tasks, async () => { await apply(config); });
      }`],
    ['a transaction one helper away from the read (#734)', 'Move the sync_config read inside it', `
      async function reset(config) {
        await db.transaction('rw', db.syncMetadata, async () => { await wipe(config); });
      }
      export async function disable() { await reset(await read()); }
      export async function signOut() {
        const config = await getSyncConfig();
        await reset(config);
      }`],
    ['a transaction scope that is not async (WEB-UNDO-SIGNED-IN)', 'async () =>', `
      export function run(mutation) {
        return db.transaction('rw', db.tasks, () => mutation());
      }`],
  ])('rejects %s, and names the fix', async (_shape, fix, code) => {
    expect((await findings(code)).join('\n')).toContain(fix);
  });

  it.each([
    ['a read and write in one transaction', `
      export async function update(id) {
        await db.transaction('rw', db.tasks, async () => { await db.tasks.put(await db.tasks.get(id)); });
      }`],
    ['a helper only a transaction calls', `
      async function move(id) { await db.tasks.put(await db.tasks.get(id)); }
      export async function run(id) {
        await db.transaction('rw', db.tasks, async () => { await move(id); });
      }`],
    ['a transaction that rechecks the session', `
      export async function sync() {
        const owner = await getSyncConfig();
        await db.transaction('rw', db.syncMetadata, async () => { await assertSyncSessionCurrent(owner); });
      }`],
  ])('allows %s', async (_shape, code) => {
    expect(await findings(code)).toEqual([]);
  });
});
