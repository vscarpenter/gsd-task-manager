import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-openwiki-freshness.sh");

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}\n${result.stdout}`);
  }

  return result;
}

function write(repo: string, path: string, content: string) {
  const filePath = join(repo, path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function commit(repo: string, message: string) {
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", message], repo);
}

function runFreshness(repo: string, githubActions = false) {
  return spawnSync("bash", [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, GITHUB_ACTIONS: githubActions ? "true" : "" },
  });
}

function withFreshOpenWikiRepo(test: (repo: string) => void) {
  const repo = mkdtempSync(join(tmpdir(), "openwiki-freshness-"));

  try {
    run("git", ["init"], repo);
    run("git", ["config", "user.email", "test@example.com"], repo);
    run("git", ["config", "user.name", "Test User"], repo);
    write(repo, "app/page.tsx", "export default function Page() { return null; }\n");
    write(repo, "openwiki/.last-update.json", '{"gitHead":"pending"}\n');
    commit(repo, "initial source");

    const baseline = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
    write(repo, "openwiki/.last-update.json", JSON.stringify({ gitHead: baseline }, null, 2));
    commit(repo, "record openwiki update");

    test(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

describe("check-openwiki-freshness.sh", () => {
  it("warns but exits zero when doc-affecting source changed since the recorded gitHead", () => {
    withFreshOpenWikiRepo((repo) => {
      write(repo, "app/page.tsx", "export default function Page() { return <main />; }\n");
      commit(repo, "change app source");

      const result = runFreshness(repo);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("WARN: OpenWiki docs may be stale");
      expect(result.stdout).toContain("1 doc-affecting file(s) changed");
      expect(result.stdout).toContain("  - app/page.tsx");
    });
  });

  it("ignores OpenWiki output and the generated-site builder when checking freshness", () => {
    withFreshOpenWikiRepo((repo) => {
      write(repo, "openwiki/quickstart.md", "# Updated generated docs\n");
      write(repo, "scripts/build-openwiki-site.cjs", "console.log('rebuilt docs');\n");
      commit(repo, "update generated docs");

      const result = runFreshness(repo);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("OpenWiki is fresh");
      expect(result.stdout).not.toContain("WARN:");
      expect(result.stdout).not.toContain("Changed files:");
    });
  });

  it("emits GitHub Actions warning annotations without failing when metadata is missing", () => {
    const repo = mkdtempSync(join(tmpdir(), "openwiki-freshness-missing-"));

    try {
      run("git", ["init"], repo);

      const result = runFreshness(repo, true);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("::warning::No openwiki/.last-update.json");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
