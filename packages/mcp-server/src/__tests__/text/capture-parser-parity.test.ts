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
