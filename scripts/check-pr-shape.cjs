"use strict";

// One reviewable PR. A bigger change carries the override label, so its size
// is a decision someone made rather than something that piled up.
const MAX_FILES = 15;
const OVERRIDE_LABEL = "large-pr";
const RELEASE_TITLE = /^chore\(release\)/;

// Lockfiles and the tasks/ journal ride along with real changes and say
// nothing about how much there is to review.
const UNCOUNTED = [/(^|\/)bun\.lock$/, /(^|\/)package-lock\.json$/, /^tasks\//];

// A top-level key sits one tab or two spaces deep. A deeper "version" belongs
// to a nested object, such as an engines block, and isn't a release.
const TOP_LEVEL_VERSION_LINE = /^[+-](?:\t| {2})"version"\s*:/m;

function countFiles(files) {
  return files.filter(({ filename }) => !UNCOUNTED.some((pattern) => pattern.test(filename))).length;
}

// GitHub omits the patch for very large diffs; without it the bump can't be
// seen, and the size rule still applies to the PR.
function bumpsVersion({ filename, patch }) {
  return /(^|\/)package\.json$/.test(filename) && typeof patch === "string" && TOP_LEVEL_VERSION_LINE.test(patch);
}

/**
 * Check a pull request against the repo's PR shape rules.
 *
 * @param {{ title: string, labels: string[], files: Array<{ filename: string, patch?: string }> }} pr
 * @returns {string[]} one message per broken rule; empty when the PR passes
 */
function checkPrShape({ title, labels, files }) {
  const problems = [];
  const count = countFiles(files);
  if (count > MAX_FILES && !labels.includes(OVERRIDE_LABEL)) {
    problems.push(
      `This PR changes ${count} files (lockfiles and tasks/ not counted), over the limit of ${MAX_FILES}. ` +
        `Split it by concern, or add the "${OVERRIDE_LABEL}" label if one concern needs this many files.`
    );
  }
  const bumped = files.filter(bumpsVersion).map(({ filename }) => filename);
  if (bumped.length > 0 && !RELEASE_TITLE.test(title)) {
    problems.push(
      `This PR changes the version in ${bumped.join(", ")}. ` +
        `Version bumps go in their own PR titled "chore(release): ...", so move the bump there.`
    );
  }
  return problems;
}

module.exports = { checkPrShape, MAX_FILES, OVERRIDE_LABEL };
