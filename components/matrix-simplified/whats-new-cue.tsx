"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { cn } from "@/lib/utils";
import { decideWhatsNew } from "@/lib/whats-new/decide";
import {
  readLastSeenVersion,
  recordLastSeenVersion,
  runningWebVersion,
  subscribeLastSeenVersion,
} from "@/lib/whats-new/last-seen";
import { useWhatsNewReleases } from "@/lib/whats-new/load-releases";
import { releasesFor, type WhatsNewRelease } from "@/lib/whats-new/releases";

// Underlined at rest, like the feedback nudge: beside muted text, hue alone
// can't mark the link (WCAG 1.4.1).
const CONTROL_CLASS =
  "touch-target inline-flex items-center rounded-xs underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const readServerLastSeen = (): string | null => null;

interface WhatsNewCueProps {
  /** Null while tasks load. A device with no tasks is a first run. */
  existingUser: boolean | null;
  /** Every client's notes; injectable for tests. */
  releases?: readonly WhatsNewRelease[];
}

interface CueContent {
  release: WhatsNewRelease;
  current: string;
}

interface CueResult {
  release: WhatsNewRelease | undefined;
  current: string;
  recordVersion: string | null;
}

/** The shared rule, once the notes and the task count are known. */
function evaluateCue(
  releases: readonly WhatsNewRelease[] | null,
  existingUser: boolean | null,
  lastSeen: string | null,
): CueResult | null {
  const current = runningWebVersion();
  if (releases === null || existingUser === null || current === null) return null;
  const web = releasesFor(releases, "web", current);
  const decision = decideWhatsNew({ releases: web, currentVersion: current, lastSeenVersion: lastSeen, existingUser });
  const release = decision.show ? web.find((r) => r.version === decision.headlineVersion) : undefined;
  return { release, current, recordVersion: decision.recordVersion };
}

/** Applies the rule after hydration, and records a new user's starting version. */
function useWhatsNewCue(existingUser: boolean | null, injected?: readonly WhatsNewRelease[]): CueContent | null {
  const hydrated = useIsHydrated();
  const lastSeen = useSyncExternalStore(subscribeLastSeenVersion, readLastSeenVersion, readServerLastSeen);
  const bundled = useWhatsNewReleases();
  const result = hydrated ? evaluateCue(injected ?? bundled, existingUser, lastSeen) : null;
  const recordNow = result?.recordVersion ?? null;

  useEffect(() => {
    if (recordNow) recordLastSeenVersion(recordNow);
  }, [recordNow]);

  return result?.release ? { release: result.release, current: result.current } : null;
}

/**
 * One line under the matrix intro after a notable update, and nothing else:
 * no toast, modal, or badge (PRODUCT.md, "never nagged"). The rule lives in
 * lib/whats-new/decide.ts and the shared corpus. Dismissing, following the link,
 * or opening Settings › What's new records the running version on this device.
 */
export function WhatsNewCue({ existingUser, releases }: WhatsNewCueProps) {
  const cue = useWhatsNewCue(existingUser, releases);
  if (!cue) return null;

  const markSeen = () => recordLastSeenVersion(cue.current);
  const dismiss = () => {
    // The pressed button is about to unmount; hand focus to the main region first.
    restoreFocusOrMainContent(null);
    markSeen();
  };

  return (
    <div
      data-testid="whats-new-cue"
      className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm leading-relaxed text-foreground-muted"
    >
      <span>
        <span className="font-medium text-foreground">New in {cue.release.version}:</span> {cue.release.headline}
      </span>
      <Link href="/settings#whats-new" onClick={markSeen} className={cn(CONTROL_CLASS, "text-accent")}>
        See what&rsquo;s new
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss what's new"
        className={cn(CONTROL_CLASS, "text-foreground-muted hover:text-foreground")}
      >
        Dismiss
      </button>
    </div>
  );
}
