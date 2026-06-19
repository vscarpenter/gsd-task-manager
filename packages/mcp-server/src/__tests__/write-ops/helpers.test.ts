import { describe, it, expect } from 'vitest';
import { escapeFilterValue } from '../../write-ops/helpers.js';

describe('escapeFilterValue', () => {
  it('escapes backslashes then double quotes so a value stays a single filter literal', () => {
    // Order matters: backslash first, then quote — otherwise the injected
    // backslash from quote-escaping would itself be doubled.
    expect(escapeFilterValue('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it('returns plain values unchanged', () => {
    expect(escapeFilterValue('task-123_abc')).toBe('task-123_abc');
  });

  it('throws when the value exceeds the maximum filter length', () => {
    // Defense-in-depth, mirroring lib/sync/pb-sync-helpers.ts: a pathologically
    // long value should be rejected before it reaches the PB filter parser.
    expect(() => escapeFilterValue('x'.repeat(501))).toThrow(/length/i);
  });

  it('allows a value exactly at the maximum length', () => {
    expect(() => escapeFilterValue('x'.repeat(500))).not.toThrow();
  });
});
