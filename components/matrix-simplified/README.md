# Matrix (simplified)

## Overview

This directory has the matrix page and the app shell that other pages reuse.
`MatrixSimplified` in `index.tsx` is the page root. It wires `useTasks`, dnd-kit, the capture bar, the Today strip, the quadrant grid, the edit drawer, and the task detail sheet.
`AppShell` supplies the topbar, the nav rails, the help drawer, and the command palette.
`task-actions.ts` holds the module-scope task mutation handlers, with toasts and undo.
The remaining files are field components for the edit drawer, pure view and copy derivation, and hooks for focus, history, overflow, and window events.

## Interface

Page, shell, and grid:

- `MatrixSimplified` (`index.tsx`): page root with no props. It composes `AppShell`, `CaptureBar`, `TodayStrip`, `MatrixGrid`, `EditDrawer`, `TaskDetailSheet`, `ShareTaskDialog`, and `DragLayer` inside a `DndContext`.
- `AppShell` (`app-shell.tsx`): layout shell. Props are `title`, `titleAsLabel`, `caption`, `searchQuery`, `onSearchChange`, `searchInputRef`, `topbarRightSlot`, `mainClassName`, `quietChromeOnScroll`, `fillViewport`, and `children`.
- `SimplifiedTopbar` (`topbar.tsx`): sticky header with the title, an optional search input, `SyncStatusDisplay`, and a right slot. Props are `title`, `titleAsLabel`, `caption`, `searchQuery`, `onSearchChange`, `searchInputRef`, `rightSlot`, and `quietOnScroll`.
- `IconRail` (`icon-rail.tsx`): renders `DesktopIconRail` and `MobileIconRail` together. Prop is `onHelp`.
- `DesktopIconRail` (`icon-rail.tsx`): collapsible side nav for `md` and up, with five route buttons, Help, and a collapse toggle.
- `MobileIconRail` (`icon-rail.tsx`): fixed bottom nav with six columns (five routes and Help), hidden at `md` and up.
- `MatrixGrid` (`matrix-grid.tsx`): groups tasks into q1 to q4 and renders one `QuadrantPane` per quadrant inside an axis-label frame.
- `MatrixGridSkeleton` (`matrix-grid-skeleton.tsx`): loading placeholder with no props. It has `role="status"`, `aria-busy`, and `aria-label="Loading tasks"`.
- `QuadrantPane` (`quadrant-pane.tsx`): droppable quadrant section. Props are `meta`, `tasks`, `allTasks`, the task handlers, `onAddInQuadrant`, `highlightedTaskId`, `onTaskRef`, and `sectionRef`.
- `ACTIVE_RENDER_CAP` (`quadrant-pane.tsx`): constant `50`. A pane renders this many active cards before a disclosure button.
- `DragLayer` (`drag-layer.tsx`): renders the dnd-kit `DragOverlay` with the task title and a hidden `role="status"` live region. Props are `task: TaskRecord | null` and `statusMessage: string`.
- `FilteredEmpty` (`filtered-empty.tsx`): empty state for a filter with no matches. Props are `query`, `viewName?`, and `onClear`.
- `MatrixBriefing` (`matrix-briefing.tsx`): props `tasks`, `mounted`, `isLoading`, and `onFocusSchedule`. It renders `MatrixIntro` and the lazy `WhatsNewCue` in `Suspense`.
- `MatrixIntro` (`matrix-intro.tsx`): presentational intro row. Props are `dateLabel`, `message`, `scheduleCount`, and `onFocusSchedule`.
- `MatrixCaption` (`matrix-caption.tsx`): props `active`, `completed`, `overdue`, and `mounted`. It renders active, done, and overdue pills.
- `SmartViewStrip` (`smart-view-strip.tsx`): pill row of "All tasks" and the smart views, with an overflow menu. Props are `views`, `activeViewId?`, `onSelectView(viewId)`, and `onClearView`.
- `SmartViewOverflowMenu` (`smart-view-strip.tsx`): "More" dropdown that lists the overflow smart views.
- `SyncStatusDisplay` (`sync-status-display.tsx`): renders `SyncButton` and a status line. Props are `isEnabled`, `lastSyncTime`, `retryCountdown`, `retryCount`, `pendingCount`, `error?`, and `formatRelativeTime`.
- `WhatsNewCue` (`whats-new-cue.tsx`): props `{ existingUser: boolean | null, releases?: readonly WhatsNewRelease[] }`. It renders "New in {version}: {headline}" with a link and a Dismiss button, or `null`.

Pure derivation:

- `filterTasks` (`matrix-view.ts`): `(tasks: TaskRecord[], query: string) => TaskRecord[]`. It matches a case-insensitive substring over title, description, tags, and subtask titles.
- `deriveMatrixView` (`matrix-view.ts`): `(MatrixViewInput) => MatrixView`. It applies the smart view or the show-completed base, then search, then tallies the header counts.
- `MatrixViewInput` (`matrix-view.ts`): interface `{ all, dependencyTasks?, showCompleted, smartViewsEnabled, activeSmartView, searchQuery }`.
- `MatrixView` (`matrix-view.ts`): interface `{ visibleTasks, total, completed, overdue, isFiltered, matchCount }`.
- `introDateLabel` (`intro-copy.ts`): `(now: Date) => string`. It formats with `Intl.DateTimeFormat` in `en-US` (long weekday, long month, numeric day).
- `deriveIntroStats` (`intro-copy.ts`): `(all: TaskRecord[]) => IntroStats`.
- `introMessage` (`intro-copy.ts`): `(stats: IntroStats) => string`. It returns one sentence that describes board state, chosen by priority.
- `IntroStats` (`intro-copy.ts`): interface `{ activeTotal, doFirstCount, eliminateCount, overdueTotal, overdueQuadrants }`.

Capture and task detail:

- `CaptureBar` (`capture-bar.tsx`): capture form. Props are `onSubmit(payload)`, optional `onMoreOptions(payload)`, and optional `inputRef`. It parses text with `parseCapture`.
- `CapturePayload` (`capture-bar.tsx`): interface with `title: string`, `urgent: boolean`, `important: boolean`, and `tags: string[]`.
- `useCapturePaste` (`use-capture-paste.ts`): `(onSubmit, onCaptured)` returns `{ pasteNote, onPaste, clearPasteNote }`. It submits each pasted line as its own capture payload.
- `TaskDetailSheet` (`task-detail-sheet.tsx`): read-only task `Dialog` with Mark done, Close, and Edit actions.
- `TaskDetailSheetProps` (`task-detail-sheet.tsx`): interface `open`, `task: TaskRecord | null`, `allTasks?`, `onClose`, `onEdit(task)`, and `onToggleComplete?(task, completedNext)`.
- `LengthLimitNote` (`limit-note.tsx`): renders `stringLimitMessage(field, max)` once `length` reaches `max`. Props are `field: LimitedField`, `length`, and `max`.

Edit drawer:

- `EditDrawer` (`edit-drawer.tsx`): modal create and edit drawer. Props are `open`, `task?`, `initialDraft?`, `allTasks?`, `onClose`, and `onSubmit(draft, taskId?, changed?)`.
- `EditDraft` (`edit-draft.ts`, also exported from `edit-drawer.tsx`): interface with `title`, `description`, `urgent`, `important`, `dueDate?`, `tags`, `dependencies`, `recurrence`, `subtasks`, `estimatedMinutes?`, `notifyBefore?`, `notificationEnabled?`, and `snoozedUntil?`.
- `Field`, `LimitNote` (`edit-drawer-fields.tsx`): a labeled wrapper (`as` is `"label"` or `"group"`) and a muted caption paragraph.
- `QuadrantField` (`edit-drawer-fields.tsx`): four `aria-pressed` quadrant buttons. Props are `urgent`, `important`, `onChange(urgent, important)`, and `escalation?`.
- `DueDateField` (`edit-drawer-fields.tsx`): `DUE_PRESETS` buttons, a custom date chip or date input, and `DueTimeControls`.
- `TagsField` (`edit-drawer-fields.tsx`): tag chips and a text input. Props are `tags`, `tagInput`, `onTagInputChange`, `onAddTag`, `onRemoveTag`, and `onTagKeyDown`. The input also calls `onAddTag` on blur, so leaving the field commits the typed tag.
- `RecurrenceField` (`edit-drawer-fields.tsx`): `aria-pressed` buttons for none, daily, weekly, and monthly.
- `SubtasksField` (`edit-drawer-fields.tsx`): checklist rows with toggle and remove, and an add input that commits on Enter.
- `EstimateField` (`edit-drawer-fields.tsx`): number input for the estimate in minutes. Props are `value: string` and `onChange(value: string)`.
- `DependenciesField` (`edit-drawer-dependencies.tsx`): combobox search over `allTasks` with chips and a portaled listbox. Props are `taskId?`, `dependencies`, `allTasks`, `onChange(ids)`, and `error?`.
- `findDependencyCycleError` (`edit-drawer-dependencies.tsx`): `(taskId, dependencies, allTasks) => string | null`. It returns a "Circular dependency" message for the first dependency that would create a cycle.
- `DueTimeControls` (`edit-drawer-due-time.tsx`): "All day" `Switch` and a time input while off. Props are `dueTime: string | undefined` (local "HH:mm") and `onDueTimeChange`.
- `EscalationHint` (`edit-drawer-escalation-hint.tsx`): renders "Moves to Do First" or "Moves to Delegate", or `null`. Prop is `escalation?: EscalationResult`.
- `ReminderField` (`edit-drawer-reminder-field.tsx`): "None" and the reminder-offset buttons. Props are `minutes: number | null` and `onChange(value: number | null)`.
- `SnoozeField` (`edit-drawer-snooze-field.tsx`): shows the snooze end time, `SNOOZE_PRESETS` buttons, and a Clear button.
- `TagChip` (`edit-drawer-tag-chip.tsx`): one removable tag chip. Props are `tag` and `onRemove(tag)`.
- `useEditDraftState` (`use-edit-draft-state.ts`): `(task, initialDraft, titleRef) => EditDraftState`. It seeds form state from the task (edit) or from `initialDraft` (create). Create mode never seeds the due date, and it reads `initialDraft.notifyBefore` only when `initialDraft.notificationEnabled` is truthy.
- `EditDraftState` (`use-edit-draft-state.ts`): interface of the drawer's form fields and setters, plus `toDraft`.
- `savedReminder` (`use-edit-draft-state.ts`): `(task, pick) => Pick<EditDraft, "notifyBefore" | "notificationEnabled">`.
- `changedDraftFields` (`use-edit-draft-state.ts`): `(start: EditDraft, current: EditDraft) => Partial<EditDraft>`. It returns the keys whose `JSON.stringify` value differs.
- `useSnoozeDraft` (`use-snooze-draft.ts`): `(task) => { snoozedUntil, setSnoozedUntil, canSnooze, draftFields }`.
- `useDrawerSave` (`use-drawer-save.ts`): `({ task, draft, baseline, allTasks, onSubmit, setDependencyError })` returns `{ saving, submit }`.
- `useDiscardGuard` (`use-discard-guard.ts`): `(dirty, onClose, drawerRef, titleRef)` returns `{ confirmingDiscard, keepEditingRef, requestClose }`.
- `useSuggestionCombobox` (`use-suggestion-combobox.ts`): `(open: boolean, { count, onPick, onDismiss }) => SuggestionCombobox`. It handles arrow, Enter, and Escape keys and tracks the anchor rect.
- `SuggestionCombobox` (`use-suggestion-combobox.ts`): interface `{ activeIndex, resetActive, anchorRect, anchorRef, onKeyDown }`.

Task actions (`task-actions.ts`):

- `handleCapture`: `(CapturePayload) => Promise<TaskRecord | null>`. It extracts URLs from the title, calls `createTask`, and returns `null` on error.
- `captureAndReveal`: `(payload, reveal: (taskId) => void) => Promise<boolean>`.
- `handleToggle`: `(task, completedNext, offerUndo) => Promise<boolean>`.
- `handleSnooze`: `(taskId, minutes) => Promise<void>`. `handleClearSnooze`: `(taskId) => Promise<void>`.
- `handleSaveForLater`, `handleMarkUrgent`: `(task, offerUndo) => Promise<boolean>`.
- `handleMoveTo`: `(task, target: QuadrantId, offerUndo) => Promise<boolean>`.
- `handleDuplicate`: `(task) => Promise<void>`.
- `saveEditedTask`: `(taskId, changed: Partial<EditDraft>) => Promise<void>`. It writes fields with `updateTask`, then applies `snoozedUntil`.
- `reportTaskMutationError`: `(error, action, userMessage, taskId?) => void`. It calls `logError`, then `toast.error`.
- `taskContext`: `(stored: TaskRecord[] | undefined, active: TaskRecord[]) => TaskRecord[]`. Returns `stored ?? active`.

Help drawer:

- `HelpDrawer` (`help-drawer.tsx`): renders a `Dialog` titled "How to use GSD" with `HelpGuideSections`. `HelpDrawerProps` is `{ open: boolean; onClose: () => void }`.
- `HelpGuideSections` (`help-drawer-sections.tsx`): `{ onClose }`. It renders 14 guide sections in a fixed order.
- `Section`, `Para`, `HelpLink`, `QuadrantLine`, `SyntaxRow`, `ShortcutRow` (`help-drawer-parts.tsx`): presentational parts of the guide.
- `bodyStyle`, `codeStyle` (`help-drawer-parts.tsx`): `React.CSSProperties` constants for guide paragraphs and inline code chips.

Shared hooks and helpers:

- `useMatrixWindowEvents` (`use-matrix-window-events.ts`): `(deps: MatrixWindowEventsDeps) => void`. It wires URL action parameters, deep-link parameters, the global `/` and `?` keys, and shell command window events.
- `MatrixWindowEventsDeps` (`use-matrix-window-events.ts`): interface with `searchInputRef`, `captureInputRef`, `openCreateDrawer`, `highlightTaskById`, `applySmartViewById`, and `focusQuadrant`.
- `useBackToClose` (`use-back-to-close.ts`): `(active: boolean, onBack: () => void) => void`. While active, browser Back calls `onBack`.
- `useDialogFocus` (`use-dialog-focus.ts`): `(open, ref)` returns an `onKeyDown` handler. It restores prior focus on close and traps Tab inside `ref`.
- `useModalSurface` (`use-modal-surface.ts`): `(onClose: () => void) => { onMouseDown, onClick }`. It returns backdrop handlers and locks body scroll while mounted.
- `usePaneOverflow` (`use-pane-overflow.ts`): `() => { containerRef, contentRef, moreBelow }`.
- `useSmartViewOverflow` (`use-smart-view-overflow.ts`): `(viewCount: number) => SmartViewOverflow`, which is `{ containerRef, ghostRef, visibleCount }`.
- `computeVisibleViewCount` (`use-smart-view-overflow.ts`): pure `(VisibleCountParams) => number`. `VisibleCountParams` is `{ viewWidths: number[], leadWidth, moreWidth, available, gap }`.
- `useSmartViews` (`use-smart-views.ts`): `(clearSearch: () => void) => SmartViewsState`, which is `{ smartViewsEnabled, smartViews, activeSmartView, applySmartViewById, clearSmartView }`.
- `useTaskHighlight` (`use-task-highlight.ts`): `(visibleTasks: TaskRecord[], clearSearch: () => void) => TaskHighlight`, which is `{ highlightedTaskId, handleTaskRef, highlightTaskById }`.
- `HighlightOptions` (`use-task-highlight.ts`): interface `{ focus?: boolean }`.
- `neighborFocusId` (`focus-after-removal.ts`): `(tasks, removedId) => string | null`.
- `focusTaskCard` (`focus-after-removal.ts`): `(taskId) => boolean`. It focuses the first enabled button in `[data-task-id="…"]`, or the card.
- `scheduleCardFocus` (`focus-after-removal.ts`): `(taskId) => void`. It calls `focusTaskCard` after two nested `requestAnimationFrame` callbacks.

## Invariants

Page and view:

- `index.tsx:useIsHydrated`, `useShowCompleted`: the server snapshots are `false`. Date and counts render only after hydration.
- `index.tsx:MatrixSimplified`: render order is the skeleton while `isLoading`, then `FilteredEmpty` when `isFiltered && matchCount === 0`, then `MatrixGrid`.
- `index.tsx:MatrixSimplified`: `TodayStrip` renders only when `mounted && !isLoading`.
- `index.tsx:MatrixSimplified`: the task inspector closes when `viewingTaskId` is set, loading has finished, and `all` has no matching task.
- `index.tsx:MatrixSimplified`: collision detection is `closestCorners`, because cards and quadrant panes are both droppables.
- `index.tsx:handleEditSubmit`: an edit with a `taskId` saves only `changed ?? draft`. A comment states that other drawer fields may be stale.
- `index.tsx:handleEditSubmit`: create spreads the whole draft. It sends empty `tags` and `dependencies` arrays as `undefined` and moves URLs from the title into the description.
- `index.tsx:handleDelete`: delete undo restores the exact original record with `restoreTask(task)`.
- `index.tsx:focusQuadrant`, `handleQuadrantRef`: focusing an unmounted quadrant stores the key in `pendingQuadrantRef`. Focus lands when that node's ref attaches.
- `matrix-view.ts:filterTasks`: a blank query returns the input list unchanged.
- `matrix-view.ts:deriveMatrixView`: ignores an active smart view unless `smartViewsEnabled`. With an active view, the base is `all`, whatever `showCompleted` says.
- `matrix-view.ts:deriveMatrixView`: applies the search query after the smart view. `isFiltered` is true for an effective smart view or a non-blank query.
- `matrix-view.ts:deriveMatrixView`, `tally`: counts tally `visibleTasks` when filtered and `all` otherwise. Overdue counts only incomplete tasks.
- `matrix-grid.tsx:groupByQuadrant`: urgent and important is q1, important only is q2, urgent only is q3, and the rest is q4.
- `matrix-grid.tsx:byActiveThenDueDate`: sorts incomplete tasks first, then `dueDate` ascending by `localeCompare`. Tasks without a `dueDate` come last.
- `matrix-grid.tsx:MatrixGrid`, `PANE_ROWS`: the grid has at most two columns, switched by the container query `@min-[696px]`. Pane rows have a 280px floor.
- `matrix-grid.tsx:AxisFrame`: axis labels are `aria-hidden` and hidden below the 696px container width.
- `matrix-grid-skeleton.tsx:CARD_COUNT`: skeleton card counts per pane are `[3, 2, 2, 1]`.
- `intro-copy.ts:deriveIntroStats`: skips completed tasks in every stat. It dedupes overdue quadrant titles in first-seen order.
- `intro-copy.ts:introMessage`: message priority is zero active, then overdue, then all in Eliminate, then a Do First majority. The last case is "Nothing is overdue."
- `intro-copy.ts:introMessage`: the Do First majority message requires `activeTotal >= 3 && doFirstCount * 2 > activeTotal`.
- `intro-copy.ts` (file header comment): the subtext never repeats the raw counts in the header pills. It names Schedule only as a capture marker, in the empty-board and all-in-Eliminate messages.
- `matrix-briefing.tsx:MatrixBriefing`: the date label is `null` until `mounted`. The message and `scheduleCount` are `null` until `mounted && !isLoading`.
- `matrix-briefing.tsx:countActiveSchedule`: the Schedule count is tasks with `!completed && !urgent && important`.
- `matrix-intro.tsx:MatrixIntro`: the Schedule button is disabled when `scheduleCount === null`. It spreads `autoComplete: "off"` so Firefox does not restore a disabled state.
- `matrix-caption.tsx:MatrixCaption`: pills show a non-breaking space until `mounted`. The overdue pill renders only when `mounted && overdue > 0`.

Shell:

- `app-shell.tsx:FILL_VIEWPORT_MAIN`: a comment requires `min-h-0!` on `main`. `globals.css` sets an unlayered `main` min-height that outranks layered utilities.
- `app-shell.tsx:AppShell`: `smartViewsEnabled` falls back to `false` when `getAppPreferences()` rejects. A `cancelled` flag drops the result after unmount.
- `topbar.tsx:SimplifiedTopbar`: the search input renders only when `onSearchChange !== undefined`.
- `topbar.tsx:topbarClassName`: the hidden topbar moves off screen only below `md`, and returns on focus-within.
- `icon-rail.tsx:MobileIconRail`: a tapped tab counts as active only while `tapped.from === pathname`.
- `icon-rail.tsx:DesktopIconRail`: route buttons are disabled while `isPending` from `useViewTransition`. A comment requires `overflow-clip`, not hidden, so the sticky column stays put.

Capture and panes:

- `capture-bar.tsx:CYCLE`, `cycleQuadrant`: the quadrant override cycles through `["q1", "q2", "q3", "q4", null]`.
- `capture-bar.tsx:CaptureBar.submit`: returns early while a save is in flight or while a cleared draft has not rendered (`submittingRef`, `awaitingClearRef`).
- `capture-bar.tsx:CaptureBar.submit`: with no visible title, it does not call `onSubmit`. It focuses the input.
- `capture-bar.tsx:CaptureBar.submit`: an `onSubmit` that returns `false` or rejects keeps the draft text and the override on screen.
- `capture-bar.tsx:CaptureBar.submit`: after a save, text and override clear only if they still equal the submitted draft.
- `capture-bar.tsx:CaptureBar.submit`: a set override replaces the parsed urgent and important flags with the override quadrant's flags.
- `capture-bar.tsx:AddButton`: the submit button is `disabled` until hydrated. A comment states that a native submit before hydration would reload the page.
- `capture-bar.tsx:CaptureBar` (keydown handler): ignores the `n` and Shift+`N` shortcuts on a default-prevented, repeat, or composing event. It also ignores them with a modifier key, an editable target, or an open modal.
- `use-capture-paste.ts:useCapturePaste`: intercepts a paste only when the text has a line break and at least two lines have visible text.
- `use-capture-paste.ts:useCapturePaste`: `MAX_PASTE_LINES` is 20. More lines sets the note "Paste up to 20 lines at a time." and adds nothing.
- `use-capture-paste.ts:tooLongLine`: any line whose URL-stripped title exceeds `SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH` blocks the whole paste before any save.
- `use-capture-paste.ts:saveInOrder`: saves lines in sequence and stops at the first `onSubmit` that returns `false` or throws.
- `quadrant-pane.tsx:CappedActiveList`: renders at most `ACTIVE_RENDER_CAP` (50) active cards until expanded. The header count still reports all active tasks.
- `quadrant-pane.tsx:QuadrantPane`: passes every task id to `SortableContext`, including deferred and completed ones.
- `quadrant-pane.tsx:QuadrantPane`: `meta.id` is the id of both `useDroppable` and `SortableContext`. A comment says drop-target resolution depends on the `SortableContext` id.
- `quadrant-pane.tsx:QuadrantPane`, `CompletedDisclosure`: completed tasks sit behind a disclosure that starts collapsed. With no completed tasks it renders nothing.
- `quadrant-pane.tsx:QuadrantPane`, `CappedActiveList`: a highlighted completed task forces the disclosure open. A highlighted task at index 50 or later forces show-all.
- `quadrant-pane.tsx:QuadrantPane`: the empty-state "Add to" button is omitted when `meta.rdKey` is `"q4"`.
- `filtered-empty.tsx:clip`: clips the displayed query to `MAX_QUERY_CHARS` (60) characters and an ellipsis. A non-blank `query` takes precedence over `viewName`.
- `limit-note.tsx:LengthLimitNote`: renders only when `length >= max`.
- `drag-layer.tsx:DragLayer`: renders `DragOverlay` with `dropAnimation={null}`. The overlay card is `aria-hidden`.
- `smart-view-strip.tsx:MAX_RENDERED_SMART_VIEWS`: slices rendered views to `SCHEMA_LIMITS.MAX_SMART_VIEWS + BUILT_IN_SMART_VIEWS.length`. The strip returns `null` with no views.
- `smart-view-strip.tsx:SmartViewIcon`: an icon string counts as a glyph only if it is an own key of `SMART_VIEW_ICONS`. Otherwise it renders as raw text.
- `smart-view-strip.tsx:SmartViewGhost`: the ghost row child order is `[lead, ...views, more]`, and the overflow hook relies on it. The row is `inert` and `invisible`.
- `use-smart-view-overflow.ts:GAP_PX`: is 8. A comment requires it to match Tailwind `gap-2` on the strip rows.
- `use-smart-view-overflow.ts:useSmartViewOverflow.measure`: skips measurement unless the ghost has `viewCount + 2` children. A container width of 0 or less shows every view.
- `sync-status-display.tsx:SyncStatusDisplay`: when enabled, precedence is retry countdown above 0, then `pendingCount > 0`, then `error`, then "All synced".

Task detail and edit drawer:

- `task-detail-sheet.tsx:TaskDetailSheet`: the dialog is open only when `open && task !== null`. The same condition gates `useBackToClose`.
- `task-detail-sheet.tsx:TaskDetailContent`: Edit closes the sheet first. `onCloseAutoFocus` calls `onEdit` after focus returns.
- `task-detail-sheet.tsx:TaskDetailContent`: a dependency id missing from `allTasks` renders as "Unavailable task" with no status.
- `edit-drawer.tsx:EditDrawer`: returns `null` when `open` is false. `EditDrawerForm` has the key `task?.id ?? "__create__"`, so the form remounts when the task changes.
- `edit-drawer.tsx:EditDrawerForm`: `dirty` is true when `JSON.stringify(draft.toDraft())` differs from the mount baseline, or when `draft.tagInput.trim() !== ""`.
- `edit-drawer.tsx:EditDrawerForm`: Escape, Back, backdrop, Cancel, and the header Close all go through `requestClose` from `useDiscardGuard`. Only Discard calls `onClose` directly.
- `edit-drawer.tsx:EditDrawerForm`: a comment explains the hand-rolled dialog. It keeps layered Escape: the first press closes the dependency popup and the second closes the drawer.
- `edit-drawer.tsx:DrawerFooter`: the submit button is disabled unless `hasVisibleText(draft.title)`.
- `edit-drawer.tsx:TitleAndDescriptionFields`: the title input has no `maxLength`. Its note counts the URL-stripped title against `SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH`. The description `maxLength` is `SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH`.
- `edit-drawer.tsx:handleTagKeyDown`: Enter or `,` adds the tag. Backspace with an empty `tagInput` removes the last tag.
- `edit-drawer-fields.tsx:TagsField`, `SubtasksField`: the inputs are disabled at `SCHEMA_LIMITS.MAX_TAGS` and `SCHEMA_LIMITS.MAX_SUBTASKS`. Their `maxLength` values are `TAG_MAX_LENGTH` and `SUBTASK_TITLE_MAX_LENGTH`.
- `edit-drawer-fields.tsx:EstimateField`: the number input declares `min={1}` and `max={10080}`.
- `edit-drawer-fields.tsx:DueDateField`: picking a preset clears the custom date. `DueTimeControls` renders only when `customDate || duePreset !== "none"`.
- `edit-drawer-due-time.tsx:DueTimeControls`: `dueTime === undefined` means all day. Switching All day off sets `DEFAULT_DUE_TIME` (`"09:00"`).
- `edit-drawer-dependencies.tsx:findDependencyCycleError`: skips dependency ids with no local task. A comment states that they may be unsynced and must be kept.
- `edit-drawer-dependencies.tsx:isCandidate`: excludes the task itself, selected ids, completed tasks, and tasks where `wouldCreateCircularDependency` is true.
- `edit-drawer-dependencies.tsx:matchingCandidates`: an empty query returns `[]`. Matches stop at `MAX_SUGGESTIONS` (8).
- `edit-drawer-dependencies.tsx:DependenciesField`: the search input is disabled at `SCHEMA_LIMITS.MAX_DEPENDENCIES`. Ids without a local record render no chip but stay in `dependencies`.
- `edit-drawer-reminder-field.tsx:REMINDER_OPTIONS`, `ReminderField`: listed offsets are 15, 30, 60, 120, and 1440 minutes. A stored value outside the list becomes its own option.
- `edit-drawer-snooze-field.tsx:SnoozeField`: a preset sets `Date.now() + preset.minutes * TIME_UNITS.MS_PER_MINUTE` as an ISO string.
- `edit-draft.ts:EditDraft`: comments state that an undefined `notifyBefore` means the global default. `snoozedUntil` saves separately, outside the draft schema.
- `use-edit-draft-state.ts:classifyExistingDate`: a due preset needs an exact day match. A comment states that a range match made save move untouched dates.
- `use-edit-draft-state.ts:parseEstimate`: returns minutes only when finite and above 0. An empty field must not become 0.
- `use-edit-draft-state.ts:appendTag`: trims, lowercases, and strips a leading `#`. It ignores blank and duplicate tags, and any tag past `SCHEMA_LIMITS.MAX_TAGS`.
- `use-edit-draft-state.ts:savedReminder`: an untouched reminder pick (`undefined`) in edit mode saves the stored pair unchanged. Off (`null`) keeps `notifyBefore` and sets `notificationEnabled` to false.
- `use-edit-draft-state.ts:changedDraftFields`: if `urgent` or `important` changed, the changed set includes both flags.
- `use-edit-draft-state.ts:useDueDateDraft.changePreset`: choosing a due preset clears `dueTime` to `undefined` (all day).
- `use-edit-draft-state.ts:useEditDraftState.toDraft`: trims `title` and `description`.
- `use-snooze-draft.ts:useSnoozeDraft`: a stored snooze counts only if it is in the future. `canSnooze` is `Boolean(task && !task.completed)`.
- `use-drawer-save.ts:useDrawerSave`: submit does nothing when the title has no visible text or a save is in flight.
- `use-drawer-save.ts:useDrawerSave`: the dependency cycle check runs only in edit mode. A cycle error calls `setDependencyError` and aborts.
- `use-drawer-save.ts:useDrawerSave`: edit mode passes `changedDraftFields(baseline ?? current, current)`. Create mode passes no `taskId` and no changed fields.
- `use-discard-guard.ts:useDiscardGuard`: `requestClose` dismisses an open prompt, else prompts if `dirty`, else calls `onClose`.
- `use-suggestion-combobox.ts:useSuggestionCombobox.onKeyDown`: Enter always calls `preventDefault`. `onPick` runs only when `activeIndex >= 0`. Escape is handled only while `open`.
- `use-suggestion-combobox.ts:useAnchorRect`: a comment requires `capture: true` on the scroll listener, because the drawer's scroll container does not bubble scroll to `window`.

Task actions and shared hooks:

- `task-actions.ts:handleToggle`: offers undo only when completing. Undo of a recurring completion also deletes the spawned `recurringInstance`.
- `task-actions.ts:saveEditedTask`: writes snooze after the other fields, so an explicit snooze wins over the reset from a changed due date or reminder.
- `task-actions.ts:saveEditedTask`: skips `updateTask` only when `snoozedUntil` is the sole changed key. Snooze minutes have a floor of 1.
- `task-actions.ts:handleCapture`: passes tags to `createTask` as `undefined` when the array is empty.
- `focus-after-removal.ts:neighborFocusId`: returns `null` when `removedId` is not in `tasks`. Candidates are incomplete and match the removed task's `urgent` and `important`.
- `use-back-to-close.ts:register`: all overlays share one history entry through a module-level `handlers` stack and an `entryPushed` flag.
- `use-back-to-close.ts:onPopState`: on Back, it pushes the entry again before it calls the topmost handler (`handlers.at(-1)`).
- `use-back-to-close.ts:releaseEntryIfIdle`: releases the entry only when no handlers remain, `entryPushed` is true, and `history.state.gsdOverlay === true`.
- `use-back-to-close.ts:register`: adds the `popstate` listener once (`listening` flag) and never removes it.
- `use-dialog-focus.ts:useDialogFocus`: the trap handles only `event.key === "Tab"`. A comment says to pair it with `role="dialog"` and `aria-modal="true"`.
- `use-modal-surface.ts:useModalSurface`: a backdrop click calls `onClose` only when both the mousedown and click targets equal `currentTarget`.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: the URL action effect acts only on query `action` `"new-task"` or `"capture"`, or fragment `action` `"capture"`.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: the legacy query `action=capture` only has its parameters stripped. Fragment capture calls `openCreateDrawer` only if `parseShareCaptureParams` returns a draft.
- `use-matrix-window-events.ts:stripActionParams`: strips `ACTION_PARAM_KEYS` (`["action", "title", "url", "tags"]`), read from the current address.
- `use-matrix-window-events.ts:onKey`: ignores a default-prevented, repeat, or composing event. It also ignores an event with a modifier key, an editable target, or an open modal.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: accepts the `focusQuadrant` query parameter only if it is in `["q1", "q2", "q3", "q4"]`. The `FOCUS_QUADRANT_EVENT` listener passes any truthy `detail.quadrant` to `focusQuadrant` unchecked.
- `use-smart-views.ts:useSmartViews`: `smartViewsEnabled` falls back to `false`, and `smartViews` to `[]`, when their loads reject. Disabling smart views clears `activeSmartView`.
- `use-smart-views.ts:applySmartViewById`: calls `clearSearch` before it sets the active view. It returns early when the view is not found.
- `use-task-highlight.ts:highlightTaskById`: `HIGHLIGHT_DURATION_MS` is 3500. The timer clears the highlight only if it still equals the same task id.
- `use-task-highlight.ts:useTaskHighlight.tryFocus`: retries on animation frames while the task is in `visibleTasks` and `attempts < 8`.
- `use-task-highlight.ts:revealTask`: scroll behavior is `"auto"` when `(prefers-reduced-motion: reduce)` matches, and `"smooth"` otherwise.
- `help-drawer-sections.tsx:HelpGuideSections`: a comment states that every client's guide shares the section order. It also says to change each claim together with the code it describes.
- `whats-new-cue.tsx:evaluateCue`, `useWhatsNewCue`: the cue is `null` when releases, `existingUser`, or `runningWebVersion()` is `null`. It evaluates only after hydration.

## Side Effects

- `index.tsx:handleEditSubmit`: calls `createTask` from `@/lib/tasks` without a `taskId`, or `saveEditedTask` with one. It shows "Task added" or "Task updated".
- `index.tsx:handleDelete`: calls `deleteTask(task.id)` from `@/lib/tasks`, then `handleSuccess("Task deleted. It's in Trash.", undo)` from `useErrorHandlerWithUndo`. Undo calls `restoreTask(task)`.
- `index.tsx:subscribeShowCompleted`: adds and removes a window listener for `SHOW_COMPLETED_EVENT` from `@/lib/preferences/show-completed`.
- `index.tsx:focusQuadrant`: calls `target.focus({ preventScroll: true })`, then `target.scrollIntoView({ block: "nearest", behavior: "auto" })`.
- `index.tsx:handleDelete`: calls `scheduleCardFocus(nextId)` after a delete. The grid's `onToggleComplete` does the same after a completion.
- `index.tsx:MatrixSimplified`: the grid's `onSave` calls `captureInputRef.current?.focus()` after `handleSaveForLater` resolves `true`. The `CaptureBar` `onSubmit` reveals the new card with `highlightTaskById(id, { focus: false })`.
- `app-shell.tsx:openCommandPalette`: dispatches `new CustomEvent(OPEN_COMMAND_PALETTE_EVENT)` on `window`. The constant comes from `@/lib/use-command-palette`.
- `app-shell.tsx:AppShell`: adds and removes window listeners for `"gsd:open-help"` and `APP_PREFERENCES_EVENT`. It calls `getAppPreferences()` from `@/lib/smart-views` on mount.
- `app-shell.tsx:AppShell`: calls `useAppShortcuts` from `@/lib/use-app-shortcuts` and `useShellCommandHandlers` from `@/lib/use-shell-command-handlers`.
- `topbar.tsx:SimplifiedTopbar`: calls `useSyncStatus` from `@/lib/hooks/use-sync-status` and `useScrollChrome(quietOnScroll)` from `@/lib/use-scroll-chrome`.
- `icon-rail.tsx:DesktopIconRail`: reads `readRailCollapsed` as initial state and calls `writeRailCollapsed(collapsed)` in an effect. Both come from `@/lib/preferences/icon-rail`.
- `icon-rail.tsx:DesktopIconRail`, `MobileIconRail`: call `navigateWithTransition(ROUTES[item.routeKey])` from `useViewTransition` for HOME, SAVED, DASHBOARD, SETTINGS, and ABOUT.
- `matrix-briefing.tsx:WhatsNewCue`: loads `./whats-new-cue` through React `lazy`. `MatrixBriefing` reads the clock with `new Date()` once mounted.
- `capture-bar.tsx:CaptureBar`: adds and removes a `window` `"keydown"` listener. Key `n` focuses the capture input. Shift+`N` calls `onMoreOptions`, then clears the text and the quadrant override when the text has visible characters. The Details button (`more-options`) calls `onMoreOptions` and always clears both.
- `capture-bar.tsx:useAdoptTypedText`: a layout effect reads the input's DOM value after hydration and copies it into state.
- `use-capture-paste.ts:useCapturePaste` (`onPaste`): reads `e.clipboardData.getData("text")` and calls `e.preventDefault()` for multi-line pastes.
- `quadrant-pane.tsx:QuadrantPane`: calls `useDroppable({ id: meta.id })` from `@dnd-kit/core` and registers the section node.
- `use-pane-overflow.ts:usePaneOverflow`: adds a passive `scroll` listener on the container and a `ResizeObserver` on the container and content. Cleanup disconnects it.
- `use-smart-view-overflow.ts:useSmartViewOverflow`: creates a `ResizeObserver` on the strip container and disconnects it on cleanup.
- `drag-layer.tsx:DragLayer`: writes `statusMessage` into an `aria-live="polite"` `role="status"` region.
- `task-detail-sheet.tsx:TaskDetailContent`: on open, records `document.activeElement` and focuses the close button. On close, calls `restoreFocusOrMainContent` from `@/lib/focus-restoration`.
- `task-detail-sheet.tsx:DetailActions`: the toggle button renders only when `onToggleComplete` is passed. It calls `onToggleComplete`, then `onClose`, so a toggle closes the sheet. Its label is "Mark not done" for a completed task.
- `edit-drawer.tsx:useEscapeToClose`: adds and removes a `window` `"keydown"` listener. Escape calls the latest `onClose`.
- `edit-drawer-dependencies.tsx:Suggestions`: renders the listbox through `createPortal` into `document.body`.
- `use-edit-draft-state.ts:useAutofocusTitle`: sets a `setTimeout` of `UI_TIMING.FOCUS_DELAY_MS`, then focuses `titleRef.current`. Cleanup clears it.
- `use-edit-draft-state.ts:appendSubtask`: calls `generateId` from `@/lib/id-generator` for each new subtask.
- `use-suggestion-combobox.ts:useAnchorRect`: adds window `scroll` (capture) and `resize` listeners while active.
- `use-discard-guard.ts:useWarnBeforeUnload`: adds a window `"beforeunload"` listener while `dirty` and sets `event.returnValue = ""`.
- `use-discard-guard.ts:useDiscardGuard`: focuses `keepEditingRef` when the prompt opens. It focuses the resume element or `titleRef` when the prompt closes.
- `use-dialog-focus.ts:useDialogFocus`: effect cleanup calls `previouslyFocused.current?.focus?.()`. A Tab wrap calls `first.focus()` or `last.focus()`.
- `use-modal-surface.ts:useModalSurface`: sets `document.body.style.overflow = "hidden"` on mount and restores the previous value on unmount.
- `use-back-to-close.ts:pushEntry`: calls `window.history.pushState({ gsdOverlay: true }, "")`.
- `use-back-to-close.ts:onPopState`, `releaseEntryIfIdle`: call `window.history.back()` to step past a stale overlay entry or to release the entry.
- `use-back-to-close.ts:unregister`: calls `setTimeout(releaseEntryIfIdle, 0)`.
- `task-actions.ts:reportTaskMutationError`: calls `logError` from `@/lib/error-logger` and `toast.error` with `TOAST_DURATION.LONG`. The toast text is `taskValidationMessage(error) ?? userMessage`, so a validation limit message replaces the caller's text.
- `task-actions.ts:handleCapture`: calls `createTask` from `@/lib/tasks` and shows "Added to {quadrant title}".
- `task-actions.ts:handleToggle`: calls `toggleCompleted` (and `deleteTask` in undo) from `@/lib/tasks`, and `celebrateCompletion` from `@/lib/confetti`.
- `task-actions.ts:handleSnooze`, `handleClearSnooze`, `handleDuplicate`: call `snoozeTask`, `clearSnooze`, and `duplicateTask` from `@/lib/tasks`, each with a success toast.
- `task-actions.ts:handleSaveForLater`: calls `saveTaskForLater` (and `returnSavedTask` in undo) from `@/lib/tasks/saved`.
- `task-actions.ts:handleMoveTo`, `handleMarkUrgent`: call `moveTaskToQuadrant` and `updateTask` from `@/lib/tasks`, and again in undo.
- `task-actions.ts:saveEditedTask`: calls `updateTask`, `clearSnooze`, and `snoozeTask` from `@/lib/tasks`.
- `focus-after-removal.ts:focusTaskCard`: finds the card with `document.querySelector('[data-task-id="…"]')` and calls `target.focus()`.
- `use-matrix-window-events.ts:stripActionParams`: calls `window.history.replaceState(window.history.state, "", ...)` without the action parameters.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: reads the query parameters `highlight`, `smartView`, and `focusQuadrant`, deletes them, then calls `window.history.replaceState({}, "", ...)`.
- `use-matrix-window-events.ts:onKey`: a window `keydown` listener. `/` focuses the search input. `?` dispatches `new CustomEvent("gsd:open-help")` on `window`.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: adds window listeners for `NEW_TASK_EVENT`, `FOCUS_CAPTURE_EVENT`, `FOCUS_QUADRANT_EVENT`, `HIGHLIGHT_TASK_EVENT`, `APPLY_SMART_VIEW_EVENT`, and the literal `"highlightTask"`.
- `use-matrix-window-events.ts:useMatrixWindowEvents`: uses a `setTimeout` of `UI_TIMING.FOCUS_DELAY_MS` and `window.requestAnimationFrame` to defer focus and deep-link work.
- `use-smart-views.ts:useSmartViews`: calls `getAppPreferences`, `getSmartViews`, and `getSmartView` from `@/lib/smart-views`. It listens for `APP_PREFERENCES_EVENT` on `window`.
- `use-smart-views.ts:applySmartViewById`: shows `toast.error("Smart view not found", { duration: TOAST_DURATION.SHORT })`.
- `use-task-highlight.ts:highlightTaskById`: sets a `window.setTimeout` of `HIGHLIGHT_DURATION_MS`. A new trigger and effect cleanup both clear it.
- `use-task-highlight.ts:revealTask`: calls `node.scrollIntoView({ block: "center", ... })` and, when asked, `node.focus({ preventScroll: true })`.
- `help-drawer.tsx:HelpDrawer`: on open, focuses the `[aria-label="Close"]` button. On close, calls `restoreFocusOrMainContent` from `@/lib/focus-restoration`.
- `help-drawer-sections.tsx`, `help-drawer-parts.tsx:HelpLink`: render `next/link` links to `ROUTES.SAVED`, `ROUTES.DASHBOARD`, `ROUTES.SETTINGS`, `ROUTES.ABOUT`, `"/sync-history"`, and `"/settings#feedback"`. Each calls `onClose` on click.
- `whats-new-cue.tsx:useWhatsNewCue`: subscribes to `subscribeLastSeenVersion` and `readLastSeenVersion`, and calls `recordLastSeenVersion`, from `@/lib/whats-new/last-seen`. It reads the bundled releases with `useWhatsNewReleases` from `@/lib/whats-new/load-releases` when no `releases` prop is passed.
- `whats-new-cue.tsx:WhatsNewCue`: renders a `Link` to `"/settings#whats-new"`. Dismiss calls `restoreFocusOrMainContent(null)`, then `recordLastSeenVersion`. A click on the link also calls `recordLastSeenVersion` with the running version.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
