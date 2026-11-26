import { readFileSync } from 'node:fs';
import type { ClientCapabilities, ElicitRequestParams, ElicitResult } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOLS, connectClient, type ClientOptions, type Protocol } from '../helpers/protocol-clients.js';
import { editElsewhere, makeTask, seedTaskStore, taskStore } from '../helpers/task-store.js';

vi.mock('../../tools/list-tasks.js', async () => (await import('../helpers/task-store.js')).listTasksFakes);
vi.mock('../../write-ops/helpers.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...(await import('../helpers/task-store.js')).writeHelperFakes,
}));

/**
 * A permanent delete asks a person first when the client can show a form,
 * and writes nothing unless they confirm (tasks/spec.md, "Move the MCP server
 * to SDK v2", D4 and AC10 to AC17). PocketBase is the in-memory task store, so
 * each test sees every write.
 */
const FORM: ClientCapabilities = { elicitation: { form: {} } };
// A bare declaration predates elicitation modes and means form support.
const BARE: ClientCapabilities = { elicitation: {} };
const URL_ONLY: ClientCapabilities = { elicitation: { url: {} } };

const CONFIRM_SCHEMA = {
  type: 'object',
  properties: { confirm: { type: 'boolean', title: 'Delete permanently' } },
  required: ['confirm'],
};

const LONG_TITLE = 'Plan the offsite: venue, agenda, travel, budget, catering, and the follow-up notes for everyone';
const CUT_TITLE = `${LONG_TITLE.slice(0, 79)}…`;

type ToolCall = { name: string; arguments: Record<string, unknown> };
type ToolText = { content: Array<{ text: string }>; isError?: boolean };

const DELETES: Record<'single' | 'bulk', ToolCall> = {
  single: { name: 'delete_task', arguments: { id: 'alpha', dryRun: false } },
  bulk: { name: 'bulk_update_tasks', arguments: { taskIds: ['alpha', 'beta'], operation: { type: 'delete' }, dryRun: false } },
};

interface Asked {
  message: string;
  requestedSchema: unknown;
  deletesBefore: number;
}

/** A user who gives `answer`, with a record of each dialog they were shown. */
function userWhoAnswers(answer: ElicitResult): { asked: Asked[]; onElicit: ClientOptions['onElicit'] } {
  const asked: Asked[] = [];
  const onElicit = async (params: ElicitRequestParams): Promise<ElicitResult> => {
    const requestedSchema = 'requestedSchema' in params ? params.requestedSchema : undefined;
    asked.push({ message: params.message, requestedSchema, deletesBefore: taskStore.deleted.length });
    return answer;
  };
  return { asked, onElicit };
}

async function callAs(protocol: Protocol, options: ClientOptions, call: ToolCall): Promise<ToolText> {
  const { client, close } = await connectClient(protocol, undefined, options);
  try {
    return (await client.callTool({ name: call.name, arguments: { ...call.arguments } })) as ToolText;
  } finally {
    await close();
  }
}

const DECLINE: ElicitResult = { action: 'decline' };
const CONFIRM: ElicitResult = { action: 'accept', content: { confirm: true } };
const EDITED_AT = '2026-11-02T09:30:00.000Z';

function seedTasks(): void {
  seedTaskStore([
    makeTask('alpha', { title: LONG_TITLE }),
    makeTask('beta', { title: 'Book flights' }),
    makeTask('gamma', { title: 'Send the agenda', dependencies: ['alpha'] }),
  ]);
}

beforeEach(seedTasks);

/** A user who confirms, after `beforeAnswer` runs while the dialog is open. */
function userWhoConfirmsAfter(beforeAnswer: () => void): ClientOptions['onElicit'] {
  return async () => {
    beforeAnswer();
    return CONFIRM;
  };
}

/** Today's reply to the same delete from a client that can't ask, on a fresh store. */
async function textWithoutConfirmation(protocol: Protocol, call: ToolCall): Promise<string> {
  const result = await callAs(protocol, {}, call);
  seedTasks();
  return result.content[0].text;
}

describe.each(PROTOCOLS)('delete confirmation on %s', (protocol) => {
  it.each([['form', FORM], ['bare', BARE]] as const)(
    'should_request_confirmation_before_any_write_when_client_supports_form_elicitation (%s)',
    async (_declared, capabilities) => {
      for (const call of Object.values(DELETES)) {
        const user = userWhoAnswers(DECLINE);

        await callAs(protocol, { capabilities, onElicit: user.onElicit }, call);

        const shown = user.asked.map(({ requestedSchema, deletesBefore }) => ({ requestedSchema, deletesBefore }));
        expect({ tool: call.name, shown }).toEqual({
          tool: call.name,
          shown: [{ requestedSchema: CONFIRM_SCHEMA, deletesBefore: 0 }],
        });
      }
    }
  );

  it('should_name_titles_dependents_and_permanence_in_the_confirmation', async () => {
    const single = userWhoAnswers(DECLINE);
    const bulk = userWhoAnswers(DECLINE);

    await callAs(protocol, { capabilities: FORM, onElicit: single.onElicit }, DELETES.single);
    await callAs(protocol, { capabilities: FORM, onElicit: bulk.onElicit }, DELETES.bulk);

    const describe = (message = '') => ({
      titles: [CUT_TITLE, 'Book flights'].filter((title) => message.includes(title)),
      fullTitleShown: message.includes(LONG_TITLE),
      oneDependent: /\b1 other task depends on/.test(message),
      permanent: /can't be undone/.test(message) && /30-day Trash/.test(message),
    });
    expect([describe(single.asked[0]?.message), describe(bulk.asked[0]?.message)]).toEqual([
      { titles: [CUT_TITLE], fullTitleShown: false, oneDependent: true, permanent: true },
      { titles: [CUT_TITLE, 'Book flights'], fullTitleShown: false, oneDependent: true, permanent: true },
    ]);
  });

  it.each([
    ['should_not_delete_when_user_declines', DECLINE],
    ['should_not_delete_when_user_cancels', { action: 'cancel' }],
    ['should_not_delete_when_confirm_is_false', { action: 'accept', content: { confirm: false } }],
  ] as const)('%s', async (_name, answer) => {
    for (const call of Object.values(DELETES)) {
      const user = userWhoAnswers(answer);

      const result = await callAs(protocol, { capabilities: FORM, onElicit: user.onElicit }, call);

      expect({
        tool: call.name,
        isError: result.isError ?? false,
        notDeleted: result.content[0].text.startsWith('Not deleted:'),
        timesAsked: user.asked.length,
        deleted: taskStore.deleted,
      }).toEqual({ tool: call.name, isError: false, notDeleted: true, timesAsked: 1, deleted: [] });
    }
  });

  it.each([['no elicitation', undefined], ['URL elicitation only', URL_ONLY]] as const)(
    'should_delete_without_confirmation_when_client_lacks_elicitation (%s)',
    async (_declared, capabilities) => {
      const user = userWhoAnswers(DECLINE);
      const options = { capabilities, ...(capabilities && { onElicit: user.onElicit }) };

      const single = await callAs(protocol, options, DELETES.single);
      const bulk = await callAs(protocol, options, { ...DELETES.bulk, arguments: { ...DELETES.bulk.arguments, taskIds: ['beta'] } });

      expect({
        single: single.content[0].text.split('\n')[0],
        bulk: bulk.content[0].text.split('\n')[0],
        deleted: taskStore.deleted,
        timesAsked: user.asked.length,
      }).toEqual({
        single: '✅ Task deleted successfully!',
        bulk: '✅ Bulk operation completed!',
        deleted: ['alpha', 'beta'],
        timesAsked: 0,
      });
    }
  );

  it('should_preview_without_confirmation_when_dry_run_is_omitted', async () => {
    const user = userWhoAnswers(DECLINE);
    const previews: ToolCall[] = [
      { name: 'delete_task', arguments: { id: 'alpha' } },
      { name: 'delete_task', arguments: { id: 'alpha', dryRun: true } },
      { name: 'bulk_update_tasks', arguments: { taskIds: ['alpha', 'beta'], operation: { type: 'delete' } } },
    ];

    const headlines: string[] = [];
    for (const call of previews) {
      const result = await callAs(protocol, { capabilities: FORM, onElicit: user.onElicit }, call);
      headlines.push(result.content[0].text.split(' - ')[0]);
    }

    expect({ headlines, timesAsked: user.asked.length, deleted: taskStore.deleted }).toEqual({
      headlines: ['🔍 DRY RUN', '🔍 DRY RUN', '🔍 DRY RUN'],
      timesAsked: 0,
      deleted: [],
    });
  });

  it('should_keep_delete_tool_input_schemas_unchanged', async () => {
    const pinned: { tools: Array<{ name: string; inputSchema: unknown }> } = JSON.parse(
      readFileSync(new URL('../fixtures/wire-contract-v1.5.0.json', import.meta.url), 'utf8')
    );
    const { client, close } = await connectClient(protocol);
    try {
      const { tools } = await client.listTools();

      const schemaOf = (list: Array<{ name: string; inputSchema: unknown }>, name: string) =>
        JSON.parse(JSON.stringify(list.find((tool) => tool.name === name)?.inputSchema ?? null));
      const names = ['delete_task', 'bulk_update_tasks'];
      expect(names.map((name) => schemaOf(tools, name))).toEqual(names.map((name) => schemaOf(pinned.tools, name)));
    } finally {
      await close();
    }
  });
});

describe.each(PROTOCOLS)('confirmed deletes on %s', (protocol) => {
  it('should_delete_and_clean_dependencies_when_user_confirms_unchanged_task', async () => {
    for (const call of Object.values(DELETES)) {
      const expected = await textWithoutConfirmation(protocol, call);
      const user = userWhoAnswers(CONFIRM);

      const result = await callAs(protocol, { capabilities: FORM, onElicit: user.onElicit }, call);

      expect({
        tool: call.name,
        text: result.content[0].text,
        deleted: [...taskStore.deleted].sort(),
        cleaned: taskStore.dependencyWrites,
        timesAsked: user.asked.length,
      }).toEqual({
        tool: call.name,
        text: expected,
        deleted: call.name === 'delete_task' ? ['alpha'] : ['alpha', 'beta'],
        cleaned: ['gamma'],
        timesAsked: 1,
      });
      seedTasks();
    }
  });

  it('should_not_delete_task_changed_after_confirmation', async () => {
    const onElicit = userWhoConfirmsAfter(() => editElsewhere('alpha', EDITED_AT));

    const result = await callAs(protocol, { capabilities: FORM, onElicit }, DELETES.single);

    const text = result.content[0].text;
    expect({
      isError: result.isError ?? false,
      notDeleted: text.startsWith('Not deleted:'),
      namesTask: text.includes('alpha'),
      deleted: taskStore.deleted,
    }).toEqual({ isError: false, notDeleted: true, namesTask: true, deleted: [] });
  });

  it('should_report_changed_task_as_conflict_and_delete_the_rest_in_bulk', async () => {
    const onElicit = userWhoConfirmsAfter(() => editElsewhere('beta', EDITED_AT));

    const result = await callAs(protocol, { capabilities: FORM, onElicit }, DELETES.bulk);

    const text = result.content[0].text;
    expect({
      conflict: /Conflicts \(1 skipped[^\n]*\n1\. beta /.test(text),
      deleted: taskStore.deleted,
      survivor: taskStore.tasks.has('beta'),
    }).toEqual({ conflict: true, deleted: ['alpha'], survivor: true });
  });
});

describe.each(PROTOCOLS)('an empty preview on %s', (protocol) => {
  it('should_keep_a_task_that_appears_after_an_empty_preview', async () => {
    // The preview finds nothing, so nobody is asked; a task that syncs in
    // before the delete's own read was never confirmed.
    taskStore.afterNextListRead = () => {
      taskStore.tasks.set('delta', makeTask('delta', { title: 'Synced late' }));
    };
    const user = userWhoAnswers(CONFIRM);
    const call = { name: 'bulk_update_tasks', arguments: { taskIds: ['delta'], operation: { type: 'delete' }, dryRun: false } };

    await callAs(protocol, { capabilities: FORM, onElicit: user.onElicit }, call);

    expect({ deleted: taskStore.deleted, kept: taskStore.tasks.has('delta'), timesAsked: user.asked.length }).toEqual({
      deleted: [],
      kept: true,
      timesAsked: 0,
    });
  });
});

type JsonRpc = Record<string, unknown> & { method?: string; params?: Record<string, unknown> };

/** Rewrites the requestState a retried tools/call carries back to the server. */
function retryWithState(change: (state: string) => string | undefined): ClientOptions['rewriteRequest'] {
  return (message: JsonRpc) => {
    const state = message.params?.requestState;
    if (message.method !== 'tools/call' || typeof state !== 'string') return message;
    const { requestState: _dropped, ...params } = message.params ?? {};
    const changed = change(state);
    return { ...message, params: changed === undefined ? params : { ...params, requestState: changed } };
  };
}

// On 2025-11-25 the SDK's shim keeps the request state on the server between
// rounds, so only a 2026-07-28 client holds state it could alter or drop.
describe('request state on 2026-07-28', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function confirmWith(options: ClientOptions): Promise<{ outcome: unknown; deleted: string[]; listReads: number }> {
    const call = callAs('2026-07-28', { capabilities: FORM, onElicit: async () => CONFIRM, ...options }, DELETES.single);
    const outcome = await call.then(
      (result) => result.content[0].text,
      (error: Error) => `refused: ${error.message}`
    );
    return { outcome, deleted: taskStore.deleted, listReads: taskStore.listReads };
  }

  it('should_refuse_tampered_request_state_before_the_handler_runs', async () => {
    // A client's edit to what was confirmed: point alpha's stamp at a newer
    // version and keep the old signature. The SDK's state is
    // "v1.<base64url JSON with the payload in p>.<base64url MAC>".
    const forgeStamp = (state: string) => {
      const [version, body, mac] = state.split('.');
      const sealed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      sealed.p.stamps.alpha = EDITED_AT;
      return [version, Buffer.from(JSON.stringify(sealed)).toString('base64url'), mac].join('.');
    };

    const run = await confirmWith({ rewriteRequest: retryWithState(forgeStamp) });

    expect({ ...run, outcome: /^refused: .*requestState/i.test(String(run.outcome)) }).toEqual({
      outcome: true,
      deleted: [],
      listReads: 1,
    });
  });

  it('should_refuse_expired_request_state_before_the_handler_runs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const elevenMinutes = 11 * 60 * 1000;
    const onElicit = userWhoConfirmsAfter(() => vi.setSystemTime(Date.now() + elevenMinutes));

    const run = await confirmWith({ onElicit });

    expect({ ...run, outcome: /^refused: .*requestState/i.test(String(run.outcome)) }).toEqual({
      outcome: true,
      deleted: [],
      listReads: 1,
    });
  });

  it('should_not_delete_a_task_the_confirmation_did_not_cover', async () => {
    // The retry keeps the state minted for alpha but asks to delete beta.
    const swapTask = (message: JsonRpc) =>
      message.method === 'tools/call' && message.params?.requestState !== undefined
        ? { ...message, params: { ...message.params, arguments: { id: 'beta', dryRun: false } } }
        : message;

    const run = await confirmWith({ rewriteRequest: swapTask });

    expect({ outcome: /^Not deleted: task beta no longer matches/.test(String(run.outcome)), deleted: run.deleted })
      .toEqual({ outcome: true, deleted: [] });
  });

  it('should_not_delete_when_a_confirmed_retry_has_no_request_state', async () => {
    const run = await confirmWith({ rewriteRequest: retryWithState(() => undefined) });

    expect({ ...run, outcome: /^Not deleted: .*couldn't be checked/.test(String(run.outcome)) }).toEqual({
      outcome: true,
      deleted: [],
      listReads: 1,
    });
  });
});
