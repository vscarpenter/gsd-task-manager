import { randomBytes } from 'node:crypto';
import {
  CLIENT_CAPABILITIES_META_KEY,
  acceptedContent,
  createRequestStateCodec,
  inputRequired,
  type ClientCapabilities,
  type ElicitRequestFormParams,
  type InputRequiredResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ConflictError } from '../../errors.js';
import { bulkUpdateTasks, deleteTask } from '../../write-ops.js';
import type { DeletionPreview } from '../../write-ops/types.js';
import type { GsdConfig } from '../../tools.js';
import type { ToolArgs } from './input-schemas.js';
import type { McpToolResponse, ToolCallResult } from './types.js';
import { handleBulkUpdateTasks, handleDeleteTask } from './write-handlers.js';

/**
 * Asks a person before a permanent delete when the client can show a form,
 * and deletes only what they confirmed (tasks/spec.md, "Move the MCP server to
 * SDK v2", D4 and D5). A client that can't ask keeps the v1.5.0 flow.
 */
const CONFIRM_DELETE_KEY = 'confirm-delete';
const TITLE_LIMIT = 80;
const STATE_KEY_BYTES = 32;
const STATE_TTL_SECONDS = 600;

/** What the round that asks hands the retried round, signed so the client can't change it. */
interface ConfirmationState {
  v: 1;
  tool: string;
  /** Each task's updatedAt when the person was asked. */
  stamps: Record<string, string>;
}

// One key per process is enough: every round of a stdio flow returns to the
// process that asked. The bind covers the method; bind can't see the tool
// name, so the handler checks the payload's `tool` instead.
const stateCodec = createRequestStateCodec<ConfirmationState>({
  key: randomBytes(STATE_KEY_BYTES),
  ttlSeconds: STATE_TTL_SECONDS,
  bind: (ctx) => ctx.mcpReq.method,
});

/** The server's `requestState` option: a tampered or expired state is refused before any handler runs. */
export const DELETE_CONFIRMATION_STATE = {
  verify: (state: string, ctx: ServerContext) => stateCodec.verify(state, ctx),
};

const CONFIRM_SCHEMA: ElicitRequestFormParams['requestedSchema'] = {
  type: 'object',
  properties: { confirm: { type: 'boolean', title: 'Delete permanently' } },
  required: ['confirm'],
};
const CONFIRM_ANSWER = z.strictObject({ confirm: z.boolean() });

function notDeleted(reason: string): McpToolResponse {
  return { content: [{ type: 'text', text: `Not deleted: ${reason}` }] };
}

const NOT_CONFIRMED = notDeleted(
  "the user didn't confirm, so nothing changed. Don't ask again unless they bring it up."
);
const NOT_CHECKED = notDeleted(
  "the confirmation couldn't be checked, so nothing changed. Preview the delete again if the user still wants it."
);

export interface DeleteConfirmation {
  /** Seals the state for the round that asks. Absent when the client can't show a form. */
  readonly mintState?: (state: ConfirmationState) => Promise<string>;
  /** The person's answer, on the retried call only. */
  readonly answer?: 'confirmed' | 'not-confirmed';
  /** The state minted when they were asked, as the SDK verified it. */
  readonly state?: ConfirmationState;
}

/** No one to ask, so deletes keep the v1.5.0 flow. */
export const NO_CONFIRMATION: DeleteConfirmation = {};

// A bare `elicitation: {}` predates elicitation modes and means form support.
function supportsForm(capabilities: ClientCapabilities | undefined): boolean {
  const elicitation = capabilities?.elicitation;
  if (!elicitation) return false;
  return elicitation.form !== undefined || elicitation.url === undefined;
}

// The answer arrives from the client unchecked; anything but an accepted
// `confirm: true` counts as no.
function answerOf(responses: Record<string, unknown> | undefined): DeleteConfirmation['answer'] {
  if (responses?.[CONFIRM_DELETE_KEY] === undefined) return undefined;
  const content = acceptedContent(responses, CONFIRM_DELETE_KEY, CONFIRM_ANSWER);
  return content?.confirm === true ? 'confirmed' : 'not-confirmed';
}

/**
 * On 2026-07-28 each request carries the client's capabilities in its
 * envelope. A 2025 connection declared them once, at initialize, and only
 * `initializeCapabilities` can read those.
 */
export function deleteConfirmationFor(
  ctx: ServerContext,
  initializeCapabilities: () => ClientCapabilities | undefined
): DeleteConfirmation {
  const envelope = (ctx.mcpReq.envelope ?? {}) as Record<string, unknown>;
  const declared = envelope[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined;
  if (!supportsForm(declared ?? initializeCapabilities())) return NO_CONFIRMATION;
  return {
    mintState: (state) => stateCodec.mint(state, ctx),
    answer: answerOf(ctx.mcpReq.inputResponses),
    state: ctx.mcpReq.requestState<ConfirmationState>(),
  };
}

function cutTitle(title: string): string {
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}…` : title;
}

function confirmationMessage({ titles, dependentCount }: DeletionPreview): string {
  const one = titles.length === 1;
  const them = one ? 'it' : 'them';
  const verb = dependentCount === 1 ? 'task depends' : 'tasks depend';
  const dependents = dependentCount === 0
    ? `No other task depends on ${them}.`
    : `${dependentCount} other ${verb} on ${them}.`;
  return [
    one ? 'Permanently delete this task?' : `Permanently delete these ${titles.length} tasks?`,
    ...titles.map((title) => `- ${cutTitle(title)}`),
    '',
    `${dependents} Deleting skips the 30-day Trash and can't be undone.`,
  ].join('\n');
}

function askToConfirm(deletion: DeletionPreview, requestState: string): InputRequiredResult {
  return inputRequired({
    inputRequests: {
      [CONFIRM_DELETE_KEY]: inputRequired.elicit({
        message: confirmationMessage(deletion),
        requestedSchema: CONFIRM_SCHEMA,
      }),
    },
    requestState,
  });
}

/** The v1.5.0 delete, limited to `expectedStamps` once a person has confirmed. */
type DeleteRun = (expectedStamps?: Record<string, string>) => Promise<McpToolResponse>;

async function deleteIfConfirmed(
  confirmation: DeleteConfirmation,
  tool: string,
  run: DeleteRun
): Promise<McpToolResponse> {
  if (confirmation.answer !== 'confirmed') return NOT_CONFIRMED;
  const { state } = confirmation;
  if (state?.v !== 1 || state.tool !== tool) return NOT_CHECKED;
  try {
    return await run(state.stamps);
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    return notDeleted(
      `task ${error.taskId} no longer matches what the user confirmed, so it was kept. ` +
        'Read it again, and ask again if it should still go.'
    );
  }
}

/**
 * Runs a `dryRun: false` delete behind the person's answer. The first round
 * asks and signs the stamps it showed them; the retried round deletes only
 * what still matches. When the client can't ask, `run` is the v1.5.0 delete.
 * When the preview finds nothing, it runs as a confirmed delete of nothing, so
 * a task that syncs in before the delete's own read is kept.
 */
async function confirmBeforeDelete(
  confirmation: DeleteConfirmation,
  call: { tool: string; dryRun?: boolean },
  preview: () => Promise<DeletionPreview | undefined>,
  run: DeleteRun
): Promise<ToolCallResult> {
  const { mintState } = confirmation;
  if (call.dryRun !== false || !mintState) return run();
  if (confirmation.answer) return deleteIfConfirmed(confirmation, call.tool, run);
  const deletion = await preview();
  if (!deletion) return run({});
  return askToConfirm(deletion, await mintState({ v: 1, tool: call.tool, stamps: deletion.stamps }));
}

export function deleteTaskWithConfirmation(
  config: GsdConfig,
  args: ToolArgs<'delete_task'>,
  confirmation: DeleteConfirmation
): Promise<ToolCallResult> {
  const preview = async () => (await deleteTask(config, args.id, { dryRun: true })).deletion;
  const run: DeleteRun = (stamps) => handleDeleteTask(config, args, stamps);
  return confirmBeforeDelete(confirmation, { tool: 'delete_task', dryRun: args.dryRun }, preview, run);
}

export function bulkUpdateWithConfirmation(
  config: GsdConfig,
  args: ToolArgs<'bulk_update_tasks'>,
  confirmation: DeleteConfirmation
): Promise<ToolCallResult> {
  const run: DeleteRun = (stamps) => handleBulkUpdateTasks(config, args, stamps);
  if (args.operation.type !== 'delete') return run();
  const preview = async () =>
    (await bulkUpdateTasks(config, args.taskIds, args.operation, { dryRun: true })).deletion;
  return confirmBeforeDelete(confirmation, { tool: 'bulk_update_tasks', dryRun: args.dryRun }, preview, run);
}
