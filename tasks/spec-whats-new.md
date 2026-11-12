# Spec: What's New

**Status:** approved 2026-11-05 (owner: "add this to the parity doc and start implementation"). Web first; Apple and Android follow from the briefs in the GSD Project's `parity/roadmap.md`.
**Web status, 2026-11-12:** the web shipped this in 14.7.0 (#671). In `lib/whats-new/whats-new.json`, the Apple 3.8.0 and Android 0.11.0 notes announce a What's New screen. This repo holds no iOS or Android code, so those notes are the only evidence here for the native clients.
**Matrix row:** G8. **Tier:** non-trivial (new shared contract, three clients).
**Contracts:**
- `lib/whats-new/whats-new.json`: the release notes for every client. This repo is the authority.
- `tests/fixtures/cross-platform/whats-new-corpus.json`: when the post-update line shows. This repo is the authority.

Both are copied byte-identical into `gsd-iosapp` and `gsd-android` when those clients implement the feature.

## 1. Why

Users don't learn what changed in GSD unless they read the App Store, the Play listing, or the GitHub releases. Three of those four surfaces don't exist for web users. A What's New surface tells people about due times, Saved, and escalation without a newsletter or a tracking key.

## 2. Placement

Both `PRODUCT.md` files promise the user is "never nagged" and reject badges. The web's feedback invitation (#525) set the precedent: one dismissible line, no toast, modal, or badge.

1. **Permanent home:** Settings › What's new, a section in the Info group that lists the release history for this client, newest first. Also reachable from the command palette ("What's new").
2. **Post-update cue:** one line under the matrix intro after a notable update: the headline, a "See what's new" link, and Dismiss. It shows until the user dismisses it or opens the section.
3. **Not built:** a bell icon, an unread badge, a modal on launch, or fetching notes from a server. The notes ship inside each build, so the feature works offline and sends nothing.

## 3. Content contract (`whats-new.json`)

```
{ "schema": 1, "releases": [ Release, ... ] }
Release = {
  platform: "web" | "apple" | "android",
  version: "MAJOR.MINOR.PATCH",
  date: "YYYY-MM-DD",
  notable: boolean,            // true: may show the post-update line
  headline: string | null,     // required when notable
  new: string[], improved: string[], fixed: string[]   // at least one item in total
}
```

- `(platform, version)` is unique. Order in the file doesn't matter; clients sort by version.
- Each client shows only its own platform's releases, and only those at or below the running version, so notes can land before the build that ships them.
- Writing rules: lead with what the user can now do; one idea per bullet; no dependency bumps, refactors, CI, or tests; never imply data leaves the device when it doesn't.

## 4. The rule (`decideWhatsNew`)

```
decideWhatsNew({ releases, currentVersion, lastSeenVersion, existingUser }) -> {
  show: boolean,
  headlineVersion: string | null,
  unseenCount: integer,
  recordVersion: string | null   // write this as lastSeen now, without any user action
}
```

`releases` are one platform's. Versions compare numerically, part by part. A version that isn't three dot-separated non-negative integers is invalid.

**Corpus, 2026-11-12:** the corpus is stricter than that sentence. It also rejects a leading zero (`1.02.0`) and a prerelease suffix (`1.2.0-beta`). `parseVersion` in `lib/whats-new/releases.ts` follows it, and rejects a build suffix too.

1. `currentVersion` invalid: nothing shows, nothing is recorded.
2. Only releases with `version <= currentVersion` count.
3. An invalid `lastSeenVersion` counts as missing.
4. Missing `lastSeenVersion`, new user (`existingUser` false): nothing shows; record `currentVersion`. New users get the welcome tour instead.
5. Missing `lastSeenVersion`, existing user: treat the newest notable counted release as unseen, along with any counted release newer than it. If there is no notable release, nothing shows; record `currentVersion`.
6. `lastSeenVersion >= currentVersion` (including a downgrade): nothing shows, nothing is recorded.
7. Otherwise the unseen releases are those with `lastSeenVersion < version <= currentVersion`. If none is notable, nothing shows; record `currentVersion`, so a later notable update shows only itself.
8. Otherwise show. `headlineVersion` is the newest notable unseen release; `unseenCount` counts every unseen release; nothing is recorded.

Dismissing the line, following its link, or opening the What's new section records `currentVersion`.

## 5. Per-device state

`lastSeenVersion` is a local, per-device setting (like the escalation window, D-12). It never syncs and isn't in the backup envelope: each device got its own update.

Web: localStorage key `gsd:whats-new:last-seen`. Running version: `NEXT_PUBLIC_BUILD_NUMBER`, which `next.config.ts` always sets. Existing user: the matrix has at least one task once IndexedDB has loaded. The rule runs only after loading finishes.

## 6. Out of scope

- An "Across every app" entry for server-side changes (the 30-day sessions). Each client's notes mention them in the release that surfaced them.
- Auto-expiry of the line after N launches. Revisit if it reads as nagging.
- Apple and Android code: briefs only, in the Project roadmap.

## 7. Acceptance criteria

1. `whats-new.json` validates against section 3 (test).
2. Every case in `whats-new-corpus.json` passes against `decideWhatsNew` (test).
3. Settings shows a What's new section listing this build's web releases newest first, grouped New, Improved, Fixed; opening it records the running version.
4. The matrix shows the line for an existing user after a notable update; Dismiss hides it and records the version; a new user never sees it.
5. The command palette has a "What's new" entry that opens the section.
6. Navigating to `/settings#<section>` client-side (palette, links) opens that section. This fixes the bug recorded in `tasks/todo.md` (2026-11-02), which every link to the section would hit.
