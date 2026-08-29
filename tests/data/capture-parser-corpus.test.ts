import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractUrlsFromTitle, parseCapture } from "@/lib/capture-parser";

/**
 * Runs the shared cross-platform capture-parser corpus — a byte-identical copy lives at
 * gsd-iosapp/GSDKit/Tests/GSDModelTests/Fixtures/capture-parser-corpus.json and both
 * suites execute every case, so the two parsers cannot drift apart unnoticed (the same
 * discipline as the backup fixture pair). The composition mirrors the real capture path:
 * parseCapture (capture-bar) then extractUrlsFromTitle (createTask). If a case here
 * fails, decide the correct behavior first, then change the corpus in BOTH repos and
 * both implementations together.
 */

interface CorpusCase {
  name: string;
  input: string;
  expect: {
    title: string;
    urgent: boolean;
    important: boolean;
    tags: string[];
    urls: string[];
  };
}

const corpus: { cases: CorpusCase[] } = JSON.parse(
  readFileSync(
    join(process.cwd(), "tests/fixtures/cross-platform/capture-parser-corpus.json"),
    "utf8"
  )
);

describe("cross-platform capture-parser corpus", () => {
  it("has the full corpus", () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(40);
  });

  for (const c of corpus.cases) {
    it(c.name, () => {
      const parsed = parseCapture(c.input);
      const { cleanTitle, urls } = extractUrlsFromTitle(parsed.title);
      expect({
        title: cleanTitle,
        urgent: parsed.urgent,
        important: parsed.important,
        tags: parsed.tags,
        urls,
      }).toEqual(c.expect);
    });
  }
});
