import { compareVersions, parseVersion, type Version } from "./releases";

/**
 * Decides whether the post-update line shows. The rule is pinned by
 * tests/fixtures/cross-platform/whats-new-corpus.json, which the iOS and Android
 * suites run too; see tasks/spec-whats-new.md section 4 for the reasoning.
 */

export interface WhatsNewDecisionInput {
  /** One platform's releases, in any order. Only version and notable matter. */
  releases: ReadonlyArray<{ version: string; notable: boolean }>;
  currentVersion: string;
  lastSeenVersion: string | null;
  /** False for a first run: new users get the welcome tour instead. */
  existingUser: boolean;
}

export interface WhatsNewDecision {
  show: boolean;
  headlineVersion: string | null;
  unseenCount: number;
  /** Written as last seen right away, with no user action. Null writes nothing. */
  recordVersion: string | null;
}

interface Counted {
  label: string;
  version: Version;
  notable: boolean;
}

const NOTHING: WhatsNewDecision = { show: false, headlineVersion: null, unseenCount: 0, recordVersion: null };

function countedReleases(input: WhatsNewDecisionInput, current: Version): Counted[] {
  return input.releases
    .flatMap(({ version, notable }) => {
      const parsed = parseVersion(version);
      return parsed && compareVersions(parsed, current) <= 0 ? [{ label: version, version: parsed, notable }] : [];
    })
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** Everything newer than the last seen version, or, on first contact, from the newest notable release on. */
function unseenReleases(counted: Counted[], lastSeen: Version | null): Counted[] {
  if (lastSeen !== null) return counted.filter((r) => compareVersions(r.version, lastSeen) > 0);
  const newestNotable = counted.find((r) => r.notable);
  if (!newestNotable) return [];
  return counted.filter((r) => compareVersions(r.version, newestNotable.version) >= 0);
}

export function decideWhatsNew(input: WhatsNewDecisionInput): WhatsNewDecision {
  const current = parseVersion(input.currentVersion);
  if (current === null) return NOTHING;

  const lastSeen = input.lastSeenVersion === null ? null : parseVersion(input.lastSeenVersion);
  const startFromHere = { ...NOTHING, recordVersion: input.currentVersion };

  if (lastSeen === null && !input.existingUser) return startFromHere;
  if (lastSeen !== null && compareVersions(lastSeen, current) >= 0) return NOTHING;

  const unseen = unseenReleases(countedReleases(input, current), lastSeen);
  const headline = unseen.find((r) => r.notable);
  if (!headline) return startFromHere;

  return { show: true, headlineVersion: headline.label, unseenCount: unseen.length, recordVersion: null };
}
