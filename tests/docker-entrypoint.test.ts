import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "docker", "docker-entrypoint.sh");

/** 32 characters, the length the entrypoint requires before it does anything else. */
const ENC_KEY = "0123456789abcdef0123456789abcdef";

/**
 * Run the entrypoint far enough to observe how it resolved TLS. The script
 * always fails afterwards outside a container, because the migration step
 * copies from absolute image paths, so these tests assert on the TLS
 * diagnostics rather than on the exit code alone.
 */
function runEntrypoint(env: Record<string, string>): string {
  const result = spawnSync("bash", [SCRIPT], {
    env: { PATH: "/usr/bin:/bin", HOME: tmpdir(), GSD_TASKS_ENC_KEY: ENC_KEY, ...env },
    encoding: "utf8",
  });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function readableCertAndKey(): { cert: string; key: string } {
  const dir = mkdtempSync(join(tmpdir(), "gsd-tls-"));
  const cert = join(dir, "cert.pem");
  const key = join(dir, "key.pem");
  writeFileSync(cert, "certificate");
  writeFileSync(key, "private key");
  return { cert, key };
}

describe("docker-entrypoint.sh TLS mode", () => {
  it("honors a legacy TLS_CERT/TLS_KEY pair when TLS_MODE is unset", () => {
    // docker-compose.yml and docker-setup-and-run.md have always configured a
    // custom certificate as this bare pair. Treating that as `internal` swaps a
    // trusted certificate for Caddy's private CA, which breaks browser trust
    // and every OAuth callback, with nothing logged.
    const { cert, key } = readableCertAndKey();

    const output = runEntrypoint({ TLS_CERT: cert, TLS_KEY: key });

    expect(output).not.toContain("FATAL: custom TLS certificate or key is not readable");
    expect(output).toContain("[gsd] TLS mode: custom");
  });

  it("fails loudly when an inferred custom certificate is unreadable", () => {
    const output = runEntrypoint({
      TLS_CERT: "/nonexistent/cert.pem",
      TLS_KEY: "/nonexistent/key.pem",
    });

    expect(output).toContain("FATAL: custom TLS certificate or key is not readable");
  });

  it("stays on the internal certificate when no legacy pair is configured", () => {
    const output = runEntrypoint({});

    expect(output).toContain("[gsd] TLS mode: internal");
    expect(output).not.toContain("FATAL: TLS");
    expect(output).not.toContain("FATAL: custom TLS");
  });

  it("still rejects an unknown TLS_MODE", () => {
    const output = runEntrypoint({ TLS_MODE: "bogus" });

    expect(output).toContain("FATAL: TLS_MODE must be internal, public, or custom");
  });

  it("still requires both paths when TLS_MODE=custom is explicit", () => {
    const output = runEntrypoint({ TLS_MODE: "custom" });

    expect(output).toContain("FATAL: TLS_CERT and TLS_KEY are required when TLS_MODE=custom");
  });
});
