# Saved tasks — web first

Design scope settled in the October 26 conversation: save an existing task outside the four quadrants; retain short annotations; web first, iOS fast follow. Continue spec → plan → implementation without additional review gates.

## Goal
Keep reading material and possibilities without treating them as active commitments.

## Contract
- Move to Saved on an incomplete task; Undo returns it with its original priority and due date.
- /saved is a searchable, newest-saved-first list in primary navigation.
- Preserve the task id, title, description/links, tags, subtasks, dependencies, recurrence and original due date. Short notes edit the existing 600-character description, including links.
- savedAt is an optional ISO timestamp independent of quadrant/completion. Missing means active. Store in the existing tasks table; this is neither deletion nor archival.
- Saved tasks are absent from the matrix, active analytics and due badges/reminders. Dependency lookups retain saved prerequisites.
- Return to matrix requires choosing a quadrant and reviewing the optional due date; clearing the date clears its reminder state. Repeated save/return is idempotent.
- Running timers must be stopped before saving; saving does not complete a task or spawn a recurring instance.
- Search includes saved items with a Saved label and opens /saved. Notes remain searchable after edits.
- Local storage and JSON backup round trips retain savedAt. Optional PocketBase sync maps savedAt ↔ saved_at. Backend migration is required before hosted release.

## Scope
Web UI and shared data contract now. No notebooks, folders, rich-text editor, direct bookmark capture, scheduled resurfacing, or iOS UI in this change.

## iOS fast follow
Add savedAt to local and wire models; preserve it on pull, push and backups; omit saved items from matrix, widgets, reminders, badges and active analytics; add Saved, short annotation editing and return-to-quadrant. Existing iOS versions do not understand Saved and may show these items as tasks. Do not claim cross-client parity before this follow-up ships.

## Verification
Test-first saved transitions, active filtering, schema/backup and mapper round trips, reminder exclusion and sync transaction failure. UI tests for notes, empty/search states and return selection. Browser checks for save → note → search → reload → return and Undo at desktop/mobile sizes in light/dark. Run repository checks and disposable PocketBase harness; do not deploy.
