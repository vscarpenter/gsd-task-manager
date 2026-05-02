# MCP URL Extraction Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MCP `create_task` apply the same URL-extraction behavior the webapp's capture-bar / create-drawer applies, so a task created via Claude Desktop with a URL in its title is normalized identically to one created in the UI.

**Architecture:** Vendor `extractUrlsFromTitle` + `buildDescription` from the canonical `lib/capture-parser.ts` into the MCP package as a one-file mirror at `packages/mcp-server/src/text/capture-parser.ts`. Wire MCP `createTask` to call them. Protect against drift with a parity test that asserts both behavioral and source-text equivalence between the two files.

**Tech Stack:** TypeScript (strict), Vitest, the existing webapp + MCP workspace setup. No new dependencies, no bundler.

**Spec:** `docs/superpowers/specs/2026-05-02-mcp-url-extraction-parity-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/capture-parser.ts` | Modify | Canonical source. Adds `buildDescription` next to `extractUrlsFromTitle`. |
| `tests/data/capture-parser.test.ts` | Modify | Adds 5 unit tests for `buildDescription`. |
| `components/matrix-simplified/index.tsx` | Modify | Removes local `buildDescription`, imports it from the canonical module. |
| `packages/mcp-server/src/text/capture-parser.ts` | Create | Verbatim mirror of the canonical exports + private helpers. |
| `packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts` | Create | Behavioral + source-text parity assertions. |
| `packages/mcp-server/src/write-ops/task-operations.ts` | Modify | `createTask` calls `extractUrlsFromTitle` + `buildDescription` before constructing `newTask`. |
| `packages/mcp-server/src/__tests__/write-ops/task-operations-create.test.ts` | Create | End-to-end tests for the create path with URL extraction. |

---

## Task 1: Promote `buildDescription` into the canonical module (TDD)

**Files:**
- Modify: `lib/capture-parser.ts` (append a new exported function)
- Test: `tests/data/capture-parser.test.ts` (append a new `describe` block)

- [ ] **Step 1.1: Write the failing tests for `buildDescription`**

In `tests/data/capture-parser.test.ts`, update the existing import line at the top from:

```typescript
import { parseCapture, extractUrlsFromTitle } from "@/lib/capture-parser";
```

to:

```typescript
import { parseCapture, extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
```

Then append this `describe` block at the end of the file (after the existing `describe("extractUrlsFromTitle", ...)` block):

```typescript
describe("buildDescription", () => {
  it("returns existing unchanged when there are no urls", () => {
    expect(buildDescription("Notes here", [])).toBe("Notes here");
  });

  it("returns urls joined by newline when existing is empty", () => {
    expect(buildDescription("", ["https://a.test/", "https://b.test/"])).toBe(
      "https://a.test/\nhttps://b.test/"
    );
  });

  it("returns urls joined by newline when existing is whitespace only", () => {
    expect(buildDescription("   \n  ", ["https://a.test/"])).toBe("https://a.test/");
  });

  it("appends urls below trimmed existing text separated by a single newline", () => {
    expect(buildDescription("  Plan trip  ", ["https://a.test/"])).toBe(
      "Plan trip\nhttps://a.test/"
    );
  });

  it("preserves multi-line existing text and appends urls below", () => {
    expect(
      buildDescription("Line one\nLine two", ["https://a.test/", "https://b.test/"])
    ).toBe("Line one\nLine two\nhttps://a.test/\nhttps://b.test/");
  });
});
```

- [ ] **Step 1.2: Run tests, confirm they fail for the right reason**

Run:
```bash
bun run test -- tests/data/capture-parser.test.ts
```
Expected: 5 new tests fail with a TypeScript / module-resolution error along the lines of `"buildDescription" is not exported by "lib/capture-parser.ts"`. The 12 existing tests in the file must still pass.

- [ ] **Step 1.3: Implement `buildDescription` in `lib/capture-parser.ts`**

Append this function at the end of `lib/capture-parser.ts` (after `extractUrlsFromTitle`, keeping the two together):

```typescript
/**
 * Merges extracted URLs into an existing description, separated by newlines.
 * - If `urls` is empty, returns `existing` unchanged.
 * - If `existing` is empty/whitespace, returns the URL block alone.
 * - Otherwise returns `existing.trim() + "\n" + urls.join("\n")`.
 */
export function buildDescription(existing: string, urls: string[]): string {
  if (urls.length === 0) return existing;
  const urlBlock = urls.join("\n");
  return existing.trim() ? `${existing.trim()}\n${urlBlock}` : urlBlock;
}
```

- [ ] **Step 1.4: Run tests, confirm they pass**

Run:
```bash
bun run test -- tests/data/capture-parser.test.ts
```
Expected: all 17 tests pass (12 existing + 5 new).

- [ ] **Step 1.5: Commit**

```bash
git add lib/capture-parser.ts tests/data/capture-parser.test.ts
git commit -m "refactor(capture-parser): promote buildDescription into shared module"
```

---

## Task 2: Switch `matrix-simplified` to import the promoted helper

**Files:**
- Modify: `components/matrix-simplified/index.tsx` (lines 6 and 48-53)

- [ ] **Step 2.1: Update the import line**

Change the existing import at line 6 from:

```typescript
import { extractUrlsFromTitle } from "@/lib/capture-parser";
```

to:

```typescript
import { extractUrlsFromTitle, buildDescription } from "@/lib/capture-parser";
```

- [ ] **Step 2.2: Delete the local `buildDescription` helper**

Delete lines 48-53 of `components/matrix-simplified/index.tsx`:

```typescript
/** Merges extracted URLs into an existing description, separated by newlines. */
function buildDescription(existing: string, urls: string[]): string {
  if (urls.length === 0) return existing;
  const urlBlock = urls.join("\n");
  return existing.trim() ? `${existing.trim()}\n${urlBlock}` : urlBlock;
}
```

The three call sites further down (`handleCapture`, `handleOpenCreateDrawer`, `handleEditSubmit`) already invoke `buildDescription(...)` with the right arguments and now resolve to the imported version automatically.

- [ ] **Step 2.3: Run typecheck and webapp tests**

Run:
```bash
bun typecheck && bun run test
```
Expected: typecheck clean; full Vitest suite green.

- [ ] **Step 2.4: Commit**

```bash
git add components/matrix-simplified/index.tsx
git commit -m "refactor(matrix-simplified): consume buildDescription from shared module"
```

---

## Task 3: Vendor the mirror into the MCP package

**Files:**
- Create: `packages/mcp-server/src/text/capture-parser.ts`

- [ ] **Step 3.1: Create the directory**

Run:
```bash
mkdir -p packages/mcp-server/src/text
```

- [ ] **Step 3.2: Create the mirror file**

Write `packages/mcp-server/src/text/capture-parser.ts` with this exact content:

```typescript
// MIRROR OF lib/capture-parser.ts (extractUrlsFromTitle + buildDescription only).
// Keep this file in sync with the canonical webapp module. Drift is detected by
// packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts.
//
// The MCP server is published as a standalone npm package built with plain `tsc`.
// It cannot import from the webapp's lib/ tree because tsconfig.rootDir = "./src".
// Vendoring + parity test was chosen over introducing a bundler or a separate
// shared workspace package — see
// docs/superpowers/specs/2026-05-02-mcp-url-extraction-parity-design.md.

export interface ExtractedUrls {
  cleanTitle: string;
  urls: string[];
}

const FALLBACK_TITLE_FOR_URL_ONLY = "Review link below";

// Matches http/https URLs; reuses the same pattern as lib/task-links.ts
const TITLE_URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`{}|\\^]+/giu;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/u;
const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function sanitizeTitleUrl(candidate: string): string | null {
  const value = candidate.trim();
  if (value.length === 0 || value.length > MAX_URL_LENGTH || /[ -\s]/u.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Scans `title` for http/https URLs, removes them, and returns the sanitized
 * URL list alongside the cleaned title text.
 *
 * Rules:
 * - All valid URLs are extracted and sanitized (XSS-safe: http/https only, no credentials).
 * - Invalid or unsafe URL candidates are left in the title unchanged.
 * - If the title collapses to empty after extraction, `cleanTitle` is set to
 *   FALLBACK_TITLE_FOR_URL_ONLY ("Review link below").
 */
export function extractUrlsFromTitle(title: string): ExtractedUrls {
  const urls: string[] = [];
  let working = title;

  // We build the cleaned title by iterating matches and replacing valid URLs.
  // Using a replacer lets us handle invalid candidates gracefully (leave them in place).
  working = working.replace(TITLE_URL_PATTERN, (raw) => {
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const safe = sanitizeTitleUrl(trimmed);
    if (!safe) return raw; // leave invalid/unsafe candidates untouched
    urls.push(safe);
    // Trailing punctuation (e.g. a period at the end of a sentence) is dropped
    // along with the URL — it was sentence-level punctuation around the link.
    return "";
  });

  const cleanTitle = working.replace(/\s+/g, " ").trim() || (urls.length > 0 ? FALLBACK_TITLE_FOR_URL_ONLY : "");

  return { cleanTitle, urls };
}

/**
 * Merges extracted URLs into an existing description, separated by newlines.
 * - If `urls` is empty, returns `existing` unchanged.
 * - If `existing` is empty/whitespace, returns the URL block alone.
 * - Otherwise returns `existing.trim() + "\n" + urls.join("\n")`.
 */
export function buildDescription(existing: string, urls: string[]): string {
  if (urls.length === 0) return existing;
  const urlBlock = urls.join("\n");
  return existing.trim() ? `${existing.trim()}\n${urlBlock}` : urlBlock;
}
```

> **Important:** The function bodies of `extractUrlsFromTitle`, `buildDescription`, and `sanitizeTitleUrl` MUST match `lib/capture-parser.ts` byte-for-byte (after whitespace normalization). The parity test in Task 4 enforces this.

- [ ] **Step 3.3: Verify it typechecks in the MCP package**

Run:
```bash
cd packages/mcp-server && npx tsc --noEmit && cd -
```
Expected: no errors.

- [ ] **Step 3.4: Commit**

```bash
git add packages/mcp-server/src/text/capture-parser.ts
git commit -m "feat(mcp): vendor extractUrlsFromTitle + buildDescription from webapp"
```

---

## Task 4: Add the parity test (write the test, watch it pass against the verbatim copy, then PROVE it detects drift)

**Files:**
- Create: `packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts`

- [ ] **Step 4.1: Create the test file**

Write `packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  extractUrlsFromTitle as mcpExtract,
  buildDescription as mcpBuild,
} from '../../text/capture-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const CANONICAL_PATH = resolve(REPO_ROOT, 'lib/capture-parser.ts');
const MIRROR_PATH = resolve(__dirname, '../../text/capture-parser.ts');

interface Fixture {
  name: string;
  input: string;
  expected: { cleanTitle: string; urls: string[] };
}

const FIXTURES: Fixture[] = [
  {
    name: 'single url in title',
    input: 'Read https://example.com later',
    expected: { cleanTitle: 'Read later', urls: ['https://example.com/'] },
  },
  {
    name: 'multiple urls',
    input: 'See https://a.test and https://b.test',
    expected: { cleanTitle: 'See and', urls: ['https://a.test/', 'https://b.test/'] },
  },
  {
    name: 'url-only title falls back',
    input: 'https://example.com',
    expected: { cleanTitle: 'Review link below', urls: ['https://example.com/'] },
  },
  {
    name: 'trailing punctuation stripped',
    input: 'Check https://example.com.',
    expected: { cleanTitle: 'Check', urls: ['https://example.com/'] },
  },
  {
    name: 'javascript protocol url left in place',
    input: 'Bad javascript:alert(1) link',
    expected: { cleanTitle: 'Bad javascript:alert(1) link', urls: [] },
  },
  {
    name: 'data protocol url left in place',
    input: 'data:text/html,<script>',
    expected: { cleanTitle: 'data:text/html,<script>', urls: [] },
  },
  {
    name: 'credentialed url left in place',
    input: 'Login https://user:pass@example.com',
    expected: { cleanTitle: 'Login https://user:pass@example.com', urls: [] },
  },
  {
    name: 'no url passthrough',
    input: 'just a regular task',
    expected: { cleanTitle: 'just a regular task', urls: [] },
  },
  {
    name: 'empty string',
    input: '',
    expected: { cleanTitle: '', urls: [] },
  },
  {
    name: 'oversized url rejected',
    input: `huge https://example.com/${'a'.repeat(2050)}`,
    expected: {
      cleanTitle: `huge https://example.com/${'a'.repeat(2050)}`,
      urls: [],
    },
  },
];

describe('capture-parser parity: behavior', () => {
  for (const fixture of FIXTURES) {
    it(`mcp mirror produces expected output for: ${fixture.name}`, () => {
      const result = mcpExtract(fixture.input);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('mcp buildDescription empty urls returns existing unchanged', () => {
    expect(mcpBuild('Notes', [])).toBe('Notes');
  });

  it('mcp buildDescription empty existing returns urls joined', () => {
    expect(mcpBuild('', ['https://a.test/', 'https://b.test/'])).toBe(
      'https://a.test/\nhttps://b.test/'
    );
  });

  it('mcp buildDescription appends urls below trimmed existing', () => {
    expect(mcpBuild('  Plan trip  ', ['https://a.test/'])).toBe('Plan trip\nhttps://a.test/');
  });
});

/**
 * Extracts the body of a top-level named function declaration from TS source.
 * Handles single-line and multi-line bodies. Whitespace inside the body is
 * collapsed to single spaces for comparison.
 */
function extractFunctionBody(source: string, name: string): string {
  // Match `export function name(...)` or `function name(...)` followed by an opening brace.
  const signature = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{`);
  const match = source.match(signature);
  if (!match || match.index === undefined) {
    throw new Error(`Function "${name}" not found in source`);
  }
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced braces while reading body of "${name}"`);
  }
  // body is between `start` and `i - 1` (i is now one past the closing brace).
  return source.slice(start, i - 1).replace(/\s+/g, ' ').trim();
}

describe('capture-parser parity: source text', () => {
  const canonical = readFileSync(CANONICAL_PATH, 'utf8');
  const mirror = readFileSync(MIRROR_PATH, 'utf8');

  it('extractUrlsFromTitle body matches canonical', () => {
    expect(extractFunctionBody(mirror, 'extractUrlsFromTitle')).toBe(
      extractFunctionBody(canonical, 'extractUrlsFromTitle')
    );
  });

  it('buildDescription body matches canonical', () => {
    expect(extractFunctionBody(mirror, 'buildDescription')).toBe(
      extractFunctionBody(canonical, 'buildDescription')
    );
  });

  it('sanitizeTitleUrl body matches canonical', () => {
    expect(extractFunctionBody(mirror, 'sanitizeTitleUrl')).toBe(
      extractFunctionBody(canonical, 'sanitizeTitleUrl')
    );
  });
});
```

- [ ] **Step 4.2: Run the parity test, confirm all assertions pass**

Run:
```bash
cd packages/mcp-server && npm run test -- capture-parser-parity && cd -
```
Expected: all behavioral fixtures + 3 source-text assertions pass. If a behavioral fixture fails, the mirror file in Task 3 has a bug — fix the mirror, not the test fixture.

- [ ] **Step 4.3: Drift detection sanity check (manual, do NOT commit the edit)**

Temporarily edit the mirror's `extractUrlsFromTitle` — change `const urls: string[] = [];` to `const urls: string[] = []; // drift`. Re-run:

```bash
cd packages/mcp-server && npm run test -- capture-parser-parity && cd -
```
Expected: the `extractUrlsFromTitle body matches canonical` assertion FAILS. Revert the change and re-run; expected: green again.

- [ ] **Step 4.4: Commit**

```bash
git add packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts
git commit -m "test(mcp): add behavioral + source parity tests for vendored capture-parser"
```

---

## Task 5: Wire `extractUrlsFromTitle` + `buildDescription` into MCP `createTask` (TDD)

**Files:**
- Create: `packages/mcp-server/src/__tests__/write-ops/task-operations-create.test.ts`
- Modify: `packages/mcp-server/src/write-ops/task-operations.ts` (imports + `createTask` body around lines 35-93)

- [ ] **Step 5.1: Write the failing tests**

Create `packages/mcp-server/src/__tests__/write-ops/task-operations-create.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GsdConfig } from '../../types.js';

// Mock the helpers so we never touch real PocketBase.
vi.mock('../../write-ops/helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../write-ops/helpers.js')>(
    '../../write-ops/helpers.js'
  );
  return {
    ...actual,
    createTaskInPB: vi.fn().mockResolvedValue(undefined),
    getAuthInfo: vi.fn().mockResolvedValue({ ownerId: 'owner-1', deviceId: 'device-1' }),
  };
});

vi.mock('../../tools/list-tasks.js', () => ({
  listTasks: vi.fn().mockResolvedValue([]),
}));

import { createTask } from '../../write-ops/task-operations.js';

const config: GsdConfig = {
  pocketbaseUrl: 'http://example.invalid',
  authToken: 'fake',
} as GsdConfig;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTask URL extraction', () => {
  it('extracts a single url from the title into the description', async () => {
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Read later');
    expect(result.task.description).toBe('https://example.com/');
  });

  it('uses the fallback title when the title is url-only', async () => {
    const result = await createTask(config, {
      title: 'https://example.com',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Review link below');
    expect(result.task.description).toBe('https://example.com/');
  });

  it('appends the url below an existing description', async () => {
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      description: 'Notes here',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Read later');
    expect(result.task.description).toBe('Notes here\nhttps://example.com/');
  });

  it('does not extract javascript protocol urls', async () => {
    const result = await createTask(config, {
      title: 'Bad javascript:alert(1) link',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.task.title).toBe('Bad javascript:alert(1) link');
    expect(result.task.description).toBe('');
  });

  it('leaves a no-url title unchanged', async () => {
    const result = await createTask(config, {
      title: 'Plain task',
      description: 'Some notes',
      urgent: true,
      important: true,
      dryRun: true,
    });

    expect(result.task.title).toBe('Plain task');
    expect(result.task.description).toBe('Some notes');
    expect(result.task.urgent).toBe(true);
    expect(result.task.important).toBe(true);
  });

  it('returns the transformed task on dry run without persisting', async () => {
    const helpers = await import('../../write-ops/helpers.js');
    const result = await createTask(config, {
      title: 'Read https://example.com later',
      urgent: false,
      important: false,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.task.title).toBe('Read later');
    expect(helpers.createTaskInPB).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Run the tests, confirm they fail**

Run:
```bash
cd packages/mcp-server && npm run test -- task-operations-create && cd -
```
Expected: tests fail. The first assertion fails with `expected 'Read https://example.com later' to be 'Read later'` — `createTask` is not extracting URLs yet.

- [ ] **Step 5.3: Wire extraction into `createTask`**

Edit `packages/mcp-server/src/write-ops/task-operations.ts`.

After the existing import block (around line 22, after the `dependencies` import), add:

```typescript
import { extractUrlsFromTitle, buildDescription } from '../text/capture-parser.js';
```

Inside `createTask` (currently lines 35-111), insert the extraction call right after the `allTasks` line. Change this block:

```typescript
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const warnings: string[] = [];
  const allTasks = input.dependencies?.length ? await listTasks(config) : [];
```

to:

```typescript
export async function createTask(
  config: GsdConfig,
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const warnings: string[] = [];
  const allTasks = input.dependencies?.length ? await listTasks(config) : [];

  // Mirror the webapp capture flow: pull http(s) URLs out of the title and
  // append them to the description. See lib/capture-parser.ts (canonical) and
  // packages/mcp-server/src/text/capture-parser.ts (vendored mirror).
  const { cleanTitle, urls } = extractUrlsFromTitle(input.title);
  const mergedDescription = buildDescription(input.description ?? '', urls);
```

Then, in the same function, replace the `newTask` literal. Change this:

```typescript
  const newTask: Task = {
    id: taskId,
    title: input.title,
    description: input.description || '',
```

to:

```typescript
  const newTask: Task = {
    id: taskId,
    title: cleanTitle,
    description: mergedDescription,
```

Leave the rest of `createTask` (and all of `updateTask`, `completeTask`, `deleteTask`) untouched.

- [ ] **Step 5.4: Run the new tests, confirm they pass**

Run:
```bash
cd packages/mcp-server && npm run test -- task-operations-create && cd -
```
Expected: all 6 tests pass.

- [ ] **Step 5.5: Run the full MCP suite**

Run:
```bash
cd packages/mcp-server && npm run test && cd -
```
Expected: full suite green (existing tests + new parity test + new create test).

- [ ] **Step 5.6: Commit**

```bash
git add packages/mcp-server/src/write-ops/task-operations.ts packages/mcp-server/src/__tests__/write-ops/task-operations-create.test.ts
git commit -m "feat(mcp): apply URL extraction in create_task to match webapp"
```

---

## Task 6: Full verification + version bump

**Files:**
- Modify: `package.json` (root version bump — patch)
- Modify: `packages/mcp-server/package.json` (MCP version bump — minor, since MCP gains a behavioral change)

- [ ] **Step 6.1: Run the full test suite (root)**

Run:
```bash
bun run test
```
Expected: all tests green.

- [ ] **Step 6.2: Run typecheck (root)**

Run:
```bash
bun typecheck
```
Expected: no errors.

- [ ] **Step 6.3: Run lint (root)**

Run:
```bash
bun lint
```
Expected: clean.

- [ ] **Step 6.4: Run the full MCP test suite + typecheck**

Run:
```bash
cd packages/mcp-server && npm run test && npx tsc --noEmit && cd -
```
Expected: green + clean.

- [ ] **Step 6.5: Bump versions**

Read root `package.json` to find the current version, then bump the patch number (e.g. `1.4.2` → `1.4.3`).

Read `packages/mcp-server/package.json` (currently `1.0.0`) and bump the minor number (e.g. `1.0.0` → `1.1.0`) since MCP `create_task` gains observable new behavior.

- [ ] **Step 6.6: Commit the bumps**

```bash
git add package.json packages/mcp-server/package.json
git commit -m "chore: bump versions for MCP URL extraction parity"
```

---

## Task 7: Branch, push, PR

- [ ] **Step 7.1: Confirm we're on a feature branch (not `main`)**

Run:
```bash
git status -sb
```

If currently on `main`, create a branch and move the new commits to it:

```bash
git switch -c feat/mcp-url-extraction-parity
```

(If a worktree was created up-front by the brainstorming flow, you should already be on a feature branch — skip this step.)

- [ ] **Step 7.2: Push the branch**

```bash
git push -u origin feat/mcp-url-extraction-parity
```

- [ ] **Step 7.3: Open the PR**

```bash
gh pr create --title "feat(mcp): URL extraction parity with webapp capture flow" --body "$(cat <<'EOF'
## Summary
- Vendor `extractUrlsFromTitle` + `buildDescription` from `lib/capture-parser.ts` into the MCP server at `packages/mcp-server/src/text/capture-parser.ts`
- Wire MCP `create_task` to apply the same URL-extraction the webapp's capture-bar / create-drawer applies (title to description merge, URL-only fallback, XSS-safe sanitizer)
- Add a parity test (`__tests__/text/capture-parser-parity.test.ts`) that asserts both behavioral and source-text equivalence between the canonical webapp module and the vendored mirror, so drift fails CI
- Promote `buildDescription` out of `components/matrix-simplified/index.tsx` into the canonical module so both consumers share one implementation

`update_task` is intentionally unchanged — mirrors the webapp, which only extracts on creation.

## Spec
`docs/superpowers/specs/2026-05-02-mcp-url-extraction-parity-design.md`

## Test plan
- [ ] `bun run test` passes (root)
- [ ] `bun typecheck` clean
- [ ] `bun lint` clean
- [ ] `npm run test` passes inside `packages/mcp-server/`
- [ ] `npx tsc --noEmit` clean inside `packages/mcp-server/`
- [ ] Manual: invoke MCP `create_task` with `{ title: "Read https://example.com later" }`; resulting task in webapp shows title `"Read later"` and description containing `https://example.com/`
- [ ] Manual: invoke MCP `update_task` with a URL in the title; URL stays in the title (parity confirmed)
- [ ] Drift sanity check: temporarily edit the mirror, confirm parity test fails, revert
EOF
)"
```

Expected: a PR URL is printed. Report it back.

---

## Self-Review

**Spec coverage:**
- AC #1 (single URL extracted) → Task 5 Step 5.1 first test + Task 4 fixture `single url in title`. Covered.
- AC #2 (URL-only fallback) → Task 5 Step 5.1 second test + Task 4 fixture `url-only title falls back`. Covered.
- AC #3 (no-URL passthrough) → Task 5 Step 5.1 fifth test + Task 4 fixture `no url passthrough`. Covered.
- AC #4 (`javascript:` / `data:` rejected) → Task 5 Step 5.1 fourth test + Task 4 fixtures for both. Covered.
- AC #5 (existing description preserved, URLs appended) → Task 5 Step 5.1 third test + Task 1 Step 1.1 test 4. Covered.
- AC #6 (`dryRun` returns transformed task) → Task 5 Step 5.1 sixth test. Covered.
- AC #7 (`update_task` unchanged) → Task 5 explicitly leaves `updateTask` untouched; PR description calls this out. No regression test for "doesn't extract on update", but it's implicit in the unchanged code path. Acceptable.
- AC #8 (webapp paths unchanged) → Task 2 Step 2.3 runs full webapp suite; Task 6 reruns it. Covered.
- AC #9 (drift causes test failure) → Task 4 Step 4.3 manual drift sanity check; CI runs Task 4's test on every push. Covered.

**Placeholder scan:** Searched for "TBD", "TODO", "fill in", "appropriate". None present. Every code/edit step shows the actual code or the actual lines being changed.

**Type consistency:** `extractUrlsFromTitle` returns `{ cleanTitle, urls }` consistently across the canonical module, the mirror, the parity test fixtures, and the `createTask` consumer. `buildDescription(existing: string, urls: string[]): string` — same signature in canonical and mirror. `CreateTaskInput.title: string` and `CreateTaskInput.description?: string` are unchanged from `packages/mcp-server/src/write-ops/types.ts`.

**Gap fix:** None required. Plan is complete.
