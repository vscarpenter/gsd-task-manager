// Headline numbers for one judge-eval variant, recomputed from raw rows.
// Accuracy alone hides a judge that simply says "met" more often, so the
// summary also splits recall (true cases), specificity (false cases), and
// precision, plus error classes and measured cost.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// USD per million tokens (input, output), first-party API rates.
const PRICES = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-5-5': [2, 10],
};
const PER_MILLION = 1e6;
const Z95 = 1.96;
const PCT = 100;

const readJsonl = (path) => (existsSync(path)
  ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
  : []);

// Wilson score interval: stays inside [0, 1] and behaves at small n.
function wilson(hits, n) {
  if (n === 0) return [0, 0];
  const p = hits / n;
  const denom = 1 + (Z95 * Z95) / n;
  const centre = (p + (Z95 * Z95) / (2 * n)) / denom;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + (Z95 * Z95) / (4 * n * n))) / denom;
  return [centre - half, centre + half];
}

const pct = (x) => `${(x * PCT).toFixed(1)}%`;
const ratio = (hits, n) => (n ? `${pct(hits / n)} (${hits}/${n})` : 'n/a');

function costOf(row) {
  const price = PRICES[row.model];
  if (!price || !row.usage) return null;
  return (row.usage.input_tokens * price[0] + row.usage.output_tokens * price[1]) / PER_MILLION;
}

export function summarize(vdir, cases) {
  const expected = new Map(cases.map((c) => [c.id, c]));
  const rows = readJsonl(join(vdir, 'results.jsonl'));
  const scored = new Set(rows.map((r) => `${r.prompt_id}\0${r.rep}`));
  const openErrors = readJsonl(join(vdir, 'errors.jsonl'))
    .filter((e) => !scored.has(`${e.prompt_id}\0${e.rep}`));

  const correct = rows.filter((r) => r.grade.correct === 1).length;
  const positives = rows.filter((r) => expected.get(r.prompt_id)?.expected === true);
  const negatives = rows.filter((r) => expected.get(r.prompt_id)?.expected === false);
  const saidMet = rows.filter((r) => r.said_met === true);
  const [lo, hi] = wilson(correct, rows.length);

  const bySurface = {};
  for (const r of rows) {
    const surface = r.tags[0];
    bySurface[surface] ??= [0, 0];
    bySurface[surface][0] += r.grade.correct;
    bySurface[surface][1] += 1;
  }
  const errorClasses = {};
  for (const e of openErrors) errorClasses[e.failure_class] = (errorClasses[e.failure_class] ?? 0) + 1;
  const costs = rows.map(costOf).filter((c) => c != null);
  // Failed attempts that still billed (usage recorded on the error row) are
  // real spend, so they count toward the total but not the per-row average.
  const billedErrors = openErrors.map(costOf).filter((c) => c != null);
  const scoredTotal = costs.reduce((a, b) => a + b, 0);
  const total = scoredTotal + billedErrors.reduce((a, b) => a + b, 0);

  return [
    `accuracy    ${ratio(correct, rows.length)}  95% CI ${pct(lo)} to ${pct(hi)}`,
    `recall      ${ratio(positives.filter((r) => r.grade.correct === 1).length, positives.length)}  (true goals judged met)`,
    `specificity ${ratio(negatives.filter((r) => r.grade.correct === 1).length, negatives.length)}  (false goals judged unmet)`,
    `precision   ${ratio(saidMet.filter((r) => r.grade.correct === 1).length, saidMet.length)}  (met verdicts that were right)`,
    `by surface  ${Object.entries(bySurface).map(([k, [h, n]]) => `${k} ${h}/${n}`).join(' · ')}`,
    `errors      ${openErrors.length}${openErrors.length ? ` (${Object.entries(errorClasses).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`,
    `cost        $${total.toFixed(4)} over ${costs.length} scored rows ($${(costs.length ? scoredTotal / costs.length : 0).toFixed(5)}/row)` +
      (billedErrors.length ? `, including ${billedErrors.length} billed failed attempts` : ''),
  ].join('\n');
}
