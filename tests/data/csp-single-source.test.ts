import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, type CspTarget } from "../../config/csp.cjs";
import {
  readProductionCsp,
  startStaticExportServer,
} from "../../scripts/lib/static-export-server.cjs";

// config/csp.cjs defines the policy once. The CloudFront policy JSON and the
// Caddyfile ship as they are, so each keeps a copy. These tests fail when
// either copy drifts from the source.
const REPO_ROOT = resolve(__dirname, "../..");

function readCloudFrontCsp(): string {
  const policyPath = join(REPO_ROOT, "cloudfront/response-headers-policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  return policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
}

function readCaddyCspLines(): string[] {
  return readFileSync(join(REPO_ROOT, "docker/Caddyfile"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("#") && /content-security-policy/i.test(line));
}

async function fetchExportServerCsp(): Promise<string | null> {
  const outputRoot = mkdtempSync(join(tmpdir(), "gsd-csp-source-"));
  writeFileSync(join(outputRoot, "index.html"), "<html>shell</html>");
  const { server, rootUrl } = await startStaticExportServer({
    outputRoot,
    port: 0,
    csp: readProductionCsp(),
  });

  try {
    const response = await fetch(`${rootUrl}/`);
    return response.headers.get("content-security-policy");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

describe("single CSP source", () => {
  it("should_match_the_cloudfront_policy_to_the_cloudfront_target", () => {
    expect(readCloudFrontCsp()).toBe(buildCsp("cloudfront"));
  });

  it("should_match_the_only_caddyfile_csp_header_to_the_selfhost_target", () => {
    expect(readCaddyCspLines()).toEqual([`Content-Security-Policy "${buildCsp("selfhost")}"`]);
  });

  it("should_serve_the_cloudfront_target_from_the_export_server", async () => {
    expect(await fetchExportServerCsp()).toBe(buildCsp("cloudfront"));
  });

  it("should_reject_an_unknown_target", () => {
    expect(() => buildCsp("staging" as CspTarget)).toThrow(/Unknown CSP target "staging"/);
  });
});
