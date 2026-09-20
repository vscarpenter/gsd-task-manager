import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documentation currentness", () => {
  it("keeps the README release and shipped-shell claims current", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain(`Current version:** ${packageJson.version}`);
    expect(readme).toContain("Release documentation checklist");
    expect(readme).not.toMatch(/### Batch Operations|Smart View Pinning|Quick Settings Panel/);
  });

  it("documents the executable security gates and both encryption migrations", () => {
    const security = readFileSync("SECURITY.md", "utf8");
    const boundaries = readFileSync("docs/security-trust-boundaries.md", "utf8");

    expect(security).toContain("bun audit --audit-level=high");
    expect(security).toContain("bun run license:check");
    expect(security).not.toContain("bun pm audit");
    expect(security).not.toMatch(/automated security updates via Dependabot\/Renovate/i);
    expect(boundaries).toContain("1781100000_harden_task_encryption_cleanup.js");
    expect(boundaries).toContain("pocketbase-upgrade-system.test.ts");
  });

  it("scopes at-rest encryption to the Docker image and states the hosted posture", () => {
    const security = readFileSync("SECURITY.md", "utf8");
    const adrPath = "docs/adr/0016-hosted-sync-defers-field-encryption.md";

    expect(security).toMatch(/hosted service does not encrypt task content at rest/i);
    expect(security).not.toContain("the user owns and controls the server");
    expect(security).not.toContain("runs on user's own infrastructure");
    expect(security).not.toContain("Tasks are stored on user's own PocketBase server");
    expect(security).toContain(adrPath);
    expect(existsSync(adrPath)).toBe(true);
  });

  it("ships contributor guidance with the canonical local commands", () => {
    expect(existsSync("CONTRIBUTING.md")).toBe(true);
    const contributing = readFileSync("CONTRIBUTING.md", "utf8");

    expect(contributing).toContain("bun run test");
    expect(contributing).toContain("bun typecheck");
    expect(contributing).toContain("bun lint");
    expect(contributing).toContain("bun run build");
  });
});
