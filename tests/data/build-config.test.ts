import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const requireFromRepo = createRequire(resolve(process.cwd(), "package.json"));

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
}

const SETUP_NODE_22 =
  /uses: actions\/setup-node@[0-9a-f]{40} # v7\n\s+with:\n\s+node-version: '22'\n/;

function workflowJob(workflow: string, job: string): string {
  const start = workflow.indexOf(`\n  ${job}:\n`);
  if (start === -1) return "";
  const body = workflow.slice(start + 1);
  const next = body.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? body : body.slice(0, next + 1);
}

interface TypeScriptModule {
  createProgram?: unknown;
  version?: string;
}

function firstNumericMajor(versionRange: string): number | null {
  const match = versionRange.match(/\d+/);
  return match ? Number(match[0]) : null;
}

const FIXTURE_BUILD_VERSION = "9.9.9";

function fakeNextBuild(options: { createArtifact?: boolean; exitCode?: number }) {
  // The real export copies public/sw.js to out/sw.js; the fake one copies the
  // fixture's worker, written next to it.
  return [
    "#!/usr/bin/env bash",
    "echo 'fixture next build'",
    options.createArtifact ? "mkdir -p out && printf '<html></html>' > out/index.html" : "true",
    options.createArtifact ? "cp exported-sw.js out/sw.js" : "true",
    `exit ${options.exitCode ?? 0}`,
    "",
  ].join("\n");
}

function runStaticBuildWrapper(options: {
  createArtifact?: boolean;
  exportedWorker?: string;
  exitCode?: number;
}): { status: number | null; stdout: string; exportedWorker: string | null } {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "gsd-static-build-"));
  const fixtureScripts = join(fixtureRoot, "scripts");
  const fixtureBin = join(fixtureRoot, "bin");
  mkdirSync(fixtureScripts);
  mkdirSync(fixtureBin);

  const wrapper = readFileSync("scripts/build-static-export.sh", "utf8");
  writeFileSync(join(fixtureScripts, "build-static-export.sh"), wrapper);
  for (const script of ["externalize-inline-assets.cjs", "update-sw-version.cjs"]) {
    writeFileSync(join(fixtureScripts, script), readFileSync(`scripts/${script}`, "utf8"));
  }
  writeFileSync(
    join(fixtureRoot, ".build-env.sh"),
    `export PATH=${JSON.stringify(`${fixtureBin}:${process.env.PATH ?? ""}`)}\n`,
  );
  writeFileSync(join(fixtureRoot, ".build-info.json"), JSON.stringify({ version: FIXTURE_BUILD_VERSION }));
  writeFileSync(
    join(fixtureRoot, "exported-sw.js"),
    options.exportedWorker ?? readFileSync("public/sw.js", "utf8"),
  );
  writeFileSync(join(fixtureBin, "next"), fakeNextBuild(options));
  chmodSync(join(fixtureBin, "next"), 0o755);

  const readExportedWorker = () => {
    try {
      return readFileSync(join(fixtureRoot, "out/sw.js"), "utf8");
    } catch {
      return null;
    }
  };

  try {
    const stdout = execFileSync("bash", ["scripts/build-static-export.sh"], {
      cwd: fixtureRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, exportedWorker: readExportedWorker() };
  } catch (error) {
    const failure = error as { status?: number | null; stdout?: Buffer | string };
    return {
      status: failure.status ?? null,
      stdout: String(failure.stdout ?? ""),
      exportedWorker: readExportedWorker(),
    };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

describe("build configuration", () => {
  it("runs TypeScript 7 alongside the TypeScript 6 compiler API", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const nativeVersion = packageJson.devDependencies?.["@typescript/native"];
    const compatibilityVersion = packageJson.devDependencies?.typescript;

    expect(nativeVersion).toBeDefined();
    expect(compatibilityVersion).toBeDefined();
    expect(firstNumericMajor(nativeVersion!)).toBe(7);
    expect(firstNumericMajor(compatibilityVersion!)).toBe(6);
    expect(packageJson.scripts?.typecheck).toContain("@typescript/native");

    const typescript = requireFromRepo("typescript") as TypeScriptModule;
    const cliVersion = execFileSync(
      resolve(process.cwd(), "node_modules/@typescript/native/bin/tsc"),
      ["--version"],
      { encoding: "utf8" },
    ).trim();

    expect(firstNumericMajor(typescript.version ?? "")).toBeLessThan(7);
    expect(typeof typescript.createProgram).toBe("function");
    expect(cliVersion).toMatch(/^Version 7\./);
  });

  it("pins Turbopack root to the project config directory", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toMatch(/turbopack:\s*\{\s*root:\s*__dirname\s*\}/);
  });

  it("keeps the build-date fallback off the clock so dev never hydrate-mismatches", () => {
    const configSource = readFileSync("next.config.ts", "utf8");
    const fallbackLine = configSource
      .split("\n")
      .find((line) => line.includes("NEXT_PUBLIC_BUILD_DATE") && line.includes("??"));

    expect(fallbackLine).toBeDefined();
    // `next dev` never sources .build-env.sh, so this fallback is the value the
    // dev server inlines. Deriving it from the clock makes the prerendered
    // markup and a later-compiled client chunk disagree whenever the two span a
    // UTC midnight, which React reports as a hydration mismatch — a scary
    // console error that can mask real ones. Production is unaffected either
    // way (the build script pins the env var), so the fallback should simply
    // not depend on the current time.
    expect(fallbackLine).not.toMatch(/new Date\(/);
  });

  it("delegates production builds to the fail-closed static-export wrapper", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;

    expect(packageJson.scripts?.build).toContain("bash scripts/build-static-export.sh");
    expect(packageJson.scripts?.build).not.toContain("next build 2>&1 | grep");
  });

  it("preserves a failing next build exit status through output filtering", () => {
    const result = runStaticBuildWrapper({ exitCode: 42 });

    expect(result.stdout).toContain("fixture next build");
    expect(result.status).toBe(42);
  });

  it("rejects a successful build command that did not export the app shell", () => {
    expect(runStaticBuildWrapper({ exitCode: 0 }).status).not.toBe(0);
    expect(runStaticBuildWrapper({ createArtifact: true, exitCode: 0 }).status).toBe(0);
  });

  it("stamps the build's cache version into the exported worker", () => {
    const result = runStaticBuildWrapper({ createArtifact: true });

    expect(result.status).toBe(0);
    expect(result.exportedWorker).toContain(`const CACHE_VERSION = '${FIXTURE_BUILD_VERSION}';`);
    expect(result.exportedWorker).not.toContain("const CACHE_VERSION = 'dev';");
  });

  it("fails the build when the exported worker has no placeholder to stamp", () => {
    // A deployed worker that kept an old version would never rotate its caches.
    const result = runStaticBuildWrapper({
      createArtifact: true,
      exportedWorker: "const CACHE_VERSION = '13.8.0';\n",
    });

    expect(result.status).not.toBe(0);
  });

  it("never stamps the tracked public/sw.js on any build path", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const builderStage = readFileSync("docker/Dockerfile", "utf8").split(/^FROM /m)[1] ?? "";
    const wrapper = readFileSync("scripts/build-static-export.sh", "utf8");

    expect(packageJson.scripts?.build).not.toContain("update-sw-version");
    expect(builderStage).not.toContain("update-sw-version");
    expect(wrapper).toContain("node scripts/update-sw-version.cjs out/sw.js");
  });

  it("puts node_modules/.bin on PATH before the Docker builder runs the static-export wrapper", () => {
    const dockerfile = readFileSync("docker/Dockerfile", "utf8");
    const builderStage = dockerfile.split(/^FROM /m)[1] ?? "";
    const pathIndex = builderStage.indexOf('ENV PATH="/app/node_modules/.bin:$PATH"');
    const wrapperIndex = builderStage.indexOf("bash scripts/build-static-export.sh");

    // The wrapper calls a bare `next`. `bun run build` adds node_modules/.bin to
    // PATH in CI, but a Dockerfile RUN step does not, so the image build fails
    // with `next: command not found` unless the builder stage adds it.
    expect(wrapperIndex).toBeGreaterThan(-1);
    expect(pathIndex).toBeGreaterThan(-1);
    expect(pathIndex).toBeLessThan(wrapperIndex);
  });

  it("runs the Docker builder on real Node and copies in only the Bun binary", () => {
    const dockerfile = readFileSync("docker/Dockerfile", "utf8");
    const builderStage = dockerfile.split(/^FROM /m)[1] ?? "";
    const bunCopyIndex = builderStage.search(
      /^COPY --from=oven\/bun:1@sha256:[0-9a-f]{64} \/usr\/local\/bin\/bun \/usr\/local\/bin\/bun$/m,
    );
    const installIndex = builderStage.indexOf("bun install --frozen-lockfile");

    // The oven/bun image puts a `node` symlink to Bun on PATH. `next build` ran
    // on Bun there, and Bun 1.3.14 crashed after the build finished. A Debian
    // node:24 base keeps `node` real, and the copied Bun binary only runs the install.
    expect(builderStage).toMatch(
      /^node:24(?:-(?:bookworm|trixie))?(?:-slim)?@sha256:[0-9a-f]{64} AS builder$/m,
    );
    expect(bunCopyIndex).toBeGreaterThan(-1);
    expect(bunCopyIndex).toBeLessThan(installIndex);
  });

  it("keeps root coverage thresholds blocking in CI and SonarCloud", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const sonar = readFileSync(".github/workflows/sonarcloud.yml", "utf8");

    expect(ci).toContain("bun run test -- --coverage");
    expect(sonar).not.toMatch(/continue-on-error:\s*true/);
  });

  it("declares the test toolchain's Node floor in engines", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const jsdom = JSON.parse(readFileSync("node_modules/jsdom/package.json", "utf8")) as PackageJson;

    // jsdom declares the strictest floor in the test toolchain; Vitest 5 needs only
    // 22.12. Bun ignores engines, so CI and the README carry the enforcement.
    expect(jsdom.engines?.node).toBeDefined();
    expect(packageJson.engines?.node).toBe(jsdom.engines?.node);
  });

  it("pairs each Vitest runner with a coverage provider of the same version", () => {
    const root = requireFromRepo("./package.json") as PackageJson;
    const mcp = requireFromRepo("./packages/mcp-server/package.json") as PackageJson;

    // The MCP workspace once borrowed the root's hoisted provider. When the root
    // moved to Vitest 5, the v5 provider broke MCP's v4 runner.
    for (const { devDependencies } of [root, mcp]) {
      expect(devDependencies?.vitest).toBeDefined();
      expect(devDependencies?.["@vitest/coverage-v8"]).toBe(devDependencies?.vitest);
    }
  });

  it("pins next and eslint-config-next to one exact release, 16.3.8 or later", () => {
    const packageJson = requireFromRepo("./package.json") as PackageJson;
    const next = packageJson.dependencies?.next ?? "";
    const [major, minor, patch] = next.split(".").map(Number);

    // SEC-028: 16.3.8 is the security release. The lint config is written for
    // one framework release, so the two move together.
    expect(next).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.devDependencies?.["eslint-config-next"]).toBe(next);
    expect(major * 1_000_000 + minor * 1_000 + patch).toBeGreaterThanOrEqual(16_003_008);
  });

  it("runs every Vitest job on Node 22, set up before install", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const sonar = readFileSync(".github/workflows/sonarcloud.yml", "utf8");
    const vitestJobs = [
      workflowJob(ci, "test"),
      workflowJob(ci, "mcp-coverage"),
      workflowJob(sonar, "sonarcloud"),
    ];

    // `bun run` executes package scripts on Node, so the runner image's default
    // Node would otherwise decide whether Vitest can start.
    for (const job of vitestJobs) {
      const setupIndex = job.search(SETUP_NODE_22);
      expect(setupIndex).toBeGreaterThan(-1);
      expect(setupIndex).toBeLessThan(job.indexOf("bun install --frozen-lockfile"));
    }
  });

  it("opts the document into the declared smooth scroll behavior", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain('data-scroll-behavior="smooth"');
  });
});
