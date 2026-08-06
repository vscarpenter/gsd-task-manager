const { readFileSync } = require('node:fs');

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

function parseAuditDocument(raw) {
  if (!raw.trim()) throw new Error('Audit result is empty');

  let document;
  try {
    document = JSON.parse(raw);
  } catch {
    throw new Error('Audit result is not valid JSON');
  }

  if (!document || Array.isArray(document) || typeof document !== 'object') {
    throw new Error('Audit result must be a JSON object');
  }
  return document;
}

function validateAdvisory(packageName, advisory) {
  if (!advisory || typeof advisory !== 'object' || Array.isArray(advisory)) {
    throw new Error(`Audit result for ${packageName} must contain advisory objects`);
  }
  if (typeof advisory.severity !== 'string') {
    throw new Error(`Audit advisory for ${packageName} must have a string severity`);
  }
}

function analyzeAuditResults(raw) {
  const document = parseAuditDocument(raw);
  const blocking = [];
  let advisoryCount = 0;

  for (const [packageName, advisories] of Object.entries(document)) {
    if (!Array.isArray(advisories)) {
      throw new Error(`Audit result must contain advisory arrays (${packageName})`);
    }
    for (const advisory of advisories) {
      validateAdvisory(packageName, advisory);
      advisoryCount += 1;
      if (BLOCKING_SEVERITIES.has(advisory.severity.toLowerCase())) {
        blocking.push({
          packageName,
          id: advisory.id,
          severity: advisory.severity,
          title: advisory.title,
        });
      }
    }
  }

  return { advisoryCount, blocking };
}

function runCli(resultPath) {
  if (!resultPath) throw new Error('Usage: node scripts/check-audit-results.cjs <audit-results.json>');
  const result = analyzeAuditResults(readFileSync(resultPath, 'utf8'));
  if (result.blocking.length === 0) {
    console.log(`Audit evidence valid: ${result.advisoryCount} advisories, none High/Critical.`);
    return 0;
  }
  for (const advisory of result.blocking) {
    console.error(`${advisory.severity}: ${advisory.packageName} (${advisory.id}) ${advisory.title}`);
  }
  return 1;
}

if (require.main === module) {
  try {
    process.exitCode = runCli(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

module.exports = { analyzeAuditResults, runCli };
