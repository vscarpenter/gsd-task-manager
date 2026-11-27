import {
  Client,
  StreamableHTTPClientTransport,
  type ClientCapabilities,
  type ElicitRequestParams,
  type ElicitResult,
} from '@modelcontextprotocol/client';
import { InMemoryTransport, createMcpHandler } from '@modelcontextprotocol/server';
import { createGsdServer } from '../../server/setup.js';
import type { GsdConfig } from '../../types.js';

/**
 * Connects a v2 Client to the GSD server in-process on either protocol
 * revision, as the TypeScript SDK v2 testing guide does: an in-memory pair
 * serves only the 2025 protocol, and `createMcpHandler(...).fetch` is the
 * in-process entry for 2026-07-28.
 */
export type Protocol = '2025-11-25' | '2026-07-28';

export const PROTOCOLS: readonly Protocol[] = ['2025-11-25', '2026-07-28'];

// No test that uses this config may reach PocketBase.
export const OFFLINE_CONFIG: GsdConfig = { pocketBaseUrl: 'https://pocketbase.invalid', authToken: 'unused' };

export interface ConnectedClient {
  client: Client;
  close(): Promise<void>;
}

export interface ClientOptions {
  /** What the client declares, for example `{ elicitation: { form: {} } }`. */
  capabilities?: ClientCapabilities;
  /** Answers each elicitation the server asks for, on either protocol. */
  onElicit?: (params: ElicitRequestParams) => Promise<ElicitResult>;
  /** 2026-07-28 only: rewrites each JSON-RPC request on its way to the server. */
  rewriteRequest?: (message: Record<string, unknown>) => Record<string, unknown>;
}

function rewriteBody(init: RequestInit | undefined, rewrite: ClientOptions['rewriteRequest']): RequestInit | undefined {
  if (!rewrite || typeof init?.body !== 'string') return init;
  return { ...init, body: JSON.stringify(rewrite(JSON.parse(init.body))) };
}

export async function connectClient(
  protocol: Protocol,
  config = OFFLINE_CONFIG,
  options: ClientOptions = {}
): Promise<ConnectedClient> {
  const mode = protocol === '2025-11-25' ? 'legacy' : 'auto';
  const client = new Client(
    { name: 'gsd-protocol-test', version: '1.0.0' },
    { versionNegotiation: { mode }, ...(options.capabilities && { capabilities: options.capabilities }) }
  );
  const { onElicit } = options;
  if (onElicit) client.setRequestHandler('elicitation/create', (request) => onElicit(request.params));

  if (protocol === '2025-11-25') {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createGsdServer(config).connect(serverSide);
    await client.connect(clientSide);
    return { client, close: () => client.close() };
  }

  const handler = createMcpHandler(() => createGsdServer(config));
  await client.connect(
    new StreamableHTTPClientTransport(new URL('http://gsd.test/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, rewriteBody(init, options.rewriteRequest))),
    })
  );
  return {
    client,
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
}
