import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "deploy-app.sh");

/**
 * Stand-in for the AWS CLI. It records every invocation and mirrors the one
 * real behavior this suite depends on: `s3 cp` of a local source that does not
 * exist is an error, not a no-op.
 */
function stubAws(): { dir: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), "deploy-aws-"));
  const log = join(dir, "aws-calls.txt");
  writeFileSync(
    join(dir, "aws"),
    [
      "#!/bin/bash",
      `echo "$@" >> "${log}"`,
      'if [ "$1" = "s3" ] && [ "$2" = "cp" ]; then',
      '  case "$3" in',
      "    s3://*) ;;",
      '    *) if [ ! -f "$3" ]; then',
      '         echo "The user-provided path $3 does not exist." >&2',
      "         exit 255",
      "       fi ;;",
      "  esac",
      "fi",
      'if [ "$1" = "cloudfront" ] && [ "$2" = "create-invalidation" ]; then',
      '  echo "I2EXAMPLE"',
      "fi",
      "exit 0",
    ].join("\n") + "\n"
  );
  chmodSync(join(dir, "aws"), 0o755);
  return { dir, log };
}

/** A static export as it exists on disk, with only the files a release shipped. */
function workspaceWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "deploy-out-"));
  mkdirSync(join(root, "out"), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, "out", name), body);
  }
  return root;
}

function deploy(workspace: string, stubDir: string): string {
  return execFileSync("bash", [SCRIPT], {
    cwd: workspace,
    env: {
      ...process.env,
      PATH: [stubDir, "/usr/bin", "/bin"].join(":"),
      S3_BUCKET: "s3://example-bucket",
      CLOUDFRONT_ID: "E1EXAMPLE",
      ENV_LABEL: "Production",
      SITE_URL: "https://example.test",
      GITHUB_OUTPUT: "",
    },
    encoding: "utf8",
  });
}

describe("deploy-app.sh", () => {
  it("invalidates CloudFront even when the build predates theme-init.js", () => {
    // The documented rollback dispatches main's deploy-app.sh against an older
    // release artifact. Releases before v12 have no public/theme-init.js, and
    // the S3 syncs above this step are destructive, so aborting here would
    // leave production overwritten and still served from the edge cache.
    const { dir, log } = stubAws();
    const workspace = workspaceWith({ "index.html": "<!doctype html>" });

    const output = deploy(workspace, dir);

    expect(readFileSync(log, "utf8")).toContain("cloudfront create-invalidation");
    expect(output).toContain("Deployment to Production complete!");
  });

  it("forces theme-init.js metadata when the build ships it", () => {
    const { dir, log } = stubAws();
    const workspace = workspaceWith({
      "index.html": "<!doctype html>",
      "theme-init.js": "/* theme */",
    });

    deploy(workspace, dir);

    const calls = readFileSync(log, "utf8");
    expect(calls).toMatch(/s3 cp out\/theme-init\.js s3:\/\/example-bucket\/theme-init\.js/);
    expect(calls).toContain("--content-type application/javascript");
  });
});
