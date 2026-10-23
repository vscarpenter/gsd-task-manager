/**
 * How the display serif is loaded.
 *
 * Newsreader is drawn with an optical-size axis. Loading that axis lets the
 * browser's default font-optical-sizing pick the display design for 32px
 * headings and the text design for small serif, instead of stretching one
 * 16px design across the whole ramp.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
const newsreaderOptions = layout.match(/Newsreader\(\{([\s\S]*?)\}\);/)?.[1] ?? "";

describe("serif font loading", () => {
  it("loads Newsreader's optical-size axis", () => {
    expect(newsreaderOptions).toMatch(/axes:\s*\["opsz"\]/);
  });
});
