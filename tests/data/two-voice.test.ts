import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("Two-Voice Rule (DESIGN.md)", () => {
  it("applies the serif voice to every heading step in the type ramp", () => {
    const globals = source("app/globals.css");
    const rule = /\.text-display\s*,\s*\.text-h1\s*,\s*\.text-h2\s*,\s*\.text-h3\s*\{[^}]*\}/;
    const match = globals.match(rule);
    expect(match).not.toBeNull();
    expect(match?.[0]).toMatch(/font-family:\s*var\(--serif\)/);
  });
});
