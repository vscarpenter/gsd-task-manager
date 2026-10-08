import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

const { generateSwCacheLogic } = requireFromRepo("./scripts/generate-sw-cache-logic.cjs") as {
  generateSwCacheLogic: (typescriptSource: string) => string;
};

const typescriptSource = readFileSync("lib/sw-cache-logic.ts", "utf8");
const committedCopy = readFileSync("public/sw-cache-logic.js", "utf8");

describe("generated service worker cache logic", () => {
  it("matches the committed copy byte for byte", () => {
    expect(
      generateSwCacheLogic(typescriptSource),
      "public/sw-cache-logic.js is stale: run `node scripts/generate-sw-cache-logic.cjs` and commit it",
    ).toBe(committedCopy);
  });

  it("keeps every exported function a global for importScripts()", () => {
    const generated = generateSwCacheLogic(typescriptSource);
    const exported = [...typescriptSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m) => m[1],
    );

    expect(exported.length).toBeGreaterThan(0);
    expect(generated).not.toMatch(/^export /m);
    for (const name of exported) {
      expect(generated).toMatch(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
    }
  });

  it("turns async functions and exported constants into globals the footer exports", () => {
    const generated = generateSwCacheLogic(
      "// Source header.\n\nexport const LIMIT = 3;\n\nexport async function load(): Promise<number> {\n  return LIMIT;\n}\n",
    );

    expect(generated).not.toMatch(/^export /m);
    expect(generated).not.toContain("Source header.");
    expect(generated).toMatch(/^const LIMIT = 3;$/m);
    expect(generated).toMatch(/^async function load\(/m);
    expect(generated).toMatch(/module\.exports = \{\n\s+LIMIT,\n\s+load,\n/);
  });

  it.each([
    ["a default export", "export default function main() {}\n"],
    ["an export list", "function main() {}\nexport { main };\n"],
    ["an exported let", "export let count = 0;\n"],
  ])("refuses %s, which importScripts() can't run", (_label, source) => {
    expect(() => generateSwCacheLogic(source)).toThrow(/export/);
  });

  it("marks the copy as generated, so nobody edits it by hand", () => {
    expect(committedCopy.split("\n")[0]).toBe("// GENERATED FILE. Do not edit by hand.");
  });
});
