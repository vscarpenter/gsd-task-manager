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

  // SEC-027: `COPY . .` must not carry an encryption key or an agent's config
  // into the builder stage. `.env` patterns need `**/` to reach `docker/.env`,
  // and a root-only `.*` drops every root tool folder without listing each one.
  // A nested `**/.*` would also drop `public/.well-known/`, which the site serves.
  it("should_exclude_env_files_at_any_depth_and_every_root_dot_entry", () => {
    const ignored = dockerIgnoreEntries();

    expect(ignored).toEqual(expect.arrayContaining(["**/.env", "**/.env.*", ".*"]));
    expect(ignored).not.toContain("**/.*");
  });
});
