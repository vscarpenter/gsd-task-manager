export interface Verdict {
  observed: string;
  goalMet: boolean;
  evidence: string;
}

export interface PageEvidence {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
}

export interface JourneyResult {
  name: string;
  status: "PASS" | "FAIL";
  detail: string;
  durationMs: number;
  screenshot?: string;
}

export interface VerifyReport {
  goal: string;
  verdict: Verdict;
  pageEvidence: PageEvidence;
  screenshots: string[];
  evidenceDir: string;
  exitCode: 0 | 1;
}

export interface SmokeReport {
  url: string;
  results: JourneyResult[];
  pageEvidence: PageEvidence;
  evidenceDir: string;
  exitCode: 0 | 1;
}

const MS_PER_SECOND = 1000;

export function verifyExitCode(verdict: Verdict, pageEvidence: PageEvidence): 0 | 1 {
  const clean = pageEvidence.consoleErrors.length === 0 && pageEvidence.pageErrors.length === 0;
  return verdict.goalMet && clean ? 0 : 1;
}

export function buildVerifyReport(
  goal: string,
  verdict: Verdict,
  pageEvidence: PageEvidence,
  screenshots: string[],
  evidenceDir: string
): VerifyReport {
  return {
    goal,
    verdict,
    pageEvidence,
    screenshots,
    evidenceDir,
    exitCode: verifyExitCode(verdict, pageEvidence),
  };
}

export function buildSmokeReport(
  url: string,
  results: JourneyResult[],
  pageEvidence: PageEvidence,
  evidenceDir: string
): SmokeReport {
  const exitCode: 0 | 1 = results.some((result) => result.status === "FAIL") ? 1 : 0;
  return { url, results, pageEvidence, evidenceDir, exitCode };
}

export function formatSmokeTable(report: SmokeReport): string {
  const rows = report.results.map((result) => {
    const seconds = (result.durationMs / MS_PER_SECOND).toFixed(1);
    return `${result.status}  ${result.name}  (${seconds}s)  ${result.detail}`;
  });
  const passed = report.results.filter((result) => result.status === "PASS").length;
  const failed = report.results.length - passed;
  const lines = [...rows, `${passed} passed, ${failed} failed`];
  if (report.pageEvidence.consoleErrors.length > 0) {
    lines.push(`console errors: ${report.pageEvidence.consoleErrors.length}`);
  }
  return lines.join("\n");
}
