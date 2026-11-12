# Share task dialog

## Overview

This directory has a dialog that shares one task as plain text.
It shares through the Web Share API, a `mailto:` link, or the clipboard.
It also has the pure text formatters and the tab UI that the dialog uses.

## Interface

- `ShareTaskDialog` (`index.tsx`): dialog component with props `{ task: TaskRecord | null; open: boolean; onOpenChange(open) }`. It has native, email, and copy tabs, each with a matching action button.
- `ShareTabButtons` (`share-tab-content.tsx`): tablist component with props `{ activeTab: ShareTab; onTabChange(tab) }`. The Share tab renders only when `canUseWebShare()` is true.
- `ShareTabContent` (`share-tab-content.tsx`): props `{ activeTab, taskDetails, recipientEmail, onRecipientEmailChange, emailError? }`. It renders the preview and, for email, a recipient input with error text.
- `ShareTab` (`share-tab-content.tsx`): type `"native" | "email" | "copy"`.
- `canUseWebShare` (`format-task-details.ts`): `() => boolean`. True when `navigator` exists and `navigator.share` is a function.
- `isValidEmail` (`format-task-details.ts`): `(email: string) => boolean`. It tests against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- `formatTaskHeader` (`format-task-details.ts`): `(task) => string[]`. Returns `["Task: <title>", ""]`.
- `formatTaskDescription` (`format-task-details.ts`): `(task) => string[]`. Returns `["Description:", description, ""]`, or `[]` when the description is empty.
- `formatTaskMetadata` (`format-task-details.ts`): `(task) => string[]`. Returns a "Details:" block with Status, Priority, and optional Due and Tags lines.
- `formatTaskSubtasks` (`format-task-details.ts`): `(task) => string[]`. Returns a "Subtasks:" block with a checked or unchecked box per subtask, or `[]`.
- `formatTaskDetails` (`format-task-details.ts`): `(task) => string`. Joins header, description, metadata, subtasks, and a footer with `\n`.

## Invariants

- `index.tsx:ShareTaskDialog`: returns `null` when `task` is `null`.
- `index.tsx:ShareTaskDialog`: the initial tab is `"native"` when `canUseWebShare()` is true. Otherwise it is `"email"`.
- `index.tsx:handleOpenEmailClient`: a non-empty trimmed recipient that fails `isValidEmail` sets an error and aborts. A blank recipient is allowed.
- `index.tsx:handleOpenEmailClient`: passes recipient, subject, and body through `encodeURIComponent`. A comment states that this blocks smuggled mailto headers.
- `index.tsx:handleRecipientEmailChange`: editing the recipient clears `emailError`.
- `index.tsx:handleNativeShare`: ignores an error named `"AbortError"`. It logs nothing and shows no error toast.
- `format-task-details.ts:EMAIL_PATTERN`: a comment states that the check is loose on purpose. It is not RFC 5322 validation.
- `format-task-details.ts:formatTaskMetadata`: priority text comes from `urgent` and `important`: "Urgent & Important", "Urgent", "Important", or "Low Priority".

## Side Effects

- `index.tsx:handleOpenEmailClient`: creates an `<a>` with a `mailto:` `href`, `target="_blank"`, and `rel="noopener noreferrer"`. It appends the link to `document.body`, clicks it, and removes it.
- `index.tsx:handleOpenEmailClient`: calls `onOpenChange(false)` after it opens the mail link.
- `index.tsx:handleCopyDetails`: calls `navigator.clipboard.writeText(taskDetails)`. It shows "Task details copied to clipboard" or "Failed to copy to clipboard" for `TOAST_DURATION.SHORT`. After a successful copy it calls `onOpenChange(false)`.
- `index.tsx:handleNativeShare`: calls `navigator.share({ title, text: taskDetails })`. On success it shows a toast and calls `onOpenChange(false)`.
- `index.tsx:handleNativeShare`: on a failure other than abort, calls `logger.error("Failed to share task", error)` from `createLogger("UI")` and shows an error toast.
- `format-task-details.ts:formatTaskFooter`: does no I/O. It embeds the literal `https://gsd.vinny.dev` in the shared text.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
