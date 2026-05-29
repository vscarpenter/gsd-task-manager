import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";

/**
 * Guardrail for audit finding F2.1 (coverage-padding test files).
 *
 * Test files must be named for the behavior or module they cover — never for a
 * coverage metric. Files like `coverage-boost.test.ts`, `gap-closing.test.tsx`,
 * or `last-function-push.test.ts` were written to pad the 80% coverage gate;
 * they obscured which behavior was actually verified and let real coverage
 * regressions slip through. This test fails if such a file reappears, so the
 * cleanup can't silently un-happen under deadline pressure.
 *
 * If this fails: rename the offending file to the component/module it tests, or
 * fold its cases into that module's canonical test file.
 */
const PADDING_NAME =
  /(coverage|boost|gap-closing|function-push|function-final|function-coverage)/i;

describe("test suite hygiene", () => {
  it("contains no coverage-padding test file names", () => {
    const offenders = readdirSync("tests", { recursive: true })
      .map(String)
      .filter((file) => /\.test\.tsx?$/.test(file) && PADDING_NAME.test(file));

    expect(offenders).toEqual([]);
  });
});
