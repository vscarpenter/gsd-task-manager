import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `next build` inside the Docker image type-checks every root-level TypeScript
// file in the build context. `.dockerignore` removes whole directories from
// that context, so a root file that imports from one fails the image build with
// TS2307. Pull request CI never builds the image, so this test stands in for it.
const RELATIVE_IMPORT = /from\s+["']\.\/([^/"']+)\//g;

function dockerIgnoreEntries(): string[] {
  return readFileSync(".dockerignore", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

describe("Docker build context", () => {
  it("should_keep_root_typescript_files_from_importing_dockerignored_directories", () => {
    const ignored = dockerIgnoreEntries();
    const ignoredDirectories = ignored
      .filter((entry) => entry.endsWith("/"))
      .map((entry) => entry.slice(0, -1));
    const rootFilesInContext = readdirSync(".").filter(
      (name) => /\.tsx?$/.test(name) && !ignored.includes(name)
    );

    const offenders = rootFilesInContext.flatMap((name) =>
      [...readFileSync(name, "utf8").matchAll(RELATIVE_IMPORT)]
        .filter((match) => ignoredDirectories.includes(match[1]))
        .map((match) => `${name} imports from ${match[1]}/`)
    );

    expect(offenders).toEqual([]);
  });
});
