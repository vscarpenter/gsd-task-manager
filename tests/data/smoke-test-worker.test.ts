import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

// Serves just enough for scripts/smoke-test.sh to reach its sw.js check.
async function withSite<T>(workerSource: string, run: (siteUrl: string) => Promise<T>): Promise<T> {
  const server = createServer((request, response) => {
    if (request.url === "/sw.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(workerSource);
      return;
    }
    response.statusCode = request.url === "/" ? 200 : 404;
    response.end("<html></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

async function runSmokeTest(siteUrl: string) {
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["scripts/smoke-test.sh"], {
      env: { ...process.env, SITE_URL: siteUrl },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? null, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

describe("post-deploy smoke test, service worker check", () => {
  it("fails a deploy whose worker still carries the 'dev' placeholder", async () => {
    const result = await withSite("const CACHE_VERSION = 'dev';\n", runSmokeTest);

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/placeholder/);
  });

  it("accepts a worker with a stamped version", async () => {
    // The fake site has no discovery files, so the script fails at a later
    // check; the worker check itself must pass first.
    const result = await withSite("const CACHE_VERSION = '13.8.1';\n", runSmokeTest);

    expect(result.stdout).toContain("sw.js served correctly");
    expect(result.stderr).not.toMatch(/placeholder/);
  });
});
