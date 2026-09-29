import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkManifest,
  harnessPathsFor,
  PROTECTED_HARNESS_PATHS,
} from "../../tools/stagehand/eval/run-eval.mjs";
import { summarize } from "../../tools/stagehand/eval/summarize.mjs";

const RUNNER = path.join(__dirname, "../../tools/stagehand/eval/run-eval.mjs");

describe("harnessPathsFor", () => {
  it("protects the executed harness even when _state.json lists nothing", () => {
    const paths = harnessPathsFor([]);
    for (const required of [
      "tools/stagehand/eval/cases.json",
      "tools/stagehand/eval/summarize.mjs",
      "tools/stagehand/verify.ts",
      "tools/stagehand/harness.ts",
      "tools/stagehand/page-scripts/seed-tasks.js",
    ]) {
      expect(paths).toContain(required);
    }
  });

  it("adds extra listed paths without duplicating protected ones", () => {
    const paths = harnessPathsFor(["tools/stagehand/verify.ts", "extra/file.ts"]);
    expect(paths).toContain("extra/file.ts");
    expect(paths.filter((p: string) => p === "tools/stagehand/verify.ts")).toHaveLength(1);
  });

  it("lists only files that exist in the repo", () => {
    for (const p of PROTECTED_HARNESS_PATHS) {
      expect(() => readFileSync(path.join(__dirname, "../..", p))).not.toThrow();
    }
  });
});

describe("checkManifest", () => {
  const current = { model: "claude-haiku-4-5", cases_sha: "abc" };

  it("asks to write a manifest for a fresh variant", () => {
    expect(checkManifest(null, current, false)).toEqual({ action: "write" });
  });

  it("accepts a resume with the same model and case set", () => {
    expect(checkManifest(current, current, true)).toEqual({ action: "ok" });
  });

  it("refuses to resume under a different model", () => {
    const result = checkManifest(current, { ...current, model: "claude-sonnet-5" }, true);
    expect(result.action).toBe("refuse");
    expect(result.reason).toMatch(/model/);
  });

  it("refuses to resume after cases.json changed", () => {
    const result = checkManifest(current, { ...current, cases_sha: "def" }, true);
    expect(result.action).toBe("refuse");
    expect(result.reason).toMatch(/cases/);
  });

  it("refuses rows that predate any manifest", () => {
    expect(checkManifest(null, current, true).action).toBe("refuse");
  });
});

describe("runner module", () => {
  it("does not import the summarizer before the integrity gate", () => {
    const source = readFileSync(RUNNER, "utf8");
    expect(source).not.toMatch(/^import[^;]*summarize\.mjs/m);
  });
});

describe("summarize cost", () => {
  it("counts billed usage carried on unresolved error rows", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "judge-summary-"));
    const cases = [{ id: "a", expected: true }, { id: "b", expected: false }];
    const usage = { input_tokens: 1_000_000, output_tokens: 0 };
    writeFileSync(
      path.join(dir, "results.jsonl"),
      `${JSON.stringify({ prompt_id: "a", rep: 0, tags: ["x"], model: "claude-haiku-4-5", usage, said_met: true, grade: { correct: 1 } })}\n`
    );
    writeFileSync(
      path.join(dir, "errors.jsonl"),
      `${JSON.stringify({ prompt_id: "b", rep: 0, failure_class: "harness_error", model: "claude-haiku-4-5", usage })}\n`
    );
    expect(summarize(dir, cases)).toMatch(/cost\s+\$2\.0000/);
  });
});
