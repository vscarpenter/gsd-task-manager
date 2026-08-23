import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The checkout directory is `gsd-taskmanager`, but the GitHub repository is
// `gsd-task-manager`. GitHub does not redirect the un-hyphenated form, so every
// URL built from the directory name 404s. This guard fails the moment one
// reappears, in source, docs, or the .well-known discovery surface.
const DEAD_SLUG = "vscarpenter/gsd-taskmanager";

// This file is excluded from its own search: it has to name the slug to test
// for it.
const SELF = "tests/data/repository-urls.test.ts";

const filesReferencingDeadSlug = (): string[] => {
  const result = spawnSync(
    "git",
    ["grep", "--files-with-matches", "--fixed-strings", DEAD_SLUG, "--", ".", `:!${SELF}`],
    { encoding: "utf-8" },
  );

  // git grep exits 1 to mean "no matches", which is the passing case here.
  if (result.status === 1) return [];
  if (result.status !== 0) {
    throw new Error(`git grep failed (status ${result.status}): ${result.stderr}`);
  }

  return result.stdout.split("\n").filter(Boolean);
};

describe("GitHub repository URLs", () => {
  it("never reference the un-hyphenated repository slug", () => {
    // Prose that discusses this bug trips the guard too. Refer to the bad
    // repo by its bare name, never the full owner/name path.
    expect(filesReferencingDeadSlug()).toEqual([]);
  });
});
