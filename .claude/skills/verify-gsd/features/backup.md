# Backup and restore

A user can export every task to a JSON file and restore that file later, including a file exported from the iOS app. A restore either merges with what's on the device or replaces it. A bad file is rejected and changes nothing.

## Sub-features

- `backup-sidebar-path` reaches Data & Storage from the Settings sidebar.
- `backup-export` downloads a backup holding every user-owned store and no account data.
- `backup-export-palette` downloads the same file from the command palette.
- `backup-import-palette` lands on Data & Storage from the command palette.
- `backup-import-ios-merge` merges a real iOS export with existing tasks.
- `backup-round-trip-replace` restores the app's own backup over newer tasks.
- `backup-import-invalid` rejects malformed JSON and leaves the data alone.

## How to get to it (user POV)

- Choose `Settings`, then `Data & Storage`, then `Export tasks` or the import button. `/settings#data` deep-links there.
- Press `⌘K` and choose `Export tasks as JSON` or `Import tasks from JSON`.

## Driving it with gsd-verify

Preconditions:

- `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`, run from the repository root.
- `gsd-verify up` printed `Ready`, and `gsd-verify doctor` exits 0.
- `tests/fixtures/cross-platform/ios-backup-export.json` exists. It's a real export from the iOS client.
- Sync is off in every test.

- **Sidebar path.** Choose `Settings`, then `Data & Storage`. Run `gsd-verify drive backup -g backup-sidebar-path`. The URL ends in `#data`, and the `Export tasks` button shows.
- **Export.** Add a task and choose `Export tasks`. Run `gsd-verify drive backup -g backup-export`. The file is named `gsd-tasks-*.json`, it holds the task, `archivedTasks`, and `deletedTasks`, and it has no `syncMetadata`, `deviceInfo`, `syncHistory`, or `syncQueue`.
- **Export from the palette.** Press `⌘K` and choose `Export tasks as JSON`. Run `gsd-verify drive backup -g backup-export-palette`. A `gsd-tasks-*.json` download starts.
- **Import from the palette.** Press `⌘K` and choose `Import tasks from JSON`. Run `gsd-verify drive backup -g backup-import-palette`. `/settings#data` should open with the Data & Storage heading showing. This is a known failure today, marked `test.fail()`. See Gotchas.
- **Merge an iOS backup.** Add a task, import the iOS fixture, and choose `Merge Tasks`. Run `gsd-verify drive backup -g backup-import-ios-merge`. The matrix shows the existing task and `Ship the parity fixes`, and the store holds all three titles.
- **Replace round trip.** Export, add another task, import the export, and choose `Replace Everything`. Run `gsd-verify drive backup -g backup-round-trip-replace`. Only the original task remains, on the matrix and in the store.
- **Invalid file.** Import malformed JSON. Run `gsd-verify drive backup -g backup-import-invalid`. A toast says `Invalid JSON format`, no dialog opens, and the existing row is unchanged.
- **Proof.** Run `gsd-verify drive backup`. In the printed evidence folder, `backup-export/backup.json` holds the parsed download, and `backup-import-ios-merge/after-merge.tasks.json` holds the merged rows.

## Gotchas

- Known app bug, found 2026-11-02: `Import tasks from JSON` in the palette changes the URL to `/settings/#data` but the page stays on Appearance, so a user lands on the wrong section. `Send feedback` does the same with `#feedback`. A full load of either URL works. Both failed every attempt, from the matrix and from Settings. `backup-import-palette` keeps the correct assertion under `test.fail()`, so it goes red when the bug is fixed. Remove the marker then.
- Replace runs at once while sync is off. Its `Delete and replace` confirmation only appears with sync on and live tasks at risk, so these journeys can't reach that step. Report it as unverified, and don't count `backup-round-trip-replace` as covering it.
- Merging your own backup doubles your tasks, on purpose. The tasks are added again as copies, and the dialog says so.
- The import button creates its file input on click. Wait for the `filechooser` event before clicking, as `chooseImportFile` does.
- The backup envelope is a contract shared with iOS and Android, pinned by fixtures in three repos. If this feature changes the shape, read the cross-platform fixture notes in the workspace `CLAUDE.md` before regenerating anything.
- A filename match proves nothing. Parse the download and assert its contents.
