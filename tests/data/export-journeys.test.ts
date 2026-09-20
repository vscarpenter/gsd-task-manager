import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORT_JOURNEYS } from "../e2e/export-journeys";

describe("production export journeys", () => {
  // Playwright skips a testMatch entry that matches nothing, so a renamed spec
  // would shrink the production run without failing it.
  it("should_list_only_spec_files_that_exist", () => {
    for (const spec of EXPORT_JOURNEYS) {
      expect(existsSync(join("tests/e2e", spec)), spec).toBe(true);
    }
  });

  it("should_cover_crud_drag_import_export_and_first_visit", () => {
    expect([...EXPORT_JOURNEYS].sort()).toEqual([
      "data-management.spec.ts",
      "drag-and-drop.spec.ts",
      "first-time-redirect.spec.ts",
      "settings-navigation.spec.ts",
      "task-crud.spec.ts",
    ]);
  });

  it("should_run_the_export_journeys_after_the_production_build_in_ci", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const build = workflow.indexOf("run: bun run build");
    const journeys = workflow.indexOf(
      "run: bun run test:e2e:export -- --project=${{ matrix.browser }}"
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(build).toBeGreaterThan(-1);
    expect(journeys).toBeGreaterThan(build);
    expect(packageJson.scripts["test:e2e:export"]).toBe(
      "playwright test --config playwright.export.config.ts"
    );
  });
});
