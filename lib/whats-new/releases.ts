/**
 * Release notes shared by every GSD client (tasks/spec-whats-new.md).
 *
 * whats-new.json ships inside the build, so What's New works offline and never
 * asks a server what changed. Each client reads only its own platform's entries.
 */

export const WHATS_NEW_PLATFORMS = ["web", "apple", "android"] as const;
export type WhatsNewPlatform = (typeof WHATS_NEW_PLATFORMS)[number];

export interface WhatsNewRelease {
  platform: WhatsNewPlatform;
  version: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  /** True when this release may show the one-line post-update cue. */
  notable: boolean;
  /** Required when notable; null otherwise. */
  headline: string | null;
  new: string[];
  improved: string[];
  fixed: string[];
}

export type Version = readonly [number, number, number];

// Semver core with no prerelease or build suffix, and no leading zeros, so every
// client parses exactly the same set of strings.
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value: string): Version | null {
  const match = VERSION_PATTERN.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative when a is older than b, zero when equal, positive when newer. */
export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * One platform's releases, newest first. Notes for a version newer than the
 * running one are left out, so an entry can land before the build that ships it.
 * An unknown running version (a dev build) keeps them all.
 */
export function releasesFor(
  releases: readonly WhatsNewRelease[],
  platform: WhatsNewPlatform,
  currentVersion: string | null,
): WhatsNewRelease[] {
  const current = currentVersion === null ? null : parseVersion(currentVersion);
  return releases
    .flatMap((release) => {
      const version = parseVersion(release.version);
      if (release.platform !== platform || version === null) return [];
      if (current !== null && compareVersions(version, current) > 0) return [];
      return [{ release, version }];
    })
    .sort((a, b) => compareVersions(b.version, a.version))
    .map(({ release }) => release);
}
