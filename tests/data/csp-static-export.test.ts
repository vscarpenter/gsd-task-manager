import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { externalizeInlineAssets } from "../../scripts/externalize-inline-assets.cjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("static export CSP hardening", () => {
  it("moves executable scripts and style blocks to same-origin assets", () => {
    const output = mkdtempSync(join(tmpdir(), "gsd-csp-export-"));
    temporaryDirectories.push(output);
    mkdirSync(join(output, "nested"));
    writeFileSync(
      join(output, "nested", "index.html"),
      '<html><head><style media="screen">body{color:red}</style></head><body>' +
        '<script>self.__next_f=self.__next_f||[]</script>' +
        '<script type="application/json">{"safe":true}</script></body></html>',
    );

    const result = externalizeInlineAssets(output);
    const html = readFileSync(join(output, "nested", "index.html"), "utf8");

    expect(result.executableScripts).toBe(1);
    expect(result.styleBlocks).toBe(1);
    expect(html).toMatch(/<script src="\/_next\/static\/csp-inline\/[0-9a-f]+\.js"><\/script>/);
    expect(html).toMatch(/<link rel="stylesheet" href="\/_next\/static\/csp-inline\/[0-9a-f]+\.css" media="screen">/);
    expect(html).toContain('<script type="application/json">{"safe":true}</script>');
    expect(html).not.toContain("<script>self.__next_f");
    expect(html).not.toContain("<style");
  });

  it("configures a same-origin production script policy", () => {
    const cloudFront = JSON.parse(readFileSync("cloudfront/response-headers-policy.json", "utf8"));
    const cloudFrontCsp =
      cloudFront.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    const caddy = readFileSync("docker/Caddyfile", "utf8");
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(cloudFrontCsp).toContain("script-src 'self'");
    expect(cloudFrontCsp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(cloudFrontCsp).toContain("style-src-elem 'self'");
    expect(cloudFrontCsp).toContain("style-src-attr 'unsafe-inline'");
    expect(caddy).toContain("script-src 'self'");
    expect(caddy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    // Both deployments must agree, or the Docker build reintroduces the bug.
    for (const csp of [cloudFrontCsp, caddy]) {
      const styleSrcElem = csp.match(/style-src-elem[^;]*/)?.[0] ?? "";
      expect(styleSrcElem).toContain("'unsafe-inline'");
      expect(styleSrcElem).not.toContain("sha256-");
    }
    expect(layout).toContain('process.env.NODE_ENV === "development"');
    expect(readFileSync("components/theme-provider.tsx", "utf8")).toContain(
      'scriptProps={{ src: "/theme-init.js" }}',
    );
    expect(readFileSync("public/theme-init.js", "utf8")).toContain("initializeTheme");
    expect(readFileSync("lib/zod.ts", "utf8")).toContain("z.config({ jitless: true })");
  });

  it("runs a production browser smoke test in blocking Chromium CI", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(packageJson.scripts["test:csp"]).toBeDefined();
    expect(workflow).toContain("bun run test:csp");
    expect(workflow).toContain("matrix.browser == 'chromium'");
  });
});
