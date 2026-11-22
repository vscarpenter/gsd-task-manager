import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const HOOKS = [".claude/hooks/no-main-commits.sh", ".codex/hooks/no-main-commits.sh"];
const BLOCKED = 2;
const ALLOWED = 0;

// A developer's Git config or an enclosing Git hook must not redirect the fixtures.
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  NODE_ENV: "test" as const,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
};

type Checkout = "main checkout" | "feature" | "other" | "plain";

// [session directory, command]. {root} becomes the fixture directory.
const MUST_BLOCK: Array<[Checkout, string]> = [
  ["main checkout", "git commit -m x"],
  ["main checkout", "git  commit -m x"],
  ["main checkout", "git -c user.name=x commit -m x"],
  ["main checkout", 'git -c user.name="Some One" -c user.email="a@b.test" commit -m x'],
  ["main checkout", "git -c 'user.name=Some One' commit -m x"],
  ["main checkout", "git --no-pager commit -m x"],
  ["main checkout", "git status && git -c a.b=c commit -m x"],
  ["main checkout", "git \\\n  -c a.b=c commit -m x"],
  ["main checkout", 'bash -c "git -c a.b=c commit"'],
  ["main checkout", "git -C . commit -m x"],
  ["main checkout", 'git -C "$UNKNOWN" commit -m x'],
  ["main checkout", 'git -C "{root}/feature" commit -m x && git commit -m y'],
  ["feature", 'git -C "{root}/main checkout" commit -m x'],
  ["feature", "git -C '{root}/main checkout' commit -m x"],
  ["feature", "git -C ../main\\ checkout commit -m x"],
  ["feature", 'git -C .. -C "main checkout" commit -m x'],
  ["feature", 'git -C ~/"main checkout" commit -m x'],
  ["feature", 'git -C "$HOME/main checkout" commit -m x'],
  ["feature", 'git -c a.b=c -C "{root}/main checkout" commit -m x'],
  ["feature", 'git -C "{root}/main checkout" -c a.b=c commit -m x'],
  ["feature", 'echo "don\'t"\ngit -C "{root}/main checkout" commit -m \'x\''],
  ["feature", 'git -C . commit -m x; git -C "{root}/main checkout" commit -m y'],
  ["plain", 'git -C "{root}/main checkout" commit -m x'],
  ["feature", String.raw`git -C "../main's \"copy\" \\b" commit -m x`],
  ["feature", String.raw`git -C '../main'\''s "copy" \b' commit -m x`],
  ["feature", String.raw`git -C ../main\'s\ \"copy\"\ \\b commit -m x`],
];

const MUST_ALLOW: Array<[Checkout, string]> = [
  ["main checkout", "git switch -c fix/something"],
  ["main checkout", "git -c color.ui=never log --grep commit"],
  ["main checkout", "git --no-pager show commit"],
  ["main checkout", "git -C . status && echo commit"],
  ["main checkout", "git -c a.b=c commit-graph write"],
  ["main checkout", 'git -C "{root}/feature" commit -m x'],
  ["main checkout", "git -C ../feature -c a.b=c commit -m x"],
  ["main checkout", 'git -C "{root}/other" commit -m x'],
  ["feature", "git commit -m x"],
  ["feature", "git -c user.name=x commit -m x"],
  ["feature", 'git -C "{root}/other" commit -m x'],
  ["feature", 'git -C "$UNKNOWN" commit -m x'],
  ["feature", 'git commit -m "fix: catch git -C <dir> commit"'],
  ["main checkout", String.raw`git -C "../feature's \"copy\" \\b" commit -m x`],
  ["main checkout", String.raw`git -C '../feature'\''s "copy" \b' commit -m x`],
  ["main checkout", String.raw`git -C ../feature\'s\ \"copy\"\ \\b commit -m x`],
];

describe.each(HOOKS)("%s", (hook) => {
  let root: string;

  function git(...args: string[]): void {
    const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.test"];
    execFileSync("git", [...identity, ...args], { cwd: root, env: GIT_ENV, stdio: "pipe" });
  }

  function runHook(checkout: Checkout, command: string): number | null {
    const payload = {
      cwd: join(root, checkout),
      tool_input: { command: command.replaceAll("{root}", root) },
    };
    return spawnSync("bash", [join(root, "main checkout", hook)], {
      cwd: payload.cwd,
      env: { ...GIT_ENV, HOME: root },
      input: JSON.stringify(payload),
      encoding: "utf8",
    }).status;
  }

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gsd-commit-guard-"));
    mkdirSync(join(root, "plain"));
    for (const repo of ["main checkout", "other"]) {
      git("init", "-q", "-b", "main", repo);
      git("-C", repo, "commit", "-q", "--allow-empty", "-m", "init");
    }
    git("-C", "main checkout", "worktree", "add", "-q", "-b", "fix/example", "../feature");

    // Second names for both checkouts, using each character that shell quoting treats specially.
    symlinkSync(join(root, "main checkout"), join(root, String.raw`main's "copy" \b`));
    symlinkSync(join(root, "feature"), join(root, String.raw`feature's "copy" \b`));

    const installed = join(root, "main checkout", hook);
    mkdirSync(dirname(installed), { recursive: true });
    copyFileSync(join(__dirname, "..", "..", hook), installed);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each(MUST_BLOCK)("blocks from %s: %s", (checkout, command) => {
    expect(runHook(checkout, command)).toBe(BLOCKED);
  });

  it.each(MUST_ALLOW)("allows from %s: %s", (checkout, command) => {
    expect(runHook(checkout, command)).toBe(ALLOWED);
  });
});
