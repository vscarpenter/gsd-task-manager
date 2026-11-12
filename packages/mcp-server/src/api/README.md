# API

## Overview

This directory has a host redaction helper, an authenticated PocketBase GET helper, and a fetch retry helper. Non-test code outside this directory imports only `redactPocketBaseHost`. Nothing outside this directory uses `apiRequest` or `fetchWithRetry`.

## Interface

- `redactPocketBaseHost(url)` (`client.ts`): returns `<protocol>//[pocketbase-host]`, or `[pocketbase-host]` if the URL cannot be parsed.
- `apiRequest<T>(config, endpoint, schema, retryConfig?)` (`client.ts`): sends a GET with Bearer auth and retry, then returns `schema.parse(json)`.
- `fetchWithRetry(fetchFn, config?)` (`retry.ts`): calls `fetchFn` up to `maxRetries + 1` times, with backoff between attempts.
- `RetryConfig` (`retry.ts`): `{maxRetries, baseDelayMs, maxDelayMs, retryableStatuses}`.
- `DEFAULT_RETRY_CONFIG` (`retry.ts`): 3 retries, 1000 ms base delay, 10000 ms cap, statuses 500, 502, 503, 504, and 429.
- `calculateBackoffDelay(attempt, config)` (`retry.ts`): `baseDelayMs * 2^attempt` plus up to 25% random jitter, capped at `maxDelayMs`.
- `isRetryableNetworkError(error)` (`retry.ts`): true when the error message names a network failure such as `fetch failed` or `econnreset`.
- `isRetryableStatus(status, config)` (`retry.ts`): true when the status is in `retryableStatuses`.
- `sleep(ms)` (`retry.ts`): resolves after `setTimeout(ms)`.
- `formatRetryInfo(attempts, config)` (`retry.ts`): returns an empty string for 0 attempts, otherwise a retry count sentence.

## Invariants

- `retry.ts:fetchWithRetry`: a retryable status is retried only while `attempt < maxRetries`. The last response is returned as it is.
- `retry.ts:fetchWithRetry`: only network errors are retried. Other errors are rethrown at once.
- `client.ts:apiRequest`: a response that is not ok throws an error with the status, the body, and the endpoint.
- `client.ts:apiRequest`: the response JSON must pass `schema.parse`.
- `client.ts:fetchWithErrorHandling`: a network failure is rethrown with the redacted host in its `Failed to connect` line. The message also carries the original error text, which is not redacted.
- `client.ts:redactPocketBaseHost`: its comment says the host is redacted so shared errors do not leak a private self-hosted endpoint.

## Side Effects

- `client.ts:fetchWithErrorHandling`: sends a GET through global `fetch` to `config.pocketBaseUrl` plus the endpoint, with an `Authorization: Bearer` header.
- `retry.ts:sleep`: sets a `setTimeout` timer. `fetchWithRetry` uses it to wait between attempts.

## Verification

- Run: `bun run --cwd packages/mcp-server test`
