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
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface TypeScriptModule {
  createProgram?: unknown;
  version?: string;
}

function firstNumericMajor(versionRange: string): number | null {
  const match = versionRange.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function runStaticBuildWrapper(options: {
  createArtifact?: boolean;
  exitCode?: number;
}): { status: number | null; stdout: string } {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "gsd-static-build-"));
  const fixtureScripts = join(fixtureRoot, "scripts");
  const fixtureBin = join(fixtureRoot, "bin");
  mkdirSync(fixtureScripts);
  mkdirSync(fixtureBin);

  const wrapper = readFileSync("scripts/build-static-export.sh", "utf8");
  writeFileSync(join(fixtureScripts, "build-static-export.sh"), wrapper);
  writeFileSync(
    join(fixtureScripts, "externalize-inline-assets.cjs"),
    readFileSync("scripts/externalize-inline-assets.cjs", "utf8"),
  );
  writeFileSync(
    join(fixtureRoot, ".build-env.sh"),
    `export PATH=${JSON.stringify(`${fixtureBin}:${process.env.PATH ?? ""}`)}\n`,
  );

  const fakeNext = [
    "#!/usr/bin/env bash",
    "echo 'fixture next build'",
    options.createArtifact ? "mkdir -p out && printf '<html></html>' > out/index.html" : "true",
    `exit ${options.exitCode ?? 0}`,
    "",
  ].join("\n");
  writeFileSync(join(fixtureBin, "next"), fakeNext);
  chmodSync(join(fixtureBin, "next"), 0o755);

  try {
    const stdout = execFileSync("bash", ["scripts/build-static-export.sh"], {
      cwd: fixtureRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number | null; stdout?: Buffer | string };
    return {
      status: failure.status ?? null,
      stdout: String(failure.stdout ?? ""),
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

  it("keeps root coverage thresholds blocking in CI and SonarCloud", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const sonar = readFileSync(".github/workflows/sonarcloud.yml", "utf8");

    expect(ci).toContain("bun run test -- --coverage");
    expect(sonar).not.toMatch(/continue-on-error:\s*true/);
  });

  it("opts the document into the declared smooth scroll behavior", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain('data-scroll-behavior="smooth"');
  });
});
