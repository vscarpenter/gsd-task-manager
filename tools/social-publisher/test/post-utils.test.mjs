import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHighlights,
  normalizeHighlight,
  parseReleaseSubtitle,
  composeReleasePost,
  validatePostText,
} from '../src/post-utils.mjs';

const APP = 'GSD Task Manager';

// GitHub auto-generated "What's Changed" body (the repo's real format).
const GITHUB_BODY = `## What's Changed
* test(pb): cover encryption adapters by @cursor[bot] in https://github.com/o/r/pull/375
* feat(capture): faster quick capture from the menu bar by @vscarpenter in https://github.com/o/r/pull/384
* chore(deps): bump dependencies by @vscarpenter in https://github.com/o/r/pull/381
* fix(sync): completed tasks could reappear after sync by @vscarpenter in https://github.com/o/r/pull/403
* docs: update readme by @vscarpenter in https://github.com/o/r/pull/379
* perf(matrix): virtualize long task lists by @vscarpenter in https://github.com/o/r/pull/390

**Full Changelog**: https://github.com/o/r/compare/v1...v2`;

// Hand-written Keep-a-Changelog body.
const KAC_BODY = `## What's Changed

### Added
- Added faster quick capture from the menu bar.
- Added better grouping for completed tasks.

### Fixed
- Fixed a bug where completed tasks could briefly reappear after sync.`;

test('1: extracts feat/fix/perf highlights from a GitHub What\'s Changed PR list', () => {
  assert.deepEqual(extractHighlights(GITHUB_BODY), [
    'Faster quick capture from the menu bar',
    'Completed tasks could reappear after sync',
    'Virtualize long task lists',
  ]);
});

test('2: extracts bullets from hand-written Added/Fixed sections', () => {
  assert.deepEqual(extractHighlights(KAC_BODY), [
    'Added faster quick capture from the menu bar',
    'Added better grouping for completed tasks',
    'Fixed a bug where completed tasks could briefly reappear after sync',
  ]);
});

test('3: drops test/chore/docs/deps PRs from the GitHub list', () => {
  const out = extractHighlights(GITHUB_BODY);
  assert.ok(!out.some((h) => /cover encryption|bump dependencies|update readme/i.test(h)));
});

test('4: returns [] for empty or whitespace bodies', () => {
  assert.deepEqual(extractHighlights(''), []);
  assert.deepEqual(extractHighlights('   \n  '), []);
});

test('5: normalizeHighlight strips prefix, by-line, markdown links, PR numbers', () => {
  const raw =
    'feat(seo): add [sitemap](https://x.com) for pages (#384) by @vscarpenter in https://github.com/o/r/pull/384';
  assert.equal(normalizeHighlight(raw), 'Add sitemap for pages');
});

test('6: limits highlights to 3', () => {
  const body = `## What's Changed
* feat: one by @u in https://github.com/o/r/pull/1
* feat: two by @u in https://github.com/o/r/pull/2
* feat: three by @u in https://github.com/o/r/pull/3
* feat: four by @u in https://github.com/o/r/pull/4`;
  assert.equal(extractHighlights(body).length, 3);
});

test('7: composeReleasePost uses generic fallback with no highlights and no subtitle', () => {
  const post = composeReleasePost({
    appName: APP,
    version: 'v1.0.0',
    releaseName: 'v1.0.0',
    releaseBody: '## What\'s Changed\n* chore: internal by @u in https://github.com/o/r/pull/1',
    releaseUrl: 'https://example.com/r',
    maxChars: 280,
  });
  assert.match(post, /small improvements and fixes/);
  assert.match(post, /^GSD Task Manager v1\.0\.0 is out\./);
  assert.match(post, /Release notes:\nhttps:\/\/example\.com\/r$/);
});

test('8: composeReleasePost uses subtitle fallback when title has a subtitle', () => {
  const post = composeReleasePost({
    appName: APP,
    version: 'v1.0.0',
    releaseName: 'v1.0.0 — Big Internal Refactor',
    releaseBody: '## What\'s Changed\n* chore: internal by @u in https://github.com/o/r/pull/1',
    releaseUrl: 'https://example.com/r',
    maxChars: 280,
  });
  assert.match(post, /This release focuses on Big Internal Refactor\./);
});

test('9: validatePostText throws on empty text', () => {
  assert.throws(() => validatePostText('', 280), /empty/i);
  assert.throws(() => validatePostText('   ', 280), /empty/i);
});

test('10: validatePostText throws on over-length text', () => {
  assert.throws(() => validatePostText('a'.repeat(281), 280), /exceed/i);
  assert.doesNotThrow(() => validatePostText('a'.repeat(280), 280));
});

test('11: long release notes shrink (drop bullets) instead of exceeding max', () => {
  // Three distinct 30-char highlights. Full 3-bullet post is ~190 chars; a
  // 2-bullet post is ~157. maxChars=170 forces a drop without throwing.
  const mk = (c, n) => `* feat: ${c}${'a'.repeat(29)} by @u in https://github.com/o/r/pull/${n}`;
  const body = `## What's Changed\n${mk('a', 1)}\n${mk('b', 2)}\n${mk('c', 3)}`;
  const maxChars = 170;
  const post = composeReleasePost({
    appName: APP,
    version: 'v2.0.0',
    releaseName: 'v2.0.0',
    releaseBody: body,
    releaseUrl: 'https://example.com/r',
    maxChars,
  });
  assert.ok(post.length <= maxChars, `expected <= ${maxChars}, got ${post.length}`);
  const bullets = (post.match(/•/g) || []).length;
  assert.ok(bullets >= 1 && bullets <= 2, `expected shrink to 1-2 bullets, got ${bullets}`);
});

test('12: dependency-only changes are deprioritized when user-facing changes exist', () => {
  const out = extractHighlights(GITHUB_BODY);
  assert.ok(out.length >= 1);
  assert.ok(!out.some((h) => /bump dependencies/i.test(h)));
});

test('parseReleaseSubtitle: returns text after em-dash, else null', () => {
  assert.equal(parseReleaseSubtitle('v10.0.0 — Security & Sync'), 'Security & Sync');
  assert.equal(parseReleaseSubtitle('v10.0.0 - Hyphen Sub'), 'Hyphen Sub');
  assert.equal(parseReleaseSubtitle('v10.0.0'), null);
});
