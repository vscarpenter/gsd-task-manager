import { describe, it, expect } from "vitest";
import { computeMetrics, percentile } from "../scripts/telemetry-metrics.cjs";

const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString();

describe("percentile", () => {
  it("interpolates between ranks", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
  });
  it("returns null for empty", () => expect(percentile([], 50)).toBeNull());
});

describe("computeMetrics", () => {
  it("returns nulls/zeros for empty input", () => {
    const m = computeMetrics({});
    expect(m.cycleTime).toEqual({ medianHours: null, p90Hours: null, count: 0 });
    expect(m.planRevisionRate).toEqual({ rate: null, revised: 0, total: 0 });
    expect(m.reviewFindingsPerPR).toEqual({ mean: null, count: 0 });
    expect(m.tokensPerPR).toBeNull();
  });

  it("computes cycle time in hours from issueCreatedAt to prodDeployedAt", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(2), issueCreatedAt: day(1), prodDeployedAt: day(2), reviewFindings: 2 }],
    });
    expect(m.cycleTime).toEqual({ medianHours: 24, p90Hours: 24, count: 1 });
    expect(m.reviewFindingsPerPR).toEqual({ mean: 2, count: 1 });
  });

  it("excludes PRs missing issue or prod timestamps from cycle time", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(2), issueCreatedAt: null, prodDeployedAt: day(2), reviewFindings: 0 }],
    });
    expect(m.cycleTime.count).toBe(0);
  });

  it("excludes negative durations", () => {
    const m = computeMetrics({
      prs: [{ number: 1, mergedAt: day(1), issueCreatedAt: day(3), prodDeployedAt: day(2), reviewFindings: 0 }],
    });
    expect(m.cycleTime.count).toBe(0);
  });

  it("takes the median of multiple durations", () => {
    const m = computeMetrics({
      prs: [
        { number: 1, mergedAt: day(2), issueCreatedAt: day(1), prodDeployedAt: day(2), reviewFindings: 0 },
        { number: 2, mergedAt: day(3), issueCreatedAt: day(1), prodDeployedAt: day(3), reviewFindings: 0 },
        { number: 3, mergedAt: day(4), issueCreatedAt: day(1), prodDeployedAt: day(4), reviewFindings: 0 },
      ],
    });
    expect(m.cycleTime.medianHours).toBe(48); // 24h, 48h, 72h -> median 48h
  });

  it("computes plan revision rate", () => {
    const m = computeMetrics({ plans: [{ revised: true }, { revised: false }, { revised: false }] });
    expect(m.planRevisionRate).toEqual({ rate: 0.33, revised: 1, total: 3 });
  });

  it("averages review findings over merged PRs only", () => {
    const m = computeMetrics({
      prs: [
        { number: 1, mergedAt: day(2), reviewFindings: 4 },
        { number: 2, mergedAt: null, reviewFindings: 100 },
      ],
    });
    expect(m.reviewFindingsPerPR).toEqual({ mean: 4, count: 1 });
  });
});
