import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("source type safety", () => {
  it("does not use explicit any at the audited production boundary", () => {
    const sources = [
      "docker/pb_hooks/encryption-core.d.ts",
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of sources) {
      expect(source).not.toMatch(/\bany\b/);
    }
  });
});
