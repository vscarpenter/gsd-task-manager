import { journeys } from "@/tools/stagehand/journeys";

describe("journeys", () => {
  it("has six journeys with first-visit-redirect first", () => {
    expect(journeys).toHaveLength(6);
    expect(journeys[0]?.name).toBe("first-visit-redirect");
  });

  it("has unique names", () => {
    const names = journeys.map((journey) => journey.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every journey has a path, expectation, and check instruction", () => {
    for (const journey of journeys) {
      expect(journey.path.startsWith("/")).toBe(true);
      expect(journey.check.instruction.length).toBeGreaterThan(0);
      expect(journey.check.expectation.length).toBeGreaterThan(0);
    }
  });

  it("predicates hold on representative data", () => {
    const byName = Object.fromEntries(journeys.map((journey) => [journey.name, journey]));
    expect(byName["first-visit-redirect"].check.predicate({ isAboutPage: true })).toBe(true);
    expect(byName["first-visit-redirect"].check.predicate({ isAboutPage: false })).toBe(false);
    expect(byName["capture-to-quadrant"].check.predicate({ q1Titles: ["Smoke test task"] })).toBe(
      true
    );
    expect(byName["capture-to-quadrant"].check.predicate({ q1Titles: [] })).toBe(false);
    expect(byName["complete-task"].check.predicate({ activeTitles: ["Other"] })).toBe(true);
    expect(byName["complete-task"].check.predicate({ activeTitles: ["Complete me smoke"] })).toBe(
      false
    );
    expect(byName["search"].check.predicate({ resultTitles: ["Findable smoke task"] })).toBe(true);
    expect(byName["search"].check.predicate({ resultTitles: [] })).toBe(false);
    expect(byName["settings"].check.predicate({ sectionNames: ["Appearance", "Data"] })).toBe(true);
    expect(byName["settings"].check.predicate({ sectionNames: [] })).toBe(false);
    expect(byName["dashboard"].check.predicate({ showsNonZeroAnalytics: true })).toBe(true);
    expect(byName["dashboard"].check.predicate({ showsNonZeroAnalytics: false })).toBe(false);
  });

  it("rejects malformed extraction data in predicates", () => {
    for (const journey of journeys) {
      expect(journey.check.predicate(null)).toBe(false);
      expect(journey.check.predicate({ unexpected: true })).toBe(false);
    }
  });
});
