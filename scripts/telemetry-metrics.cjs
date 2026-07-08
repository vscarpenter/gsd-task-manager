"use strict";

const HOUR_MS = 3600000;

function toMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function round(x, dp) {
  if (x == null) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Pure pipeline metrics. Inputs are normalized by the telemetry workflow:
//   prs:   [{ number, mergedAt, issueCreatedAt, prodDeployedAt, reviewFindings }]
//   plans: [{ issue, revised }]  (issues that reached plan:pending)
function computeMetrics(input) {
  const prs = Array.isArray(input && input.prs) ? input.prs : [];
  const plans = Array.isArray(input && input.plans) ? input.plans : [];

  const durations = prs
    .map((pr) => {
      const start = toMs(pr && pr.issueCreatedAt);
      const end = toMs(pr && pr.prodDeployedAt);
      return start != null && end != null ? (end - start) / HOUR_MS : null;
    })
    .filter((h) => h != null && h >= 0)
    .sort((a, b) => a - b);

  const total = plans.length;
  const revised = plans.filter((p) => p && p.revised).length;

  const merged = prs.filter((pr) => pr && pr.mergedAt);
  const findingsSum = merged.reduce((s, pr) => s + (Number(pr.reviewFindings) || 0), 0);

  return {
    cycleTime: {
      medianHours: round(percentile(durations, 50), 1),
      p90Hours: round(percentile(durations, 90), 1),
      count: durations.length,
    },
    planRevisionRate: {
      rate: total ? round(revised / total, 2) : null,
      revised,
      total,
    },
    reviewFindingsPerPR: {
      mean: merged.length ? round(findingsSum / merged.length, 1) : null,
      count: merged.length,
    },
    tokensPerPR: null,
  };
}

module.exports = { computeMetrics, percentile };
