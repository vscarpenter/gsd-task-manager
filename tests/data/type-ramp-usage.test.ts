/**
 * Guards the One-Ramp Rule at its call sites: components size text with the
 * ramp classes (text-caption, text-small, text-h3, ...), never a hand-set px.
 * The detector catches whole-pixel arbitrary sizes but not fractional ones
 * (text-[12.5px]) or numeric inline fontSize, which React renders as px, so
 * this test reads the source directly.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SOURCE_DIRS = ["components", "app"];
const ARBITRARY_PX_SIZE = /\btext-\[[0-9.]+px\]/g;
const NUMERIC_FONT_SIZE = /\bfontSize\s*[:=]\s*\{?\s*[0-9.]+/g;
const PX_STRING_FONT_SIZE = /\bfontSize\s*:\s*["'][0-9.]+px["']/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        [...line.matchAll(pattern)].map((match) => `${relative(ROOT, file)}:${index + 1} ${match[0]}`)
      )
  );
}

describe("type ramp usage", () => {
  it("sizes no text with an arbitrary px class", () => {
    expect(offenders(ARBITRARY_PX_SIZE)).toEqual([]);
  });

  it("sets no numeric inline fontSize", () => {
    expect(offenders(NUMERIC_FONT_SIZE)).toEqual([]);
  });

  it("sets no px-string inline fontSize", () => {
    expect(offenders(PX_STRING_FONT_SIZE)).toEqual([]);
  });
});
