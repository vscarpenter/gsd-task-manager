#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { relative, resolve } = require("node:path");
const { ESLint } = require("eslint");

const REPO_ROOT = resolve(__dirname, "..");
const BASELINE_PATH = resolve(__dirname, "code-shape-baseline.json");
const DEBT_PATH = resolve(__dirname, "code-shape-debt.json");
const RULES = ["complexity", "max-depth", "max-lines", "max-lines-per-function"];
const PRODUCTION_GLOBS = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
  "packages/mcp-server/src/**/*.ts",
];

function measuredValue(message) {
  const match = message.match(/(?:complexity of |lines \(|deeply \()(\d+)/);
  return match ? Number(match[1]) : 0;
}

function emptyCodeShape() {
  return Object.fromEntries(RULES.map((rule) => [rule, {}]));
}

function isProductionFile(filePath) {
  return !/(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(filePath)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath);
}

async function analyzeCodeShape() {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfig: {
      rules: {
        complexity: ["error", 10],
        "max-depth": ["error", 3],
        "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
        "max-lines-per-function": [
          "error",
          { max: 40, skipBlankLines: true, skipComments: true },
        ],
      },
    },
  });
  const results = await eslint.lintFiles(PRODUCTION_GLOBS);
  const shape = emptyCodeShape();

  for (const result of results) {
    const file = relative(REPO_ROOT, result.filePath).replaceAll("\\", "/");
    if (!isProductionFile(file)) continue;

    for (const message of result.messages) {
      if (!message.ruleId || !RULES.includes(message.ruleId)) continue;
      const ruleShape = shape[message.ruleId];
      const prior = ruleShape[file] ?? { count: 0, max: 0 };
      ruleShape[file] = {
        count: prior.count + 1,
        max: Math.max(prior.max, measuredValue(message.message)),
      };
    }
  }

  return shape;
}

function compareCodeShape(baseline, current) {
  const failures = [];
  const rules = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const rule of [...rules].sort()) {
    const baselineFiles = baseline[rule] ?? {};
    const currentFiles = current[rule] ?? {};
    for (const file of Object.keys(currentFiles).sort()) {
      const allowed = baselineFiles[file] ?? { count: 0, max: 0 };
      const measured = currentFiles[file];
      if (measured.count > allowed.count) {
        failures.push(
          `${rule}: ${file} violation count increased ${allowed.count} -> ${measured.count}`
        );
      }
      if (measured.max > allowed.max) {
        failures.push(
          `${rule}: ${file} maximum increased ${allowed.max} -> ${measured.max}`
        );
      }
    }
  }

  return failures;
}

function summarize(shape) {
  return RULES.map((rule) => {
    const files = Object.values(shape[rule] ?? {});
    const count = files.reduce((sum, entry) => sum + entry.count, 0);
    const maximum = files.reduce((max, entry) => Math.max(max, entry.max), 0);
    return `${rule}: ${count} violation(s), maximum ${maximum}`;
  }).join("\n");
}

function violationCount(shape, rule) {
  return Object.values(shape[rule] ?? {}).reduce((sum, entry) => sum + entry.count, 0);
}

function validateDebtLedger(ledger, current, now = new Date()) {
  const failures = [];
  if (typeof ledger.owner !== "string" || ledger.owner.trim().length === 0) {
    failures.push("code-shape debt owner is missing");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.deadline ?? "")) {
    failures.push("code-shape debt deadline must use YYYY-MM-DD");
  } else {
    const deadline = new Date(`${ledger.deadline}T23:59:59.999Z`);
    if (now > deadline) failures.push(`code-shape debt deadline expired on ${ledger.deadline}`);
  }
  for (const rule of RULES) {
    const allowed = ledger.maximumRemainingViolations?.[rule];
    if (!Number.isInteger(allowed) || allowed < 0) {
      failures.push(`code-shape debt ceiling is missing for ${rule}`);
      continue;
    }
    const measured = violationCount(current, rule);
    if (measured > allowed) {
      failures.push(`${rule}: total debt increased ${allowed} -> ${measured}`);
    }
  }
  return failures;
}

async function main() {
  const current = await analyzeCodeShape();
  if (process.argv.includes("--print-baseline")) {
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const ledger = JSON.parse(readFileSync(DEBT_PATH, "utf8"));
  const failures = [
    ...compareCodeShape(baseline, current),
    ...validateDebtLedger(ledger, current),
  ];
  process.stdout.write(`${summarize(current)}\n`);
  if (failures.length > 0) {
    process.stderr.write(`\nCode-shape ratchet failed:\n- ${failures.join("\n- ")}\n`);
    process.exitCode = 1;
  }
}

module.exports = { analyzeCodeShape, compareCodeShape, measuredValue, validateDebtLedger };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
