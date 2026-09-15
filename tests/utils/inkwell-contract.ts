/**
 * Helpers for the Inkwell token contract test: pull the custom properties out of
 * the three theme blocks in a stylesheet, diff two snapshots, and measure contrast.
 */

export type TokenMap = Record<string, string>;

export interface TokenContract {
  /** The `:root { ... }` block. */
  light: TokenMap;
  /** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`. */
  darkAuto: TokenMap;
  /** The `:root[data-theme="dark"] { ... }` block. */
  darkForced: TokenMap;
}

const BLOCK_SELECTORS: Record<keyof TokenContract, RegExp> = {
  light: /(?<![\w\]"'.-])(:root)\s*\{/,
  darkAuto: /:root:not\(\[data-theme="light"\]\)\s*\{/,
  darkForced: /:root\[data-theme="dark"\]\s*\{/,
};

const DECLARATION = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The text between a selector's opening brace and its matching closing brace. */
function blockBody(css: string, selector: RegExp): string {
  const match = selector.exec(css);
  if (!match) return "";
  let depth = 1;
  let index = match.index + match[0].length;
  const start = index;
  while (index < css.length && depth > 0) {
    const char = css[index];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    index += 1;
  }
  return css.slice(start, index - 1);
}

function declarations(body: string, family?: RegExp): TokenMap {
  const tokens: TokenMap = {};
  for (const [, name, value] of body.matchAll(DECLARATION)) {
    if (family && !family.test(name)) continue;
    tokens[name] = value.trim().replace(/\s+/g, " ");
  }
  return tokens;
}

/**
 * Extract every `--token: value` pair from the light, auto-dark, and forced-dark
 * blocks. A `family` pattern narrows the result to matching token names.
 */
export function extractTokenContract(css: string, family?: RegExp): TokenContract {
  const clean = stripComments(css);
  return {
    light: declarations(blockBody(clean, BLOCK_SELECTORS.light), family),
    darkAuto: declarations(blockBody(clean, BLOCK_SELECTORS.darkAuto), family),
    darkForced: declarations(blockBody(clean, BLOCK_SELECTORS.darkForced), family),
  };
}

/** Human-readable drift lines, sorted by block then token name. Empty when equal. */
export function diffTokenContract(expected: TokenContract, actual: TokenContract): string[] {
  const lines: string[] = [];
  for (const block of ["light", "darkAuto", "darkForced"] as const) {
    const names = new Set([...Object.keys(expected[block]), ...Object.keys(actual[block])]);
    for (const name of [...names].sort()) {
      const before = expected[block][name];
      const after = actual[block][name];
      if (before === after) continue;
      if (before === undefined) lines.push(`${block} --${name}: added (${after})`);
      else if (after === undefined) lines.push(`${block} --${name}: removed (was ${before})`);
      else lines.push(`${block} --${name}: ${before} -> ${after}`);
    }
  }
  return lines;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const parts = hex.slice(1).match(/.{2}/g)?.map((part) => channel(Number.parseInt(part, 16)));
  if (!parts || parts.length !== 3) throw new Error(`Invalid color: ${hex}`);
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

/** WCAG 2 contrast ratio between two six-digit hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
