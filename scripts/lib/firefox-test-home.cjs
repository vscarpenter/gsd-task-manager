const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// Playwright #42768: Firefox 157 consults the real macOS app-data directory
// even with a temporary profile. Isolate that lookup until the stable browser
// includes the upstream fix; no privacy grants or sandbox changes are needed.
async function withFirefoxTestHome(browserName, runWithEnv, platform = process.platform) {
  if (browserName !== "firefox" || platform !== "darwin") return runWithEnv(undefined);

  const directory = mkdtempSync(join(tmpdir(), "gsd-firefox-home-"));
  try {
    return await runWithEnv({ CFFIXED_USER_HOME: directory });
  } finally {
    // macOS adds deny-delete ACLs to Library/Downloads in this disposable
    // home. Clear only these test-owned ACLs so teardown can remove it.
    if (process.platform === "darwin") {
      execFileSync("/bin/chmod", ["-R", "-N", directory]);
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { withFirefoxTestHome };
