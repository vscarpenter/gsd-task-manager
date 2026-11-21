import { describe, expect, it } from "vitest";
import { checkPrShape, MAX_FILES, OVERRIDE_LABEL } from "../../scripts/check-pr-shape.cjs";

const codeFiles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ filename: `lib/module-${i}.ts` }));

const versionBump = {
  filename: "package.json",
  patch: '@@ -1,4 +1,4 @@\n {\n \t"name": "gsd-taskmanager",\n-\t"version": "15.0.0",\n+\t"version": "15.0.1",\n',
};

describe("checkPrShape size rule", () => {
  it("should_pass_a_pr_at_the_file_limit", () => {
    const problems = checkPrShape({ title: "fix: x", labels: [], files: codeFiles(MAX_FILES) });

    expect(problems).toEqual([]);
  });

  it("should_fail_a_pr_one_file_over_the_limit_and_name_the_label", () => {
    const problems = checkPrShape({ title: "fix: x", labels: [], files: codeFiles(MAX_FILES + 1) });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${MAX_FILES + 1} files`);
    expect(problems[0]).toContain(OVERRIDE_LABEL);
  });

  it("should_not_count_lockfiles_or_tasks_notes", () => {
    const files = [
      ...codeFiles(MAX_FILES),
      { filename: "bun.lock" },
      { filename: "packages/mcp-server/bun.lock" },
      { filename: "tools/stagehand/package-lock.json" },
      { filename: "tasks/todo.md" },
      { filename: "tasks/lessons.md" },
    ];

    expect(checkPrShape({ title: "chore: deps", labels: [], files })).toEqual([]);
  });

  it("should_pass_an_oversized_pr_that_carries_the_override_label", () => {
    const problems = checkPrShape({ title: "fix: x", labels: [OVERRIDE_LABEL], files: codeFiles(40) });

    expect(problems).toEqual([]);
  });
});

describe("checkPrShape release rule", () => {
  it("should_fail_a_version_bump_outside_a_release_pr", () => {
    const problems = checkPrShape({ title: "fix: usability", labels: [], files: [versionBump, ...codeFiles(2)] });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("package.json");
    expect(problems[0]).toContain("chore(release)");
  });

  it("should_pass_a_version_bump_in_a_release_pr", () => {
    const problems = checkPrShape({ title: "chore(release): prepare 15.0.1", labels: [], files: [versionBump] });

    expect(problems).toEqual([]);
  });

  it("should_not_let_the_override_label_excuse_a_version_bump", () => {
    const problems = checkPrShape({ title: "fix: x", labels: [OVERRIDE_LABEL], files: [versionBump] });

    expect(problems).toHaveLength(1);
  });

  it("should_catch_a_two_space_indented_version_in_a_workspace_package", () => {
    const mcpBump = {
      filename: "packages/mcp-server/package.json",
      patch: '@@ -2,3 +2,3 @@\n   "name": "gsd-mcp-server",\n-  "version": "1.5.0",\n+  "version": "1.5.1",\n',
    };

    expect(checkPrShape({ title: "feat(mcp): x", labels: [], files: [mcpBump] })).toHaveLength(1);
  });

  it("should_ignore_nested_version_keys_and_other_package_json_edits", () => {
    const files = [
      { filename: "package.json", patch: '@@ -40,3 +40,3 @@\n \t\t"engines": {\n-\t\t\t"version": "1",\n+\t\t\t"version": "2",\n' },
      { filename: "packages/mcp-server/package.json", patch: '@@ -9,1 +9,1 @@\n-    "zod": "4.1.0",\n+    "zod": "4.1.1",\n' },
      { filename: "lib/version.ts", patch: '@@ -1 +1 @@\n-"version": "1"\n+"version": "2"\n' },
    ];

    expect(checkPrShape({ title: "chore(deps): bump zod", labels: [], files })).toEqual([]);
  });

  it("should_treat_a_package_json_without_a_patch_as_unchanged_version", () => {
    expect(checkPrShape({ title: "chore: x", labels: [], files: [{ filename: "package.json" }] })).toEqual([]);
  });
});
