import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

interface CodeShapeModule {
  compareCodeShape: (
    baseline: Record<string, Record<string, { count: number; max: number }>>,
    current: Record<string, Record<string, { count: number; max: number }>>,
  ) => string[];
}

const { compareCodeShape } = requireFromRepo("./scripts/check-code-shape.cjs") as CodeShapeModule;

describe("code-shape ratchet", () => {
  const baseline = {
    complexity: {
      "lib/existing.ts": { count: 2, max: 14 },
    },
  };

  it("accepts a per-file improvement", () => {
    const failures = compareCodeShape(baseline, {
      complexity: {
        "lib/existing.ts": { count: 1, max: 12 },
      },
    });

    expect(failures).toEqual([]);
  });

  it("rejects a new violating file", () => {
    const failures = compareCodeShape(baseline, {
      complexity: {
        "lib/existing.ts": { count: 2, max: 14 },
        "lib/new.ts": { count: 1, max: 11 },
      },
    });

    expect(failures.join("\n")).toContain("lib/new.ts");
  });

  it("rejects a worse count or maximum in an existing file", () => {
    expect(
      compareCodeShape(baseline, {
        complexity: { "lib/existing.ts": { count: 3, max: 14 } },
      }).join("\n"),
    ).toContain("count");
    expect(
      compareCodeShape(baseline, {
        complexity: { "lib/existing.ts": { count: 2, max: 16 } },
      }).join("\n"),
    ).toContain("maximum");
  });
});
