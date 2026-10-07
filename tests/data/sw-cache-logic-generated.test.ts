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
    // If this fails, run `node scripts/generate-sw-cache-logic.cjs` and commit
    // public/sw-cache-logic.js. Never edit the generated copy by hand.
    expect(generateSwCacheLogic(typescriptSource)).toBe(committedCopy);
  });

  it("keeps every exported function a global for importScripts()", () => {
    const generated = generateSwCacheLogic(typescriptSource);
    const exported = [...typescriptSource.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);

    expect(exported.length).toBeGreaterThan(0);
    expect(generated).not.toMatch(/^export /m);
    for (const name of exported) {
      expect(generated).toMatch(new RegExp(`^function ${name}\\(`, "m"));
    }
  });

  it("marks the copy as generated, so nobody edits it by hand", () => {
    expect(committedCopy.split("\n")[0]).toBe("// GENERATED FILE. Do not edit by hand.");
  });
});
