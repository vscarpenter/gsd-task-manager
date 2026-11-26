import { readFileSync } from 'node:fs';
import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { createServer, registerHandlers } from '../../server/setup.js';
import { handleToolCall } from '../../tools/handlers/index.js';
import { OFFLINE_CONFIG, PROTOCOLS, connectClient, type Protocol } from '../helpers/protocol-clients.js';

// AC4's write-error case: the delete handler fails with a PocketBase 422, as in
// dispatcher-write-safety.test.ts. Every other handler stays real.
vi.mock('../../tools/handlers/write-handlers.js', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  handleDeleteTask: vi.fn(async () => {
    throw Object.assign(new Error('PocketBase rejected the record: {"title":"invalid"}'), { status: 422 });
  }),
}));

/**
 * Pins what gsd-mcp-server v1.5.0 (@modelcontextprotocol/sdk 1.32.2) sends for
 * tools/list and prompts/list on a 2025-11-25 connection. The move to SDK v2
 * must send the same lists (tasks/spec.md, "Move the MCP server to SDK v2",
 * AC2). The fixture is captured output, not a design: change it only in a PR
 * that changes the contract on purpose and says so.
 *
 * The client side speaks raw JSON-RPC, so no SDK client's parsing sits between
 * the server's output and the comparison, and the JSON round trip matches what
 * stdio carries.
 */
const FIXTURE = new URL('../fixtures/wire-contract-v1.5.0.json', import.meta.url);

// tools/list and prompts/list never reach PocketBase, so this config goes unused.
const UNUSED_CONFIG = { pocketBaseUrl: 'https://pocketbase.invalid', authToken: 'unused' };

type JsonObject = Record<string, unknown>;
type WireContract = { protocolVersion: unknown; tools: unknown; prompts: unknown };

interface RawClient {
  request(method: string, params: JsonObject): Promise<JsonObject>;
  notify(method: string): Promise<void>;
  close(): Promise<void>;
}

function resultOf(message: JSONRPCMessage): JsonObject {
  if ('error' in message) throw new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`);
  if (!('result' in message)) throw new Error(`Not a response: ${JSON.stringify(message)}`);
  return JSON.parse(JSON.stringify(message.result)) as JsonObject;
}

async function connectRawClient(): Promise<RawClient> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  registerHandlers(server, UNUSED_CONFIG);
  await server.connect(serverSide);

  const settle = new Map<number, (message: JSONRPCMessage) => void>();
  clientSide.onmessage = (message) => {
    if ('id' in message && typeof message.id === 'number') settle.get(message.id)?.(message);
  };
  await clientSide.start();

  let lastId = 0;
  const request = (method: string, params: JsonObject) =>
    new Promise<JsonObject>((resolve, reject) => {
      lastId += 1;
      settle.set(lastId, (message) => {
        try {
          resolve(resultOf(message));
        } catch (error) {
          reject(error);
        }
      });
      clientSide.send({ jsonrpc: '2.0', id: lastId, method, params }).catch(reject);
    });
  const notify = (method: string) => clientSide.send({ jsonrpc: '2.0', method });
  return { request, notify, close: () => server.close() };
}

async function captureWireContract(protocolVersion: string): Promise<WireContract> {
  const client = await connectRawClient();
  try {
    const initialized = await client.request('initialize', {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'wire-contract-test', version: '1.0.0' },
    });
    await client.notify('notifications/initialized');
    const { tools } = await client.request('tools/list', {});
    const { prompts } = await client.request('prompts/list', {});
    return { protocolVersion: initialized.protocolVersion, tools, prompts };
  } finally {
    await client.close();
  }
}

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// The dispatcher's four kinds of result: success, validation error, unknown
// tool, and a sanitized PocketBase write error.
const PARITY_CASES = [
  { name: 'get_help', args: {} },
  { name: 'get_task', args: {} },
  { name: 'no_such_tool', args: {} },
  { name: 'delete_task', args: { id: 'task-1', dryRun: false } },
] as const;

type ToolPayload = { content: unknown; isError: boolean };

// A 2026-07-28 result also carries _meta naming the server; that is protocol
// metadata, not dispatcher output, so parity compares the payload only.
function payloadOf(result: unknown): ToolPayload {
  const { content, isError } = result as { content?: unknown; isError?: boolean };
  return roundTrip({ content, isError: isError ?? false });
}

async function callEachCase(protocol: Protocol): Promise<ToolPayload[]> {
  const { client, close } = await connectClient(protocol);
  try {
    const payloads: ToolPayload[] = [];
    for (const { name, args } of PARITY_CASES) {
      payloads.push(payloadOf(await client.callTool({ name, arguments: { ...args } })));
    }
    return payloads;
  } finally {
    await close();
  }
}

describe('MCP wire contract', () => {
  it('should_list_v1_5_tools_and_prompts_when_client_negotiates_2025_11_25', async () => {
    const pinned: WireContract = JSON.parse(readFileSync(FIXTURE, 'utf8'));

    const actual = await captureWireContract('2025-11-25');

    expect(actual).toEqual(pinned);
  });

  it('should_list_v1_5_tools_and_prompts_when_client_negotiates_2026_07_28', async () => {
    const pinned: WireContract = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    const { client, close } = await connectClient('2026-07-28');
    try {
      const { tools } = await client.listTools();
      const { prompts } = await client.listPrompts();

      expect(roundTrip({ protocolVersion: client.getNegotiatedProtocolVersion(), tools, prompts })).toEqual({
        protocolVersion: '2026-07-28',
        tools: pinned.tools,
        prompts: pinned.prompts,
      });
    } finally {
      await close();
    }
  });

  it('should_return_identical_tool_results_on_both_protocols', async () => {
    const dispatcher = await Promise.all(
      PARITY_CASES.map(async ({ name, args }) => payloadOf(await handleToolCall(name, { ...args }, OFFLINE_CONFIG)))
    );

    const [legacy, modern] = await Promise.all(PROTOCOLS.map(callEachCase));

    expect({ legacy, modern }).toEqual({ legacy: dispatcher, modern: dispatcher });
  });
});
