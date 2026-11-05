"use client";

import { useEffect, useId } from "react";

import content from "@/lib/whats-new/whats-new.json";
import { recordLastSeenVersion, runningWebVersion } from "@/lib/whats-new/last-seen";
import { releasesFor, type WhatsNewRelease } from "@/lib/whats-new/releases";

const GROUPS = [
  { key: "new", label: "New" },
  { key: "improved", label: "Improved" },
  { key: "fixed", label: "Fixed" },
] as const;

// English dates in UTC, so a YYYY-MM-DD release date never shifts by a day (#633).
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatReleaseDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

function ReleaseNotes({ release }: { release: WhatsNewRelease }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="text-h3 text-foreground">
          Version {release.version}
        </h3>
        <p className="text-xs text-foreground-muted">{formatReleaseDate(release.date)}</p>
      </div>
      {release.headline && <p className="mt-1 text-sm text-foreground">{release.headline}</p>}
      {GROUPS.filter(({ key }) => release[key].length > 0).map(({ key, label }) => (
        <div key={key} className="mt-3">
          <h4 className="text-eyebrow uppercase text-foreground-muted">{label}</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
            {release[key].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

interface WhatsNewSectionProps {
  /** Every client's notes; the section keeps this build's web releases. Injectable for tests. */
  releases?: readonly WhatsNewRelease[];
}

/**
 * Settings › What's new: the release history for this build, newest first.
 * Opening it counts as reading it, so the matrix stops offering the cue.
 */
export function WhatsNewSection({ releases = content.releases as WhatsNewRelease[] }: WhatsNewSectionProps) {
  const current = runningWebVersion();
  const visible = releasesFor(releases, "web", current);

  useEffect(() => {
    if (current) recordLastSeenVersion(current);
  }, [current]);

  if (visible.length === 0) {
    return <p className="px-4 py-3.5 text-sm text-foreground-muted">No release notes for this version yet.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {visible.map((release) => (
        <ReleaseNotes key={release.version} release={release} />
      ))}
    </div>
  );
}
