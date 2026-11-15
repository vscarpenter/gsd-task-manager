const { runChecks } = require("./probe.cjs");

async function main() {
  const checks = await runChecks();
  const report = { checkedAt: new Date().toISOString(), checks, success: checks.every((result) => result.success) };
  if (process.argv.includes("--browser")) {
    const { runBrowserChecks } = require("./browser-check.cjs");
    report.browser = await runBrowserChecks();
    report.success &&= report.browser.success;
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.success ? 0 : 1;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ success: false, code: "MONITOR_CHECK_INTERNAL_FAILURE" })}\n`);
  process.exitCode = 1;
});
