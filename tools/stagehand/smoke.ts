import { parseSmokeArgs } from "./args";
import { createHarness, type Harness } from "./harness";
import { buildSmokeReport, formatSmokeTable, type JourneyResult } from "./report";
import { journeys, type Journey } from "./journeys";

const JOURNEY_TIMEOUT_MS = 90_000;
// Dexie liveQuery re-renders land a beat after an act mutates state; extracting
// immediately reads the pre-update DOM (seen live: task created but Q1 read empty).
const RENDER_SETTLE_MS = 1500;

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`journey timed out after ${ms}ms`)), ms);
  });

const settleForRender = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, RENDER_SETTLE_MS);
  });

async function executeJourney(harness: Harness, journey: Journey): Promise<void> {
  if (journey.seed) await harness.seed(journey.seed);
  await harness.goto(journey.path);
  if (journey.urlIncludes) {
    const url = await harness.currentUrl();
    if (!url.includes(journey.urlIncludes)) {
      throw new Error(`expected URL to include "${journey.urlIncludes}", got "${url}"`);
    }
  }
  for (const instruction of journey.steps) {
    const { data } = await harness.stagehand.act(instruction);
    if (!data.success) {
      throw new Error(`act failed on "${instruction}": ${data.message}`);
    }
  }
  if (journey.steps.length > 0) await settleForRender();
  const { data } = await harness.stagehand.extract(journey.check.instruction, journey.check.schema);
  if (!journey.check.predicate(data)) {
    throw new Error(`check failed: ${journey.check.expectation}. Extracted: ${JSON.stringify(data)}`);
  }
}

async function runJourney(harness: Harness, journey: Journey): Promise<JourneyResult> {
  const startedAt = Date.now();
  try {
    await Promise.race([executeJourney(harness, journey), timeout(JOURNEY_TIMEOUT_MS)]);
    return {
      name: journey.name,
      status: "PASS",
      detail: journey.check.expectation,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    const screenshot = await harness.screenshot(`fail-${journey.name}`).catch(() => undefined);
    return {
      name: journey.name,
      status: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      screenshot,
    };
  }
}

async function main(): Promise<void> {
  const args = parseSmokeArgs(
    process.argv.slice(2),
    journeys.map((journey) => journey.name)
  );
  const selected = args.journey
    ? journeys.filter((journey) => journey.name === args.journey)
    : journeys;
  const harness = await createHarness({ url: args.url, headless: args.headless, label: "smoke" });
  try {
    if (selected[0]?.name !== "first-visit-redirect") {
      await harness.goto("/"); // warm-up: absorb the first-visit redirect
    }
    const results: JourneyResult[] = [];
    for (const journey of selected) {
      results.push(await runJourney(harness, journey));
    }
    const report = buildSmokeReport(
      args.url,
      results,
      await harness.readEvidence(),
      harness.evidenceDir
    );
    harness.writeReport("smoke-report", report);
    console.log(formatSmokeTable(report));
    console.log(`report: ${harness.evidenceDir}`);
    process.exitCode = report.exitCode;
  } finally {
    await harness.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
