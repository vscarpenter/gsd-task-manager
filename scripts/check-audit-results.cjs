const { readFileSync } = require('node:fs');

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

// Reviewed High or Critical advisories that may pass until `expires` (UTC).
// Each entry names one package and one advisory id, and it stops applying on
// its expiry date, so the advisory blocks again unless someone re-reviews it.
const ACCEPTED_ADVISORIES = [
  {
    packageName: 'braces',
    id: 1240992, // GHSA-vfj7-8cjw-p6xm
    expires: '2027-01-05',
    reason: 'dev-only lint dependency via eslint-config-next; no patched release exists',
  },
];

function findAcceptance(packageName, advisory, now) {
  return ACCEPTED_ADVISORIES.find((entry) =>
    entry.packageName === packageName &&
    entry.id === advisory.id &&
    now < new Date(`${entry.expires}T00:00:00Z`));
}

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

function analyzeAuditResults(raw, { now = new Date() } = {}) {
  const document = parseAuditDocument(raw);
  const blocking = [];
  const accepted = [];
  let advisoryCount = 0;

  for (const [packageName, advisories] of Object.entries(document)) {
    if (!Array.isArray(advisories)) {
      throw new Error(`Audit result must contain advisory arrays (${packageName})`);
    }
    for (const advisory of advisories) {
      validateAdvisory(packageName, advisory);
      advisoryCount += 1;
      if (!BLOCKING_SEVERITIES.has(advisory.severity.toLowerCase())) continue;

      const finding = {
        packageName,
        id: advisory.id,
        severity: advisory.severity,
        title: advisory.title,
      };
      const acceptance = findAcceptance(packageName, advisory, now);
      if (acceptance) {
        accepted.push({ ...finding, expires: acceptance.expires, reason: acceptance.reason });
      } else {
        blocking.push(finding);
      }
    }
  }

  return { advisoryCount, blocking, accepted };
}

function runCli(resultPath, options) {
  if (!resultPath) throw new Error('Usage: node scripts/check-audit-results.cjs <audit-results.json>');
  const result = analyzeAuditResults(readFileSync(resultPath, 'utf8'), options);
  for (const advisory of result.accepted) {
    console.log(
      `Accepted until ${advisory.expires}: ${advisory.severity}: ${advisory.packageName} ` +
      `(${advisory.id}) ${advisory.title}. Reason: ${advisory.reason}`
    );
  }
  if (result.blocking.length === 0) {
    console.log(`Audit evidence valid: ${result.advisoryCount} advisories, none blocking.`);
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
