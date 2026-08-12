import {
  buildSmokeReport,
  buildVerifyReport,
  formatSmokeTable,
  verifyExitCode,
  type JourneyResult,
  type PageEvidence,
} from "@/tools/stagehand/report";

const cleanEvidence: PageEvidence = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
};
const pass: JourneyResult = {
  name: "search",
  status: "PASS",
  detail: "found task",
  durationMs: 1234,
};
const fail: JourneyResult = {
  name: "settings",
  status: "FAIL",
  detail: "no sections",
  durationMs: 900,
};

describe("verifyExitCode", () => {
  it("returns 0 for met goal with clean console", () => {
    expect(verifyExitCode({ observed: "", goalMet: true, evidence: "" }, cleanEvidence)).toBe(0);
  });

  it("returns 1 when goal met but console has errors", () => {
    expect(
      verifyExitCode(
        { observed: "", goalMet: true, evidence: "" },
        { ...cleanEvidence, consoleErrors: ["x"] }
      )
    ).toBe(1);
  });

  it("returns 1 when goal met but a page error occurred", () => {
    expect(
      verifyExitCode(
        { observed: "", goalMet: true, evidence: "" },
        { ...cleanEvidence, pageErrors: ["boom"] }
      )
    ).toBe(1);
  });

  it("returns 1 when goal unmet", () => {
    expect(verifyExitCode({ observed: "", goalMet: false, evidence: "" }, cleanEvidence)).toBe(1);
  });

  it("ignores warnings", () => {
    expect(
      verifyExitCode(
        { observed: "", goalMet: true, evidence: "" },
        { ...cleanEvidence, consoleWarnings: ["w"] }
      )
    ).toBe(0);
  });

  it("returns 1 when a request fails", () => {
    expect(
      verifyExitCode(
        { observed: "", goalMet: true, evidence: "" },
        { ...cleanEvidence, failedRequests: ["GET /api/tasks: net::ERR_FAILED"] }
      )
    ).toBe(1);
  });
});

describe("buildSmokeReport", () => {
  it("exits 0 when all pass", () => {
    expect(buildSmokeReport("u", [pass], cleanEvidence, "dir").exitCode).toBe(0);
  });

  it("exits 1 on any failure", () => {
    expect(buildSmokeReport("u", [pass, fail], cleanEvidence, "dir").exitCode).toBe(1);
  });

  it("exits 1 when a journey passes but page evidence is blocking", () => {
    expect(
      buildSmokeReport(
        "u",
        [pass],
        { ...cleanEvidence, pageErrors: ["uncaught error"], failedRequests: ["GET /data: failed"] },
        "dir"
      ).exitCode
    ).toBe(1);
  });
});

describe("formatSmokeTable", () => {
  it("renders one row per journey plus a summary", () => {
    const table = formatSmokeTable(buildSmokeReport("u", [pass, fail], cleanEvidence, "dir"));
    expect(table).toContain("PASS  search  (1.2s)  found task");
    expect(table).toContain("FAIL  settings  (0.9s)  no sections");
    expect(table).toContain("1 passed, 1 failed");
  });

  it("surfaces console error count when present", () => {
    const report = buildSmokeReport(
      "u",
      [pass],
      { ...cleanEvidence, consoleErrors: ["a", "b"] },
      "dir"
    );
    expect(formatSmokeTable(report)).toContain("console errors: 2");
  });

  it("surfaces every blocking evidence class", () => {
    const report = buildSmokeReport(
      "u",
      [pass],
      {
        ...cleanEvidence,
        consoleErrors: ["console"],
        pageErrors: ["page"],
        failedRequests: ["GET /data: failed"],
      },
      "dir"
    );
    const table = formatSmokeTable(report);
    expect(table).toContain("console errors: 1");
    expect(table).toContain("page errors: 1");
    expect(table).toContain("failed requests: 1");
  });
});

describe("buildVerifyReport", () => {
  it("threads exit code from verdict + evidence", () => {
    const report = buildVerifyReport(
      "goal",
      { observed: "o", goalMet: true, evidence: "e" },
      cleanEvidence,
      ["a.png"],
      "dir"
    );
    expect(report.exitCode).toBe(0);
    expect(report.screenshots).toEqual(["a.png"]);
  });
});
