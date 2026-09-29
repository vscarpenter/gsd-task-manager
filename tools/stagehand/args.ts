export type SeedScenario = "matrix" | "dashboard" | "storage" | "trash" | "none";

export interface VerifyArgs {
  goal: string;
  seed: SeedScenario;
  path: string;
  acts: string[];
  url: string;
  headless: boolean;
}

export interface SmokeArgs {
  url: string;
  journey?: string;
  headless: boolean;
}

const DEFAULT_STAGEHAND_MODEL = "anthropic/claude-haiku-4-5";
const ANTHROPIC_MODEL_PREFIX = "anthropic/";
const VERIFY_DEFAULT_URL = "http://localhost:3000";
const SMOKE_DEFAULT_URL = "https://gsd.vinny.dev";
const SEED_SCENARIOS: readonly SeedScenario[] = ["matrix", "dashboard", "storage", "trash", "none"];

function expectValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseVerifyArgs(argv: string[]): VerifyArgs {
  const args: VerifyArgs = {
    goal: "",
    seed: "none",
    path: "/",
    acts: [],
    url: VERIFY_DEFAULT_URL,
    headless: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--goal") args.goal = expectValue(argv, (i += 1), flag);
    else if (flag === "--seed") {
      const value = expectValue(argv, (i += 1), flag);
      if (!SEED_SCENARIOS.includes(value as SeedScenario)) {
        throw new Error(`--seed must be matrix, dashboard, storage, trash, or none (got "${value}")`);
      }
      args.seed = value as SeedScenario;
    } else if (flag === "--path") args.path = expectValue(argv, (i += 1), flag);
    else if (flag === "--act") args.acts.push(expectValue(argv, (i += 1), flag));
    else if (flag === "--url") args.url = expectValue(argv, (i += 1), flag);
    else if (flag === "--headed") args.headless = false;
    else throw new Error(`Unknown flag: ${flag}`);
  }
  if (!args.goal) throw new Error('Missing required --goal "<what to confirm>"');
  return args;
}

export function parseSmokeArgs(argv: string[], journeyNames: string[]): SmokeArgs {
  const args: SmokeArgs = { url: SMOKE_DEFAULT_URL, headless: true };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--url") args.url = expectValue(argv, (i += 1), flag);
    else if (flag === "--journey") {
      const name = expectValue(argv, (i += 1), flag);
      if (!journeyNames.includes(name)) {
        throw new Error(`Unknown journey "${name}". Valid: ${journeyNames.join(", ")}`);
      }
      args.journey = name;
    } else if (flag === "--headed") args.headless = false;
    else throw new Error(`Unknown flag: ${flag}`);
  }
  return args;
}

// STAGEHAND_MODEL lets the judge eval swap models without editing the harness.
// Only Anthropic models are accepted because createHarness wires ANTHROPIC_API_KEY.
export function resolveStagehandModel(env: Record<string, string | undefined>): string {
  const requested = env.STAGEHAND_MODEL?.trim();
  if (!requested) return DEFAULT_STAGEHAND_MODEL;
  if (!requested.startsWith(ANTHROPIC_MODEL_PREFIX)) {
    throw new Error(`STAGEHAND_MODEL must start with "${ANTHROPIC_MODEL_PREFIX}" (got "${requested}")`);
  }
  return requested;
}
