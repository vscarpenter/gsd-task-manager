# Text

## Overview

This directory has two text helpers with no I/O. One moves `http` and `https` URLs out of a task title and appends them to a description. The other normalizes tags. `capture-parser.ts` states that it mirrors the web app's `lib/capture-parser.ts`.

## Interface

- `extractUrlsFromTitle(title)` (`capture-parser.ts`): removes valid `http` and `https` URLs from the title. It returns the cleaned title and a deduplicated URL list.
- `buildDescription(existing, urls)` (`capture-parser.ts`): appends the URLs to the description, one per line. It returns `existing` unchanged when `urls` is empty.
- `ExtractedUrls` (`capture-parser.ts`): `{ cleanTitle: string, urls: string[] }`.
- `normalizeTag(raw)` (`tags.ts`): trims, lowercases, and strips one leading `#`.
- `normalizeTags(tags)` (`tags.ts`): normalizes each tag, drops empty ones, and deduplicates in first-seen order.

## Invariants

- `capture-parser.ts` header comment: the file mirrors the web app's `lib/capture-parser.ts` and must stay in sync. A parity test detects drift.
- `capture-parser.ts:TITLE_URL_PATTERN`: the parser recognizes URLs only. It handles no other capture token.
- `capture-parser.ts:TRAILING_PUNCTUATION`: trailing punctuation is removed from a matched URL.
- `capture-parser.ts:MAX_URL_LENGTH`: a URL of 2048 characters or more is rejected.
- `capture-parser.ts:sanitizeTitleUrl`: it rejects a URL with whitespace, control characters, a protocol other than `http` or `https`, no hostname, or credentials.
- `capture-parser.ts:sanitizeTitleUrl`: it returns the raw trimmed text, not `url.href`, so captures stay byte-identical across platforms.
- `capture-parser.ts:extractUrlsFromTitle`: a rejected candidate stays in the title.
- `capture-parser.ts:extractUrlsFromTitle`: a title that held only URLs becomes `Review link below`.
- `tags.ts` comment: stored tags can be un-normalized, so a comparison must normalize the stored side too.

## Side Effects

- None

## Verification

- Run: `bun run --cwd packages/mcp-server test`
