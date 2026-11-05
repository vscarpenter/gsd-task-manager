import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideWhatsNew, type WhatsNewDecision } from "@/lib/whats-new/decide";

/**
 * Runs the shared cross-platform What's New corpus. Byte-identical copies live in the
 * iOS and Android repos and every suite executes every case, so the three clients
 * agree on when the post-update line shows. The corpus is frozen: if a case looks
 * wrong, change the spec (tasks/spec-whats-new.md) and all three repos together.
 */

interface CorpusCase {
  name: string;
  currentVersion: string;
  lastSeenVersion: string | null;
  existingUser: boolean;
  expect: WhatsNewDecision;
}

const corpus: {
  version: number;
  releases: Array<{ version: string; notable: boolean }>;
  cases: CorpusCase[];
} = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/cross-platform/whats-new-corpus.json"), "utf8")
);

describe("cross-platform What's New corpus", () => {
  it("has the full version 1 corpus", () => {
    expect(corpus.version).toBe(1);
    expect(corpus.cases).toHaveLength(21);
  });

  for (const c of corpus.cases) {
    it(c.name, () => {
      expect(
        decideWhatsNew({
          releases: corpus.releases,
          currentVersion: c.currentVersion,
          lastSeenVersion: c.lastSeenVersion,
          existingUser: c.existingUser,
        })
      ).toEqual(c.expect);
    });
  }
});
