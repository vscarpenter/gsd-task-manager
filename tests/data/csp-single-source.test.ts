import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, type CspTarget } from "../../config/csp.cjs";
import {
  readProductionCsp,
  serveProductionExport,
} from "../../scripts/lib/static-export-server.cjs";

// config/csp.cjs defines the policy once. The CloudFront policy JSON and the
// Caddyfile ship as they are, so each keeps a copy. These tests fail when
// either copy drifts from the source.
const REPO_ROOT = resolve(__dirname, "../..");

interface CaddyCspLine {
  line: string;
  blocks: string[];
}

function readCloudFrontPolicy() {
  const policyPath = join(REPO_ROOT, "cloudfront/response-headers-policy.json");
  return JSON.parse(readFileSync(policyPath, "utf8"));
}

// Records the blocks around each CSP line, so a copy parked in a snippet that
// nothing imports, such as (tls_public), can't pass for the served header.
function readCaddyCspLines(): CaddyCspLine[] {
  const blocks: string[] = [];
  const cspLines: CaddyCspLine[] = [];
  for (const rawLine of readFileSync(join(REPO_ROOT, "docker/Caddyfile"), "utf8").split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#")) continue;
    if (/content-security-policy/i.test(line)) cspLines.push({ line, blocks: [...blocks] });
    else if (line === "}") blocks.pop();
    else if (line.endsWith("{")) blocks.push(line);
  }
  return cspLines;
}

// Starts the server through the entry point playwright.export.config.ts runs.
async function fetchCliEntryCsp(): Promise<string | null> {
  const outputRoot = mkdtempSync(join(tmpdir(), "gsd-csp-source-"));
  try {
    writeFileSync(join(outputRoot, "index.html"), "<html>shell</html>");
    const { server, rootUrl } = await serveProductionExport({ outputRoot, port: 0 });
    try {
      const response = await fetch(`${rootUrl}/`);
      return response.headers.get("content-security-policy");
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

describe("single CSP source", () => {
  it("should_match_the_cloudfront_policy_to_the_cloudfront_target", () => {
    const policy = readCloudFrontPolicy();

    expect(policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toBe(
      buildCsp("cloudfront"),
    );
  });

  it("should_not_send_a_second_csp_through_cloudfront_custom_headers", () => {
    const items: { Header: string }[] = readCloudFrontPolicy().CustomHeadersConfig.Items;

    expect(items.map(({ Header }) => Header.toLowerCase())).not.toContain(
      "content-security-policy",
    );
  });

  it("should_match_the_only_caddyfile_csp_header_to_the_selfhost_target", () => {
    expect(readCaddyCspLines().map(({ line }) => line)).toEqual([
      `Content-Security-Policy "${buildCsp("selfhost")}"`,
    ]);
  });

  it("should_set_the_caddyfile_csp_inside_the_site_header_block", () => {
    expect(readCaddyCspLines().map(({ blocks }) => blocks)).toEqual([
      [expect.stringMatching(/^\{\$SITE_ADDRESS/), "header {"],
    ]);
  });

  it("should_return_the_cloudfront_target_from_readProductionCsp", () => {
    expect(readProductionCsp()).toBe(buildCsp("cloudfront"));
  });

  it("should_serve_the_cloudfront_target_from_the_cli_entry_point", async () => {
    expect(await fetchCliEntryCsp()).toBe(buildCsp("cloudfront"));
  });

  it("should_reject_an_unknown_target", () => {
    expect(() => buildCsp("staging" as CspTarget)).toThrow(/Unknown CSP target "staging"/);
  });
});
