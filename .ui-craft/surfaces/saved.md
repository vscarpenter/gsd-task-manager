# Saved

Mode: Operate. Approved October 26, 2026; web first, iOS fast follow.

Keep reading material, ideas, and reference outside active commitments. The matrix
retains its urgent/important argument. Saved is placement, not completion or a
fifth quadrant.

Use the existing Editorial surfaces, type, neutral tags, interaction ink, native
form controls and the shared shell. A single reading list is sufficient; no new
visual theme, quadrant pigment, folders, rich text or motion.

Primary verbs: Move to Saved, Edit notes, Return to matrix. Notes and links reuse
the task description field (600 characters). Return to matrix asks for a quadrant
and an optional due date. Moving to Saved, returning to the matrix, and deleting
each offer Undo. Search includes title, description,
tags and subtasks; global search marks Saved results explicitly.

Completed tasks and tasks with a running timer cannot move to Saved
(`lib/tasks/saved-placement.ts`). Task cards hide Move to Saved on completed tasks.
A task with a running timer gets an error toast that gives the reason.

Required states: loading before local data resolves; empty with an explanation;
no search matches; pending form submission; failed save retaining typed text;
failed return/delete retaining the item; keyboard focus into forms and back to
the notes action on cancel/save; responsive touch actions in both themes.
