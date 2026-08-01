# GSD current-state visual and interaction audit

**Audit date:** 2026-08-01

**Public baseline:** `https://gsd.vinny.dev/`, reported as v11.0.0 during capture

**Purpose:** establish the visual, interaction, responsive, and state-management baseline that the five `/design-lab` directions should preserve, repair, or deliberately challenge.

This is an audit, not a claim that every workflow was exercised end to end. The findings use the following evidence labels throughout:

- **LIVE** — observed in the public app in Chromium on 2026-08-01.
- **LOCAL** — observed in a service-worker-isolated render of the current source.
- **SOURCE** — verified in current repository code or tests, but not reproduced in the public app during this audit.
- **NOT EXERCISED** — deliberately outside the runtime pass; source inspection may still identify a risk.

## Method and evidence boundary

The public app was inspected at desktop and at a 390 × 844 coarse-pointer mobile emulation. The current local export was also inspected at 1280 × 800, 768 × 1024, and 375 × 812, including forced dark mode. Source review covered the matrix, quick capture, task cards, editing, search and command surfaces, Dashboard, Settings, first run, About, responsive navigation, theme behavior, and state branches.

The live pass did not dismiss or complete onboarding. It did not mutate real task data, sign in, enable sync, install the PWA, or exercise import/export. Mobile evidence came from Chromium emulation, not physical iOS Safari. Those limits matter: source-backed interaction risks below are not mislabeled as production reproductions.

## Audit assumptions

- The public v11.0.0 render is the shipped visual baseline; current local source
  is the authoritative implementation baseline when the two differ.
- GSD remains a personal, local-first priority tool. The audit does not optimize
  for multi-user project administration, enterprise reporting, or team workflow.
- The deterministic 12-task prototype dataset is large enough to compare
  hierarchy and state grammar, but it is not a performance or extreme-volume
  workload.
- Browser emulation is useful evidence for reflow and coarse-pointer geometry,
  but it is not equivalent to physical iOS, virtual-keyboard, safe-area, or
  assistive-technology testing.
- Calmness, trust, product fit, and likely migration cost are design judgments;
  observed behavior and measured results are labelled separately.

## Design questions the five concepts should answer

1. Should all four quadrants retain equal spatial weight, or should intentional
   focus—especially Schedule/Q2—dominate the daily surface?
2. Which capture placement best preserves speed and destination clarity across
   desktop, keyboard, and thumb-reach contexts?
3. How much density can GSD add before it loses its calm, personal character?
4. Can the matrix become a chapter sequence, queue table, focus field, or
   list/detail source model without obscuring urgency/importance semantics?
5. Which mobile navigation and review grammar remains understandable without
   depending on desktop spatial memory, color, hover, or icon recognition alone?

The public-baseline evidence is committed with the decision package:

- [First-run matrix · desktop](../../artifacts/design-exploration/00-current-state/gsd-live-matrix-first-run-desktop.png)
- [First-run matrix · dark desktop](../../artifacts/design-exploration/00-current-state/gsd-live-matrix-first-run-dark-desktop.png)
- [First-run matrix · 390 × 844](../../artifacts/design-exploration/00-current-state/gsd-live-matrix-first-run-mobile-390x844.png)
- [Help drawer · desktop](../../artifacts/design-exploration/00-current-state/gsd-live-help-drawer-desktop.png)
- [About · desktop](../../artifacts/design-exploration/00-current-state/gsd-live-about-desktop.png)
- [About features · desktop](../../artifacts/design-exploration/00-current-state/gsd-live-about-features-desktop.png)
- [About how it works · desktop](../../artifacts/design-exploration/00-current-state/gsd-live-about-how-it-works-desktop.png)
- [About · 390 × 844](../../artifacts/design-exploration/00-current-state/gsd-live-about-mobile-390x844.png)

## Executive assessment

GSD already has a recognizable core. The Albert Sans type, four-color mark, lavender-gray canvas, pale paper surfaces, restrained aubergine interaction color, and four quadrant families make the product feel calmer and more personal than a generic project-management tool. The matrix is still the strongest product argument: it turns urgency and importance into visible structure rather than another task attribute. `PRODUCT.md:23-58`, `app/css/inkwell-tokens.css:55-90`, `lib/quadrants.ts:78-170`.

The strongest production surface is the matrix itself. Its independently floating panes, constant 16px gutter, quiet washes, pigment rules, neutral metadata, and compact task cards make prioritization legible without tinting every detail. Loading is intentionally separated from empty, and dark mode is separately tuned instead of mechanically inverted. `components/matrix-simplified/matrix-grid.tsx:42-69`, `components/matrix-simplified/quadrant-pane.tsx:51-126`, `components/matrix-simplified/matrix-grid-skeleton.tsx:18-60`, `tests/data/violet-frost-theme.test.ts:147-173`.

The weakest seams are interaction trust and secondary-surface composition. A typed capture changes Tab into a permanent destination-cycle key until the user deletes or submits the draft; several Settings switches have no accessible name; search has three different contracts across Matrix, Dashboard, and the command palette; filtered-empty panes impersonate truly empty panes; and first run asks the user to traverse both a long marketing page and a second onboarding flow. Dashboard, Settings, and About also lean toward repeated rounded-card grids despite the product's explicit anti-reference. `PRODUCT.md:33-44`.

The five explorations should therefore vary composition, typography, density,
and emphasis while directly testing named controls, reliable focus return, 44px
coarse targets, 16px mobile inputs, explicit filter scope, and filtered-empty
recovery. Pending-safe writes plus distinct loading, true-empty, error, and
offline states remain production-grade requirements outside these in-memory
concepts.

## Current visual model

| Layer | Current behavior | Assessment |
| --- | --- | --- |
| Brand and shell | Albert Sans, four-color mark, restrained aubergine interaction ink, pale Violet Frost canvas, left rail on desktop and fixed bottom navigation below `md`. `components/matrix-simplified/app-shell.tsx:75-123`, `components/matrix-simplified/icon-rail.tsx:53-137` | Recognizable and calm. The shell becomes less deliberate at tablet/mobile widths. |
| Matrix | One column below `lg`; balanced 2 × 2 panes at `lg`; 16px gap at every breakpoint. `components/matrix-simplified/matrix-grid.tsx:42-69` | Strongest hierarchy in the product. Each quadrant remains spatially and verbally identifiable. |
| Pane anatomy | Quiet wash, stronger header band, 3px top pigment rule, icon, name, hint, active count, add action. `components/matrix-simplified/quadrant-pane.tsx:53-103` | Good color restraint and scanning. Heading semantics do not match the visual hierarchy. |
| Capture | Lightning marker, borderless input, live destination pill, optional Details control, and aubergine Add action. `components/matrix-simplified/capture-bar.tsx:140-234` | Excellent product-specific signature, but its keyboard and narrow-width contracts need repair. |
| Task cards | Inset 3px quadrant spine, title, optional description, neutral tags, progress/dependency metadata, completion disc, and responsive actions. `components/task-card/index.tsx:75-140`, `components/task-card/task-card-header.tsx:82-159`, `components/task-card/task-card-metadata.tsx:34-121` | Compact and information-rich without becoming enterprise-dense. Motion and some semantic color use are overextended. |
| Secondary surfaces | Dashboard metric cards, Settings section cards plus nested navigation, and a long About page with ten feature cards. `app/(dashboard)/dashboard/page.tsx:72-207`, `components/settings-page/index.tsx:18-57`, `components/about/features-section.tsx:84-129` | Consistent token use, but the repeated container grammar flattens hierarchy and approaches the generic SaaS anti-reference. |

## Responsive and theme behavior

### Desktop

- **LIVE:** at the inspected desktop width, the matrix resolved to four approximately 501 × 294px panes with exact 16px horizontal and vertical gaps. The sticky capture bar aligned to the matrix at approximately 1017 × 66px. No horizontal overflow was observed.
- **LIVE:** the onboarding dialog stayed centered with a legible single-column hierarchy over the dimmed matrix. It uses the product mark, one direct headline, a short explanation, progress indicators, and a full-width Next action.
- **LOCAL/SOURCE:** the expanded rail consumes 180px and the content is capped at 1320px. This feels appropriately quiet on wide screens. `components/matrix-simplified/icon-rail.tsx:58-60`, `components/matrix-simplified/app-shell.tsx:114-116`.
- **LIVE:** Help presents a readable 520px desktop drawer. Closing it with Escape or its close action returned focus to `BODY`, not the invoking Help control. The surface is visually calm, but the focus journey is incomplete. `components/matrix-simplified/app-shell.tsx:121-122`, `components/matrix-simplified/help-drawer.tsx:10-24`.

### Tablet

- **LOCAL/SOURCE:** the matrix intentionally stays in one column until `lg`, while the navigation rail defaults to 180px from `md` upward. At 768px, this leaves roughly 548-588px for content and makes Dashboard and Settings feel like desktop layouts squeezed beside a full rail. `components/matrix-simplified/matrix-grid.tsx:48`, `components/matrix-simplified/icon-rail.tsx:58-60`.
- **Recommendation:** collapse the rail to 60px by default in the tablet band and treat the 768-1023px composition as its own state, not merely a narrow desktop.

### Mobile

- **LIVE:** at 390 × 844 with a coarse pointer, quadrants stacked at approximately 347px wide, the page did not overflow horizontally, and bottom-navigation and quadrant-add targets expanded to 44 × 44px through the shared coarse-pointer rule. `app/globals.css:965-973`.
- **SOURCE:** the fixed bottom navigation is rendered before topbar and main content in DOM order because `IconRail` returns both desktop and mobile navigation before the content wrapper. Keyboard traversal can therefore begin at controls visually anchored to the bottom of the screen. No skip link compensates. `components/matrix-simplified/app-shell.tsx:78-81`, `components/matrix-simplified/icon-rail.tsx:105-135`.
- **SOURCE/LOCAL:** visible mobile navigation is icon-only. Accessible names exist, but persistent text labels would improve recognition for an infrequently used personal tool. `components/matrix-simplified/icon-rail.tsx:147-170`.
- **SOURCE/LOCAL:** matrix search is hidden below `sm`, while `/` still tries to focus its ref. At 375px the shortcut left focus on `BODY`; there is no visible mobile search replacement. `components/matrix-simplified/topbar.tsx:53-69`, `components/matrix-simplified/use-matrix-window-events.ts:92-107`.
- **SOURCE:** the capture bar remains a single non-wrapping row as destination and Details controls appear, and its input is 15px. This is a crowding risk at 320-390px and a candidate for iOS focus zoom. `components/matrix-simplified/capture-bar.tsx:140-213`.
- **NOT EXERCISED:** physical touch drag, iOS virtual-keyboard behavior, safe-area insets, installed-PWA chrome, and VoiceOver rotor order were not tested.

### Light and dark

- **LIVE:** switching to dark updated the document color scheme/theme metadata and replaced canvas, paper, ink, interaction, and quadrant wash colors coherently. It did not look like a mechanical inversion.
- **SOURCE:** dark mode uses the intentionally separate `#14131B` canvas, `#211F2B` paper, `#ECEAF2` primary ink, and `#A99BCB` interaction accent. Light and dark primary, muted, accent, and quadrant-title combinations have explicit contrast tests. `app/css/inkwell-tokens.css:176-207`, `tests/data/violet-frost-theme.test.ts:147-173`.
- **SOURCE:** the global reduced-motion reset covers transitions, animations, scroll behavior, and view transitions. `app/globals.css:621-637`.
- **SOURCE:** the compact theme toggle reasons from stored `theme`, not `resolvedTheme`. When stored theme is `system` and the OS is light, the control can say "Switch to Light Mode" and produce no visible first-click change. `components/theme-toggle.tsx:9-41`.

## Surface-by-surface audit

### Matrix and prioritization

What works:

- **LIVE/SOURCE:** the four full names, fixed spatial positions, icons, pigment rules, and ink-safe labels make color redundant rather than exclusive. `components/matrix-simplified/quadrant-pane.tsx:64-94`.
- **LIVE/SOURCE:** empty-state copy has a distinct tone per quadrant, and Eliminate correctly omits an add prompt. `components/matrix-simplified/quadrant-pane.tsx:103-141`, `lib/quadrants.ts:78-170`.
- **SOURCE:** incomplete tasks sort before completed tasks, then by due date, which supports scanning without an extra sort UI. `components/matrix-simplified/matrix-grid.tsx:28-40`.
- **SOURCE:** loading geometry mirrors the real matrix before truth-bearing empty messages appear. `components/matrix-simplified/matrix-grid-skeleton.tsx:18-60`.

Risks:

- **SOURCE — critical semantics:** pane names are styled `<span>` elements while task names are `<h3>`. The page moves from the shell `<h1>` directly to task `<h3>` and omits the matrix's primary groups from heading navigation. `components/matrix-simplified/quadrant-pane.tsx:76-84`, `components/task-card/task-card-header.tsx:96-108`.
- **SOURCE — high reliability:** DnD treats every `over.id` as a `QuadrantId`, even though sortable task cards are also droppable targets. Dropping over a card can pass a task ID into `parseQuadrantFlags`; the fall-through then rejects the operation rather than moving reliably. `lib/use-drag-and-drop.ts:58-85`, `lib/quadrants.ts:209-220`, `lib/tasks/crud/move.ts:14-47`.
- **LOCAL/SOURCE — high state clarity:** filtering uses the correct task set, but every zero-result quadrant renders its true-empty message and Add action while the header count still reports all active tasks. There is no query, zero-result summary, Clear search action, or explanation that tasks are hidden. `components/matrix-simplified/matrix-view.ts:65-83`, `components/matrix-simplified/quadrant-pane.tsx:103-141`, `components/matrix-simplified/index.tsx:258-277`.

### Quick capture

What works:

- **SOURCE:** the parser previews destination as the user types and keeps an explicit manual override. `components/matrix-simplified/capture-bar.tsx:97-122`.
- **SOURCE:** `n`, Shift+N, Enter, `!`, `*`, and tags create a strong keyboard-first product signature, and global shortcuts are suppressed while an editable element is focused. `components/matrix-simplified/capture-bar.tsx:35-95`, `components/matrix-simplified/help-drawer.tsx:86-119`.

Risks:

- **SOURCE — critical keyboard trap/data loss:** while the input contains text, both Tab and Shift+Tab are intercepted to cycle the destination. Keyboard users cannot leave without submitting or pressing Escape; Escape clears the entire draft before blurring. `components/matrix-simplified/capture-bar.tsx:127-138`.
- **SOURCE — high write trust:** submission calls `onSubmit` without awaiting it, immediately clears the draft, resets the destination, and triggers capture animation. A persistence failure later produces a toast, but the user's text is already gone and the interaction briefly reads as success. `components/matrix-simplified/capture-bar.tsx:111-125`, `components/matrix-simplified/index.tsx:109-121`.
- **SOURCE — high mobile/touch:** destination and Details omit the shared `touch-target` hook, and the dynamic control cluster has no mobile wrap state. `components/matrix-simplified/capture-bar.tsx:174-213`, `app/globals.css:965-973`.

### Task cards and edit flow

What works:

- **SOURCE:** quadrant identity is confined mainly to the inset spine and completion disc, while tags remain neutral. This preserves the matrix language without implying tags carry urgency. `components/task-card/index.tsx:101-114`, `components/task-card/task-card-metadata.tsx:34-55`.
- **SOURCE:** completion has a descriptive label, `aria-pressed`, `aria-busy`, a duplicate-write guard, and a transition-gated check animation. Touch restores the hidden drag grip and mobile card actions. `components/task-card/task-card-header.tsx:34-70`, `components/task-card/task-card-header.tsx:120-159`, `app/globals.css:951-973`.
- **SOURCE:** the edit drawer declares dialog/modal semantics, traps Tab in both directions, supports layered Escape for dependency suggestions, restores the prior focus on unmount, and prevents dependency cycles at save. `components/matrix-simplified/edit-drawer.tsx:46-119`, `components/matrix-simplified/use-dialog-focus.ts:8-45`, `components/matrix-simplified/edit-drawer-dependencies.tsx:11-35`.
- **SOURCE:** delete has a faithful Undo path that restores the original record. `components/matrix-simplified/index.tsx:168-183`.

Risks:

- **SOURCE — high form semantics:** `Field` is a `<label>` that wraps groups containing multiple buttons and inputs. Quadrant, due-date, tag, and dependency groups therefore have ambiguous label/control relationships; the dependency suggestion list also lacks combobox/listbox semantics and arrow-key navigation. `components/matrix-simplified/edit-drawer-fields.tsx:11-65`, `components/matrix-simplified/edit-drawer-dependencies.tsx:57-133`.
- **SOURCE — high pending state:** drawer submit discards the returned promise with `void`; Save/Create stays enabled and exposes no `aria-busy` state while persistence runs. `components/matrix-simplified/edit-drawer.tsx:79-95`, `components/matrix-simplified/edit-drawer.tsx:205-218`.
- **SOURCE — medium motion:** every card receives a mount entrance, and every already-completed card receives the completion flash whenever mounted. Motion communicates page load as if it were a new completion moment. `components/task-card/index.tsx:75-99`, `app/globals.css:443-481`.
- **SOURCE — medium semantic color:** partial subtask progress uses quadrant pigment even though the product contract reserves quadrant color for pane/card priority identity and success for completion. `components/task-card/task-card-metadata.tsx:57-81`, `.ui-craft/brief.md:84-90`.
- **SOURCE — medium readability:** task titles are forced to one truncated line and descriptions to two lines. This keeps density calm but can hide the distinguishing end of long, similar task names. `components/task-card/task-card-header.tsx:96-112`.

### Search and commands

What works:

- **SOURCE:** matrix search covers title, description, tags, and subtask titles, case-insensitively. `components/matrix-simplified/matrix-view.ts:11-27`.
- **SOURCE:** the command palette uses established dialog/list semantics, grouped results, a clear no-results state, focus behavior from `cmdk`, and meaningful task/action separation. `components/command-palette/index.tsx:73-137`.

Risks:

- **LOCAL/SOURCE — high:** Dashboard renders the same prominent search field but only stores the string; neither metrics nor navigation consume it. Typing changes the input and nothing else. `app/(dashboard)/dashboard/page.tsx:43-47`, `app/(dashboard)/dashboard/page.tsx:73-101`.
- **LOCAL/SOURCE — high:** matrix search presents filtered-empty as true empty, including misleading creation actions. A task created from that state may immediately disappear behind the still-active query. `components/matrix-simplified/quadrant-pane.tsx:103-141`.
- **LOCAL/SOURCE — high:** mobile hides matrix/Dashboard search and leaves `/` targeting the hidden field. `components/matrix-simplified/topbar.tsx:53-69`, `components/matrix-simplified/use-matrix-window-events.ts:92-107`.
- **SOURCE — medium:** matrix search, Dashboard search, smart views, and the command palette expose overlapping but inconsistent scope and result behavior. The UI does not teach which one filters in place, navigates, or executes actions.

### Dashboard and review

What works:

- **SOURCE:** loading, true-empty, and populated analytics are explicitly separated. The populated view includes completion trends, quadrant distribution, streaks, deadlines, tags, and time tracking rather than one vanity metric. `app/(dashboard)/dashboard/page.tsx:95-111`, `app/(dashboard)/dashboard/page.tsx:138-226`.
- **SOURCE:** deadline items navigate back to and highlight the corresponding task in the matrix. `app/(dashboard)/dashboard/page.tsx:51-58`.

Risks:

- **LIVE:** the true-empty state is a large approximately 969 × 218px card with "No tasks yet" but no direct create or return-to-matrix action. The copy uses an exclamation point despite the calmer product voice. `app/(dashboard)/dashboard/page.tsx:116-126`.
- **LOCAL/SOURCE — high:** Dashboard search is inert, as described above.
- **LOCAL/SOURCE — medium hierarchy:** "Dashboard" is repeated in shell and hero, while four equally weighted metric cards dominate the first populated row. This reads as a generic SaaS dashboard and pushes the more distinctive analysis lower. `app/(dashboard)/dashboard/page.tsx:72-101`, `app/(dashboard)/dashboard/page.tsx:144-176`.
- **SOURCE — medium accessibility:** period controls claim tab semantics without roving arrow-key behavior or `aria-controls`, and remain 32px without coarse-pointer expansion. Streak state is carried by colored dots and hover-only `title` text. `components/ui/segmented-control.tsx:18-43`, `components/dashboard/streak-indicator.tsx:45-61`.

### Settings

What works:

- **LOCAL/SOURCE:** explicit Light/Dark/Auto choices are easier to understand than a cycle-only theme control. Hash-based section deep links also provide a useful foundation. `components/settings/appearance-settings.tsx:24-58`, `components/settings-page/use-active-section.ts:18-68`.
- **SOURCE:** destructive and data-management operations are separated from appearance and feature preferences.

Risks:

- **LOCAL/SOURCE — critical accessibility:** most Radix switches have no accessible name. The visible row label is a sibling `<p>`, not a `<label>` or `aria-labelledby` target; the accessibility tree exposes controls simply as "switch." This affects Show completed, notifications, archive, and sync. `components/settings/shared-components.tsx:20-38`, `components/settings/appearance-settings.tsx:60-72`, `components/settings/notification-settings.tsx:41-53`, `components/settings/archive-settings.tsx:83-95`, `components/settings/sync-settings.tsx:108-123`.
- **LOCAL/SOURCE — critical touch:** the shared switch is 38 × 22px and does not opt into the coarse-pointer 44px rule. `components/ui/switch.tsx:13-28`, `app/globals.css:965-973`.
- **SOURCE — high recovery:** a settings initialization failure is logged but leaves `dataLoaded` false forever; the page therefore renders a spinner with no error message or retry path. `components/settings-page/use-settings-data.ts:51-79`, `components/settings-page/index.tsx:35-42`.
- **SOURCE — high CTA contract:** onboarding's "Sign in to sync" merely closes the tour and routes to Settings. Settings hides the Cloud Sync section when sync is not already enabled, so the named destination may not exist. `components/onboarding/onboarding-gate.tsx:83-89`, `components/settings-page/use-active-section.ts:46-57`.
- **LOCAL/SOURCE — medium composition:** the app rail, a second settings sidebar, 28px section cards, repeated page title, and a clipped horizontal mobile scroller create more navigation and container weight than the task itself needs. `components/settings-page/index.tsx:18-57`, `components/settings-page/settings-sidebar.tsx:23-58`, `components/settings-page/section-card.tsx:20-25`.

### Onboarding and About

What works:

- **LIVE/SOURCE:** onboarding is concise per step, has strong contrast, a clear progress indicator, Radix focus containment, Escape support, and 44px primary actions on coarse pointers. It teaches the quadrant model, capture grammar, and local-first posture in that order. `components/onboarding/onboarding.tsx:37-67`, `components/onboarding/onboarding.tsx:117-182`.
- **SOURCE:** About's detailed privacy section correctly distinguishes browser-local default behavior from optional sync and avoids unsupported encryption promises. `components/about/privacy-section.tsx:16-50`.

Risks:

- **LIVE/SOURCE — high first-run length:** a new visitor is first sent to a long marketing About page; selecting Open App then opens a separate onboarding modal. The inspected About page measured roughly 4,330px tall on desktop and 6,608px on mobile before the user reached the work surface. `components/first-time-redirect.tsx:8-37`, `components/about/hero-section.tsx:31-47`, `components/onboarding/onboarding-gate.tsx:68-89`.
- **LIVE/LOCAL — medium hierarchy:** About uses ten similarly rounded feature cards, and its very large marketing headline/copy such as "moves the needle" conflicts with the quieter, literal product voice. `components/about/features-section.tsx:25-81`, `components/about/features-section.tsx:84-129`, `components/about/hero-section.tsx:17-29`.
- **SOURCE — high accuracy:** the public MCP example advertises `GSD_SYNC_URL=https://gsd.vinny.dev/api`; the current MCP README requires `GSD_POCKETBASE_URL=https://api.vinny.io` and authentication. `components/about/mcp-section.tsx:9-20`, `packages/mcp-server/README.md:16-31`.
- **SOURCE — medium motion/progressive enhancement:** unrevealed About content starts at opacity zero and transitions for 600ms, double the documented 300ms ceiling. Reduced motion is handled, but a script failure can leave content invisible. `components/about/scroll-reveal.tsx:17-49`, `app/globals.css:641-658`, `DESIGN.md:324-329`.

## State coverage and truthfulness

| State | Current behavior | Audit judgment |
| --- | --- | --- |
| Matrix loading | Uneven skeleton cards preserve pane geometry and expose `role="status"`, `aria-busy`, and "Loading tasks." `components/matrix-simplified/matrix-grid-skeleton.tsx:13-60` | **Preserve.** It avoids making a false empty-state claim before IndexedDB resolves. |
| Matrix true empty | Each quadrant has specific copy; three have Add, Eliminate does not. `components/matrix-simplified/quadrant-pane.tsx:103-141` | Visually strong, though some actions miss coarse-target expansion. |
| Matrix filtered empty | Reuses true-empty copy/actions, with global active count unchanged. | **Repair.** It hides the filter and can make newly created tasks seem lost. |
| Matrix write error | Toasts report capture, edit, delete, completion, and drag failures. `components/matrix-simplified/index.tsx:109-128`, `components/matrix-simplified/index.tsx:168-184`, `components/matrix-simplified/index.tsx:228-256` | Error visibility exists; quick capture still destroys the draft before success. |
| Edit pending | Completion guards duplicates, but drawer Save/Create has no pending state. | **Repair.** Use disabled/busy controls and keep the draft authoritative until success. |
| Dashboard loading | Dedicated skeleton. `app/(dashboard)/dashboard/page.tsx:95-101` | Preserve. |
| Dashboard true empty | Large card with explanation, no action. `app/(dashboard)/dashboard/page.tsx:116-126` | Add a direct, literal next step. |
| Dashboard filtered empty | No real dashboard filter exists despite the search field. | Remove the inert control or implement results. |
| Settings loading | Spinner until all settings sources resolve. `components/settings-page/index.tsx:35-42` | Appropriate initially. |
| Settings error | Caught/logged while `dataLoaded` remains false. `components/settings-page/use-settings-data.ts:51-79` | **Repair.** Distinguish loading, ready, and recoverable error. |
| Command no results | Explicit "No results found." inside the command list. `components/command-palette/index.tsx:92-98` | Preserve and reuse as the clarity standard for search. |
| Offline/sync/auth | Source includes status surfaces, but the runtime audit did not exercise them. | **NOT EXERCISED.** Do not infer behavior from static copy. |

## Accessibility, keyboard, and touch summary

Recognizable strengths:

- Color is paired with full labels, icons, and position; raw quadrant pigment is not used as small body text. `PRODUCT.md:54-58`, `components/matrix-simplified/quadrant-pane.tsx:64-94`.
- Light and dark contrast floors are encoded as tests. `tests/data/violet-frost-theme.test.ts:147-173`.
- Global reduced-motion handling is comprehensive. `app/globals.css:621-637`.
- Command palette and edit drawer provide real dialog semantics and focus containment. `components/command-palette/index.tsx:73-90`, `components/matrix-simplified/edit-drawer.tsx:103-119`.
- Task completion exposes label, pressed state, busy state, and a pending guard. `components/task-card/task-card-header.tsx:34-47`, `components/task-card/task-card-header.tsx:120-159`.
- The shared `.touch-target` rule correctly expands opted-in compact controls on coarse pointers. `app/globals.css:965-973`.

Highest-priority accessibility gaps:

1. Capture takes over both Tab directions and requires destructive Escape to leave with a draft. `components/matrix-simplified/capture-bar.tsx:127-138`.
2. Settings switches are unnamed and physically undersized on coarse pointers. `components/settings/shared-components.tsx:20-38`, `components/ui/switch.tsx:13-28`.
3. Matrix pane titles are absent from heading navigation. `components/matrix-simplified/quadrant-pane.tsx:76-84`.
4. Mobile keyboard order starts with visually bottom-fixed navigation, and `/` targets a hidden search input. `components/matrix-simplified/app-shell.tsx:78-81`, `components/matrix-simplified/use-matrix-window-events.ts:92-107`.
5. Help does not restore focus to its invoking control in the live app.
6. Edit field groups use ambiguous labels and the dependency picker lacks full combobox/listbox behavior. `components/matrix-simplified/edit-drawer-fields.tsx:11-65`, `components/matrix-simplified/edit-drawer-dependencies.tsx:57-133`.
7. Multiple compact contextual controls rely on visual size and do not opt into the 44px coarse-pointer rule. Examples include capture destination/Details and the non-Eliminate empty-state CTA. `components/matrix-simplified/capture-bar.tsx:174-213`, `components/matrix-simplified/quadrant-pane.tsx:121-138`.

## Prioritized findings

### Critical

1. **Capture keyboard exit can destroy a draft.** **SOURCE.** Tab and Shift+Tab are consumed while text exists; Escape exits only by clearing the field. This violates predictable keyboard navigation and risks data loss.
2. **Settings switches are not identifiable to assistive technology.** **LOCAL/SOURCE.** Visible labels are disconnected siblings, so several controls expose only "switch."
3. **Settings switches miss the product's coarse-pointer floor.** **LOCAL/SOURCE.** The 38 × 22px primitive is below 44 × 44px and lacks the expansion class.
4. **The matrix's visible hierarchy is not its semantic hierarchy.** **SOURCE.** Quadrants are regions with span labels, while tasks begin at `<h3>`.

### High

1. **Quick capture clears and celebrates before persistence succeeds.** **SOURCE.** Restore-on-failure is impossible because the draft is discarded.
2. **DnD can treat a task ID as a quadrant ID.** **SOURCE.** Card-over-card drops can fail instead of reclassifying.
3. **Filtered-empty is indistinguishable from true empty.** **LOCAL/SOURCE.** Counts, copy, and actions contradict the active query.
4. **Dashboard search is inert.** **LOCAL/SOURCE.** A prominent field accepts input and produces no result.
5. **Mobile search has no working visible equivalent.** **LOCAL/SOURCE.** Search is hidden and `/` silently fails.
6. **Help loses the invocation point.** **LIVE.** Escape and Close return focus to `BODY`.
7. **First run is two introductions.** **LIVE/SOURCE.** About precedes a second modal tour before normal work begins.
8. **"Sign in to sync" does not initiate sign-in and can route to Settings with Cloud Sync hidden.** **SOURCE.** The action label overpromises.
9. **Settings failure is presented as permanent loading.** **SOURCE.** There is no error or recovery branch.
10. **About publishes obsolete MCP configuration.** **SOURCE.** The copy conflicts with the canonical package README.
11. **Tablet/mobile shell behavior is compressed desktop behavior.** **LOCAL/SOURCE.** Tablet retains a 180px rail; mobile navigation precedes main content in keyboard order.
12. **Capture and edit lack robust pending states.** **SOURCE.** Duplicate submits and premature optimistic feedback remain possible.

### Medium

1. Dashboard's repeated title and equal metric cards produce generic SaaS hierarchy.
2. About's ten-card catalogue and 600ms reveal conflict with the calm, literal product voice.
3. Settings adds a second navigation system and oversized card radius inside the app shell.
4. The cycle theme toggle can produce a no-op first click when stored theme is `system`.
5. Routine card mount and completed-card animations spend delight outside genuine moments.
6. Partial subtask progress uses priority pigment for a non-priority status.
7. Single-line task-title truncation protects density at the cost of long-title differentiation.
8. Dashboard tabs and streak indicators need stronger keyboard and non-color semantics.

## What should remain recognizable

1. **The matrix remains the home argument.** Preserve the four full quadrant names, spatial model, and urgency/importance semantics.
2. **Color remains restrained and redundant.** Keep quadrant pigment on structural priority cues; pair it with label, icon, and position; leave tags and unrelated metadata neutral.
3. **Violet Frost remains the Refined Evolution anchor.** Its light and dark surface stacks, Albert Sans, aubergine interaction ink, and four-color mark are credible product equity.
4. **The 16px floating-pane gutter remains a useful signature.** It makes four separate decisions read as one matrix without turning them into a table.
5. **Capture remains a first-class product surface.** The syntax preview and visible destination are more distinctive than a generic "new task" modal.
6. **Local-first remains literal.** Do not make account creation the main path or treat privacy as decorative marketing.
7. **Loading remains truthful.** Never show reassuring empty copy until task loading resolves.
8. **The command palette's semantic foundation remains.** Dialog, grouped results, arrow-key behavior, and an explicit no-results state are stronger than bespoke search interactions.

## Implications for `/design-lab`

All five directions should use the same deterministic tasks and the same state meanings. Visual variation should come from composition, typography, density, navigation, and attention—not from silently changing the matrix model or inventing five incompatible interaction contracts.

Production-grade requirements exposed by the audit:

These are requirements for a future production implementation, not a claim that
the in-memory concepts simulate every asynchronous state. The prototypes model
capture validation, editing, completion, search recovery, focus, themes, review,
and responsive behavior. They deliberately do not model persistence latency,
offline transitions, loading skeletons, write failures, or sync conflicts.

- Use real `<h2>` quadrant or section headings beneath the page `<h1>`.
- Let Tab and Shift+Tab leave capture normally. Provide a separate, documented destination-cycle shortcut and never make Escape the only non-submit exit if it deletes text.
- Await writes, expose pending/busy state, prevent duplicate submission, and retain or restore drafts on failure.
- Distinguish loading, true empty, filtered empty, recoverable error, offline, pending, and success.
- Name every control; use real labels/group semantics; implement full combobox/listbox behavior where search suggestions exist.
- Guarantee 44 × 44px coarse-pointer targets and at least 16px mobile input text.
- Provide an explicit, reachable mobile Search action and one understandable search scope.
- Restore focus to the invoking control after every dialog/drawer closes.
- Make tablet rail behavior and mobile safe-area/navigation behavior first-class layouts.
- Preserve all four quadrants as semantically reachable even when a direction visually emphasizes one.

Implementation seam:

- Do not mount `MatrixSimplified` five times. It owns IndexedDB reads, sync-adjacent task writes, notifications, DnD sensors, global shortcuts, dialogs, and auto-archive. `components/matrix-simplified/index.tsx:132-218`.
- Do not reuse production `CaptureBar` in the comparison view; each instance would register competing global `n`/Shift+N listeners. `components/matrix-simplified/capture-bar.tsx:57-95`.
- Keep prototype state local and deterministic. Reuse domain language and canonical quadrant mapping, but use lab-scoped components and tokens so concepts can diverge safely.
- Keep the lab out of the production route registry and persistence/sync/service-worker surfaces. Its purpose is comparison, not an alternate production mode.

Direction-specific opportunities:

| Direction | Audit-derived opportunity |
| --- | --- |
| Refined Evolution | Preserve Violet Frost and floating panes while repairing heading semantics, state clarity, pending behavior, focus return, and responsive control geometry. |
| Editorial Planner | Replace Dashboard/About card catalogues with asymmetric narrative hierarchy: one leading priority, supporting context, and a quieter review sequence. |
| Precision Utility | Make unified task search, explicit scope/result counts, keyboard-complete controls, and dense-but-readable metadata the signature. |
| Spatial Focus | Let Schedule or the active quadrant dominate while keeping all four quadrants named, reachable, and clearly differentiated from filtering or emptiness. |
| Native Calm | Treat platform behavior as the design: safe-area-aware mobile navigation, list/detail or sheet patterns, resolved system appearance, 44px controls, and one short first-run path. |

## Untouched and unproven flows

The following were not runtime-confirmed and must not be treated as passing merely because source or tests exist:

- Completing the onboarding sequence, replaying it from Settings, and exercising the Sign in action.
- Creating, editing, deleting, completing, recurring, dragging, or dependency-linking real tasks in the public app.
- Capture persistence failure, double-submit behavior, DnD over a card, and injected Settings errors.
- Authentication, OAuth callbacks, sync enablement, realtime sync, conflict behavior, account deletion, and sync history.
- Import/export/reset, archive, notifications permissions, timers, share, snooze, and PWA install/update/offline transitions.
- Physical iOS Safari, WebKit keyboard behavior, virtual-keyboard resize, safe-area handling, VoiceOver, and real touch DnD.
- Full dark-mode coverage of every secondary surface and every error state.

These gaps are verification work, not evidence against the source-backed findings. The design lab should make repaired contracts visible and testable, but it must not be presented as proof that untouched production flows are fixed.
