# PocketBase host redaction

`redactPocketBaseHost(url)` in [client.ts](./client.ts) replaces the host and port
with `[pocketbase-host]`, preserving the protocol. The CLI and public MCP error
messages use it to keep private server addresses out of diagnostics. An
unparseable URL produces the placeholder alone.

PocketBase calls go through the SDK in [pocketbase-client.ts](../pocketbase-client.ts).
