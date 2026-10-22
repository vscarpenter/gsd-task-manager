import { existsSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const { withFirefoxTestHome } = createRequire(import.meta.url)("../../scripts/lib/firefox-test-home.cjs");

describe("Firefox test app-data isolation", () => {
  it("leaves other browsers and platforms unchanged", async () => {
    for (const [browser, platform] of [["chromium", "darwin"], ["webkit", "darwin"], ["firefox", "linux"]]) {
      await withFirefoxTestHome(browser, async (env: unknown) => {
        expect(env).toBeUndefined();
      }, platform);
    }
  });

  it("provides a private disposable home and cleans it after success", async () => {
    let directory = "";
    const result = await withFirefoxTestHome("firefox", async (env: Record<string, string>) => {
      directory = env.CFFIXED_USER_HOME;
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      writeFileSync(join(directory, "browser-data"), "fixture");
      expect(Object.keys(env)).toEqual(["CFFIXED_USER_HOME"]);
      return "finished";
    }, "darwin");

    expect(result).toBe("finished");
    expect(existsSync(directory)).toBe(false);
  });

  it("cleans the home and preserves a launch or test failure", async () => {
    let directory = "";
    const failure = new Error("browser failed");

    await expect(withFirefoxTestHome("firefox", async (env: Record<string, string>) => {
      directory = env.CFFIXED_USER_HOME;
      throw failure;
    }, "darwin")).rejects.toBe(failure);
    expect(existsSync(directory)).toBe(false);
  });
});
