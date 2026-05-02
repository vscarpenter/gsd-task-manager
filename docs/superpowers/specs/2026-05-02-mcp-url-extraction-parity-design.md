# MCP URL Extraction Parity — Design Spec

- **Date:** 2026-05-02
- **Status:** Proposed
- **Author:** Vinny Carpenter (with Claude)
- **Related:** PR #253 (`feat(capture): extract URLs from task title into description field`), commit `db31a1f`

## Goal

Make MCP `create_task` apply the same URL-extraction behavior the webapp's capture-bar / create-drawer applies, so a task created via Claude Desktop with a URL in its title is normalized identically to one created in the UI.

## Background

PR #253 added `extractUrlsFromTitle()` to `lib/capture-parser.ts` and wired it into all three webapp creation paths:
1. Quick-capture Enter (`components/matrix-simplified/index.tsx:120-137`)
2. Full create-drawer submit (`index.tsx:189-215`)
3. Drawer pre-fill from capture-bar "more options" (`index.tsx:168-182`)

The MCP server (`packages/mcp-server/src/write-ops/task-operations.ts`, `createTask`) was not updated and writes `input.title` to PocketBase as-is. This produces inconsistent task shapes depending on which client created the task.

## Constraint that shapes the solution

The MCP package builds with plain `tsc` and is published as a standalone npm package (`gsd-mcp-server`). Its `tsconfig.json` sets `rootDir: "./src"`, which prevents importing webapp `lib/` files directly. Switching MCP to a bundler (tsup/esbuild) to inline a workspace dep was considered (Approach B in brainstorming) and rejected — adding bundler infra for ~50 lines of pure code violates "boring tech" / YAGNI for the current scope.

**Chosen approach: vendor the module with a parity test.** A copy lives in `packages/mcp-server/src/text/capture-parser.ts`. A test asserts behavioral and source-text parity with the canonical `lib/capture-parser.ts` so any drift fails CI.

## Inputs / Outputs

### MCP `create_task` (changed behavior)

| Field | Before | After |
| --- | --- | --- |
| `input.title` | written to PB as-is | passed through `extractUrlsFromTitle`; `cleanTitle` is what gets stored |
| `input.description` | written to PB as-is | merged with extracted URLs via `buildDescription(input.description ?? '', urls)` |
| All other fields | unchanged | unchanged |

### MCP `update_task` and `bulk_update_tasks`

Unchanged. The webapp does NOT apply extraction on updates; we mirror that exactly.

## Acceptance Criteria

1. Calling MCP `create_task` with `{ title: "Read https://example.com later" }` produces a task with `title === "Read later"` and `description === "https://example.com/"`.
2. Calling MCP `create_task` with `{ title: "https://example.com" }` (URL-only title) produces `title === "Review link below"` and `description === "https://example.com/"`.
3. Calling MCP `create_task` with `{ title: "Plan trip", description: "Notes here" }` produces an unchanged title and an unchanged description.
4. Calling MCP `create_task` with a `javascript:` or `data:` URL in the title leaves the URL in the title (sanitizer rejects) and does NOT add it to the description.
5. Calling MCP `create_task` with both an existing description AND a URL in the title produces a description with the existing text on the first line(s) and the extracted URL(s) appended below, separated by `\n`.
6. Calling MCP `create_task` with `dryRun: true` returns the same transformed task shape (no PocketBase write).
7. Calling MCP `update_task` with a title containing a URL leaves the URL in the title (no extraction).
8. The webapp's three creation paths (capture-bar, drawer submit, drawer pre-fill) continue to behave exactly as they do today; no UX regression.
9. Editing only `lib/capture-parser.ts` (or only the MCP mirror) causes the parity test to fail.

## Test Stubs

### Webapp (`tests/data/capture-parser.test.ts`)
- `buildDescription_returns_existing_when_no_urls`
- `buildDescription_returns_urls_only_when_existing_is_empty`
- `buildDescription_appends_urls_below_existing_text_with_newline`
- `buildDescription_trims_existing_before_appending`
- `buildDescription_joins_multiple_urls_with_newlines`

### MCP (`packages/mcp-server/src/__tests__/capture-parser-parity.test.ts`)
- `parity_behavioral_single_url_in_title`
- `parity_behavioral_multiple_urls`
- `parity_behavioral_url_only_title_falls_back`
- `parity_behavioral_trailing_punctuation_stripped`
- `parity_behavioral_javascript_url_left_in_place`
- `parity_behavioral_data_url_left_in_place`
- `parity_behavioral_credentialed_url_left_in_place`
- `parity_behavioral_no_url_passthrough`
- `parity_behavioral_empty_title`
- `parity_behavioral_oversized_url_rejected`
- `parity_source_text_extractUrlsFromTitle_matches_canonical`
- `parity_source_text_buildDescription_matches_canonical`

### MCP (`packages/mcp-server/src/__tests__/task-operations-create.test.ts`)
- `createTask_extracts_url_from_title_into_description`
- `createTask_url_only_title_uses_fallback`
- `createTask_appends_url_below_existing_description`
- `createTask_javascript_url_not_extracted`
- `createTask_no_url_unchanged`
- `createTask_dry_run_returns_transformed_task`

## Out of Scope

- Sharing `parseCapture` (`!`/`*`/`#tag` shortcuts). UI-only.
- Applying extraction to MCP `update_task` or `bulk_update_tasks`.
- Migrating MCP to a bundler (tsup/esbuild) or creating a `packages/shared-*` workspace.
- Backfilling extraction for tasks that already exist in PocketBase with URLs in titles.
- Changing the URL sanitizer rules (allowed protocols, max length, credential rejection).
- Restoring extraction on the webapp's edit-drawer (Edit a task and add a URL → not extracted today; out of scope).

## Implementation Plan (high level — full plan via writing-plans skill)

1. **Promote `buildDescription` into `lib/capture-parser.ts`.** Move the 6-line helper from `components/matrix-simplified/index.tsx`. Update the import. Verify the three webapp call sites still work via the existing tests + adding tests for the helper.
2. **Vendor the mirror at `packages/mcp-server/src/text/capture-parser.ts`.** Verbatim copy of the canonical exports + private helpers. Top-of-file `MIRROR OF` comment naming the canonical file and the parity test.
3. **Wire MCP `createTask`.** Apply `extractUrlsFromTitle` + `buildDescription` at the top of `createTask` before validation. Use `cleanTitle` and the merged description when constructing `newTask`.
4. **Add the parity test.** Behavioral assertions over the shared fixture array. Source-text comparison via `readFileSync` of both files; normalize whitespace; assert the function bodies of `extractUrlsFromTitle` and `buildDescription` match.
5. **Add MCP create-tests** for the URL-extraction behavior end-to-end.
6. **Run the full suite** in both root and `packages/mcp-server/` plus typecheck and lint.

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Two source files drift | Source-text parity assertion fails the build. |
| Source-text comparison is brittle to formatting | Normalize whitespace (collapse runs, trim) before comparing. Compare bodies of named functions, not whole-file text. |
| MCP create signature changes silently break callers | The transformation happens inside `createTask`; the public `CreateTaskInput` interface is unchanged. |
| Extraction surprises an LLM that intentionally put a URL in the title | Webapp parity is the explicit goal; if surprising, future ADR can revisit (e.g., add an opt-out flag). |
| Description merging order | Existing description first, extracted URLs appended — matches `buildDescription(draft.description, urls)` at `components/matrix-simplified/index.tsx:200`. |

## Verification Method

- `bun run test` (root) — must pass; coverage of `lib/capture-parser.ts` stays ≥80%.
- `npm run test` in `packages/mcp-server/` — must pass; new tests cover parity + create.
- `bun typecheck` and MCP `tsc --noEmit` — both clean.
- `bun lint` — clean.
- Manual smoke via Claude Desktop: invoke `create_task` with a URL-bearing title; verify the resulting task in the webapp matches what the capture-bar would have produced.
- Drift check: edit one of the two `capture-parser.ts` files (e.g., add a comment inside a function body); confirm the parity test fails.
