# Auth

## Overview

This directory decodes a PocketBase JWT offline and grades its `exp` claim. The result is one of `healthy`, `warning`, `critical`, `expired`, or `invalid`, with a message and sign-in steps. It does not check the token's signature.

## Interface

- `getTokenStatus(token, now = new Date())` (`token-status.ts`): classifies a token by its `exp` claim and returns a `TokenStatusResult`.
- `decodeJwtPayload(token)` (`token-status.ts`): decodes the middle JWT segment into an object. It returns null on any failure.
- `TokenHealth` (`token-status.ts`): `'healthy' | 'warning' | 'critical' | 'expired' | 'invalid'`.
- `TokenStatusResult` (`token-status.ts`): `{status, expired, expiresAt, daysRemaining, message, instructions}`.

## Invariants

- `token-status.ts` module comment: decoding is base64 only, with no signature check, because the server enforces validity on every request.
- `token-status.ts:decodeJwtPayload`: returns null unless the token has exactly 3 dot-separated parts and the payload is an object.
- `token-status.ts:getTokenStatus`: a missing token, or a payload without a numeric `exp`, gives `invalid` with `expired` true.
- `token-status.ts:getTokenStatus`: a token at or past its expiry gives `expired` with `daysRemaining` 0.
- `token-status.ts:CRITICAL_DAYS` and `WARNING_DAYS`: 3 days or fewer is `critical`, 14 days or fewer is `warning`, and more is `healthy`.
- `token-status.ts:getTokenStatus`: `instructions` is null only for `healthy`.

## Side Effects

- None

## Verification

- Run: `bun run --cwd packages/mcp-server test`
