import { z } from "zod";
import { parseVerifyArgs } from "./args";
import { createHarness } from "./harness";
import { buildVerifyReport } from "./report";

const USAGE =
  'Usage: bun tools/stagehand/verify.ts --goal "<what to confirm>" ' +
  "[--seed matrix|dashboard|none] [--path /route] " +
  '[--act "<atomic instruction>"]... [--url http://localhost:3000] [--headed]';

const verdictSchema = z.object({
  observed: z.string(),
  goalMet: z.boolean(),
  evidence: z.string(),
});

async function main(): Promise<void> {
  const args = parseVerifyArgs(process.argv.slice(2));
  const harness = await createHarness({ url: args.url, headless: args.headless, label: "verify" });
  const screenshots: string[] = [];
  try {
    await harness.goto("/"); // warm-up: absorbs the first-visit /about redirect
    await harness.resetAppState();
    if (args.seed !== "none") await harness.seed(args.seed);
    await harness.goto(args.path);
    screenshots.push(await harness.screenshot("before"));
    for (const instruction of args.acts) {
      const { data: actions } = await harness.stagehand.observe(instruction);
      const action = actions[0];
      if (!action) throw new Error(`observe() found no action for: "${instruction}"`);
      await harness.stagehand.act(action);
    }
    screenshots.push(await harness.screenshot("after"));
    const { data: verdict } = await harness.stagehand.extract(
      `Goal under verification: "${args.goal}". Describe exactly what the page shows that is ` +
        "relevant to this goal (observed), state whether the goal is met (goalMet), and name " +
        "the specific visible evidence (evidence). Judge only what is visible.",
      verdictSchema
    );
    const pageEvidence = await harness.readEvidence();
    const report = buildVerifyReport(args.goal, verdict, pageEvidence, screenshots, harness.evidenceDir);
    harness.writeReport("verify-report", report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
  } finally {
    await harness.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exitCode = 2;
});
