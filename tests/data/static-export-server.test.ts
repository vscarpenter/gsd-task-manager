import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  readProductionCsp,
  resolveExportFile,
  startStaticExportServer,
} from "../../scripts/lib/static-export-server.cjs";

// Turbopack content hashes can carry `..` inside a filename. The CloudFront
// function treats `..` as traversal only when it is a whole path segment.
const DOTTED_CHUNK = "_next/static/chunks/09g3a9~1ks65..js";

describe("static export server", () => {
  let outputRoot: string;

  beforeAll(() => {
    outputRoot = mkdtempSync(join(tmpdir(), "gsd-export-"));
    mkdirSync(join(outputRoot, "about"));
    mkdirSync(join(outputRoot, "_next/static/chunks"), { recursive: true });
    writeFileSync(join(outputRoot, "index.html"), "<html>shell</html>");
    writeFileSync(join(outputRoot, "index.md"), "# shell");
    writeFileSync(join(outputRoot, "about/index.html"), "<html>about</html>");
    writeFileSync(join(outputRoot, DOTTED_CHUNK), "export {};");
  });

  afterAll(() => {
    rmSync(outputRoot, { recursive: true, force: true });
  });

  it("should_resolve_route_paths_to_their_index_html", () => {
    expect(resolveExportFile(outputRoot, "/", {})).toBe(join(outputRoot, "index.html"));
    expect(resolveExportFile(outputRoot, "/about/", {})).toBe(join(outputRoot, "about/index.html"));
    expect(resolveExportFile(outputRoot, "/about", {})).toBe(join(outputRoot, "about/index.html"));
  });

  it("should_serve_an_asset_whose_filename_contains_two_dots", () => {
    expect(resolveExportFile(outputRoot, `/${DOTTED_CHUNK}`, {})).toBe(join(outputRoot, DOTTED_CHUNK));
  });

  it("should_fall_back_to_the_app_shell_for_unknown_traversal_and_api_paths", () => {
    const shell = join(outputRoot, "index.html");

    expect(resolveExportFile(outputRoot, "/no-such-route/", {})).toBe(shell);
    expect(resolveExportFile(outputRoot, "/_next/static/chunks/missing.js", {})).toBe(shell);
    expect(resolveExportFile(outputRoot, "/about/%2e%2e/%2e%2e/etc/passwd", {})).toBe(shell);
    expect(resolveExportFile(outputRoot, "/api/pwa-audit-probe", {})).toBe(shell);
  });

  it("should_serve_markdown_when_the_client_prefers_it", () => {
    const headers = { accept: "text/markdown, text/html;q=0.5" };

    expect(resolveExportFile(outputRoot, "/", headers)).toBe(join(outputRoot, "index.md"));
  });

  it("should_send_the_production_csp_only_when_configured", async () => {
    const csp = readProductionCsp();
    const withCsp = await startStaticExportServer({ outputRoot, port: 0, csp });
    const withoutCsp = await startStaticExportServer({ outputRoot, port: 0 });

    try {
      const guarded = await fetch(`${withCsp.rootUrl}/about/`);
      const plain = await fetch(`${withoutCsp.rootUrl}/about/`);

      expect(csp).toContain("script-src 'self'");
      expect(guarded.status).toBe(200);
      expect(await guarded.text()).toBe("<html>about</html>");
      expect(guarded.headers.get("content-security-policy")).toBe(csp);
      expect(guarded.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(plain.headers.get("content-security-policy")).toBeNull();
    } finally {
      await new Promise((resolveClose) => withCsp.server.close(resolveClose));
      await new Promise((resolveClose) => withoutCsp.server.close(resolveClose));
    }
  });

  it("should_reject_when_the_export_is_missing", async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "gsd-export-empty-"));

    try {
      await expect(startStaticExportServer({ outputRoot: emptyRoot, port: 0 })).rejects.toThrow(
        /bun run build/
      );
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
