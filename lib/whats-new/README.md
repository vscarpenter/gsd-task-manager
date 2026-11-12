# What's New

## Overview

This package holds the release notes shared by every GSD client and the logic around them. It parses versions, filters notes by platform, decides whether to show the post-update cue, and tracks the last version a device has seen.

`whats-new.json` ships inside the build. What's New works offline and never asks a server what changed.

## Interface

- `releases.ts:WHATS_NEW_PLATFORMS`. `["web", "apple", "android"]`.
- `releases.ts:WhatsNewPlatform`. Union type of those platforms.
- `releases.ts:WhatsNewRelease`. Interface with `platform`, `version`, `date`, `notable`, `headline`, `new`, `improved`, and `fixed`.
- `releases.ts:Version`. A readonly tuple of three numbers.
- `releases.ts:parseVersion(value: string): Version | null`. Parses a semver core string.
- `releases.ts:compareVersions(a: Version, b: Version): number`. Negative when `a` is older, zero when equal, positive when newer.
- `releases.ts:releasesFor(releases, platform, currentVersion): WhatsNewRelease[]`. Returns one platform's releases, newest first.
- `decide.ts:decideWhatsNew(input: WhatsNewDecisionInput): WhatsNewDecision`. Decides whether the post-update line shows.
- `decide.ts:WhatsNewDecisionInput`. Interface with `releases`, `currentVersion`, `lastSeenVersion`, and `existingUser`.
- `decide.ts:WhatsNewDecision`. Interface with `show`, `headlineVersion`, `unseenCount`, and `recordVersion`.
- `last-seen.ts:WHATS_NEW_LAST_SEEN_KEY`. Storage key `"gsd:whats-new:last-seen"`.
- `last-seen.ts:readLastSeenVersion(): string | null`. Reads the last acknowledged version.
- `last-seen.ts:recordLastSeenVersion(version: string): void`. Stores the version and fires a change event.
- `last-seen.ts:subscribeLastSeenVersion(onChange): () => void`. Subscribes for `useSyncExternalStore`.
- `last-seen.ts:runningWebVersion(): string | null`. Returns `process.env.NEXT_PUBLIC_BUILD_NUMBER`, or `null`.
- `load-releases.ts:loadWhatsNewReleases(): Promise<WhatsNewRelease[]>`. Loads the notes file as its own chunk.
- `load-releases.ts:useWhatsNewReleases(): WhatsNewRelease[] | null`. React hook. Returns `null` until the chunk has loaded.
- `whats-new.json`. Data file with `note`, `schema` (1), and a `releases` array of `WhatsNewRelease` objects.

## Invariants

- `releases.ts:VERSION_PATTERN` accepts a semver core only: no prerelease or build suffix and no leading zeros. Every client parses the same set of strings.
- `releases.ts:releasesFor` leaves out notes for a version newer than the running one, so an entry can land before its build. An unknown running version keeps them all.
- `releases.ts:WhatsNewRelease.headline` is required when `notable` is true and `null` otherwise.
- `decide.ts:decideWhatsNew` is pinned by `tests/fixtures/cross-platform/whats-new-corpus.json`, which the iOS and Android suites also run.
- `decide.ts:decideWhatsNew` shows nothing on a first run (`existingUser` false with no last seen version). It records the current version instead.
- `decide.ts:decideWhatsNew` shows nothing when the last seen version is at or above the current one.
- `decide.ts:unseenReleases` counts everything newer than the last seen version. On first contact it counts from the newest notable release on.
- `decide.ts:decideWhatsNew` shows the line only when an unseen release is notable. Otherwise it records the current version.
- `last-seen.ts` keeps the value per device and never syncs it (D-12).
- `last-seen.ts:recordLastSeenVersion` keeps a session copy when the write fails, so the cue does not show again.
- `load-releases.ts:loadWhatsNewReleases` forgets a failed load, so the next subscriber retries.
- `whats-new.json:note` states the web repo copy is the authority. Byte-identical copies ship inside the Apple and Android apps.

## Side Effects

- `last-seen.ts:readLastSeenVersion` reads `localStorage`. `last-seen.ts:recordLastSeenVersion` writes it and dispatches `gsd:whats-new-seen` on `window`.
- `last-seen.ts:subscribeLastSeenVersion` adds and removes two `window` listeners (`gsd:whats-new-seen` and `storage`).
- `load-releases.ts:loadWhatsNewReleases` runs a dynamic `import("./whats-new.json")`, which fetches a separate chunk, and keeps the result in module state.
- `load-releases.ts:subscribe` logs a warning through the `UI` logger when the load fails.
- `releases.ts` and `decide.ts`: None.

## Verification

- Run: `bun run test`
