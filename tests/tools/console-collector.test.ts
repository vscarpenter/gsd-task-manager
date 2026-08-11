import { readFileSync } from "node:fs";
import path from "node:path";

const collectorSource = readFileSync(
  path.join(__dirname, "../../tools/stagehand/page-scripts/console-collector.js"),
  "utf8"
);

interface GsdEvidence {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
}

const getEvidence = (): GsdEvidence =>
  (window as unknown as { __gsdEvidence: GsdEvidence }).__gsdEvidence;

describe("console-collector", () => {
  beforeEach(() => {
    delete (window as unknown as { __gsdEvidence?: GsdEvidence }).__gsdEvidence;
     
    new Function(collectorSource)();
  });

  it("records console.error and console.warn", () => {
    console.error("boom", { code: 1 });
    console.warn("careful");
    expect(getEvidence().consoleErrors).toEqual(['boom {"code":1}']);
    expect(getEvidence().consoleWarnings).toEqual(["careful"]);
  });

  it("records window error events", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "kaboom" }));
    expect(getEvidence().pageErrors).toEqual(["kaboom"]);
  });

  it("is idempotent — double install keeps one buffer", () => {
    const first = getEvidence();
     
    new Function(collectorSource)();
    expect(getEvidence()).toBe(first);
  });
});
