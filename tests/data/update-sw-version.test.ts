import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

const { CACHE_VERSION_PLACEHOLDER, stampCacheVersion } = requireFromRepo(
  "./scripts/update-sw-version.cjs",
) as {
  CACHE_VERSION_PLACEHOLDER: string;
  stampCacheVersion: (source: string, version: string) => string;
};

describe("service worker cache version stamp", () => {
  it("keeps the placeholder in public/sw.js, so a build never rewrites it", () => {
    // Without the shape check, a missing export would pass: the worker contains
    // the word "undefined".
    expect(CACHE_VERSION_PLACEHOLDER).toMatch(/^const CACHE_VERSION = '[a-z]+';$/);
    expect(readFileSync("public/sw.js", "utf8")).toContain(CACHE_VERSION_PLACEHOLDER);
  });

  it("replaces the placeholder with the build's version", () => {
    const source = `// header\n${CACHE_VERSION_PLACEHOLDER}\nstartWorker();\n`;

    expect(stampCacheVersion(source, "13.8.1")).toBe(
      "// header\nconst CACHE_VERSION = '13.8.1';\nstartWorker();\n",
    );
  });

  it("refuses a worker with no placeholder, since its caches would never rotate", () => {
    expect(() => stampCacheVersion("const CACHE_VERSION = '13.8.0';\n", "13.8.1")).toThrow(
      /placeholder/,
    );
  });

  it("refuses anything but a release version, including the placeholder's own value", () => {
    expect(() => stampCacheVersion(CACHE_VERSION_PLACEHOLDER, "")).toThrow(/invalid/);
    expect(() => stampCacheVersion(CACHE_VERSION_PLACEHOLDER, "dev")).toThrow(/invalid/);
    expect(() => stampCacheVersion(CACHE_VERSION_PLACEHOLDER, "13.8.1'; evil()")).toThrow(
      /invalid/,
    );
  });
});
