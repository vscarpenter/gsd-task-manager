# Doc refresh: L3-design, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
| --- | --- | --- |
| Accuracy A1 (egm-codebase-details) | DESIGN.md lines 1-179 | ran |
| Accuracy A2 (egm-codebase-details) | DESIGN.md lines 180-300 | ran |
| Accuracy A3 (egm-codebase-details) | DESIGN.md lines 301-456 | ran |
| Accuracy A4 (egm-codebase-details) | .ui-craft/tokens.md | ran |
| Accuracy A5 (egm-codebase-details) | .ui-craft/brief.md, decisions.md, patterns.md, surfaces/saved.md | ran |
| Style S1 (egm-style) | all six files | ran |

Line numbers are the pre-edit numbers the reviewers saw.

## Findings

### L3-design-1-1 [A1] Severity: Major
* Target: DESIGN.md lines 172-175
* Finding: frontmatter `card` pairs a 12px radius with 24px padding. No shipped card has that pair. `.card` is 14px with 24px (`app/css/inkwell-components.css:291-295`). The task card is 12px with 12/12/24px padding (`components/task-card/index.tsx:76`). Dashboard cards use `rounded-lg` (14px).
* Decision: ESCALATE
* Reason: the radius ladder (card 12, pane 14) is a stated rule, repeated in `app/css/inkwell-tokens.css:10-11`. The code may be the side that drifted. See also 1-23.
* Edit: none

### L3-design-1-2 [A1] Severity: Major
* Target: DESIGN.md lines 176-178
* Finding: frontmatter `pane` uses `raised-light` (`#FBF9F3`). The only pane component sets its quadrant wash (`components/matrix-simplified/quadrant-pane.tsx:142`). `--oat` reaches the UI only through the top bar and the switch.
* Decision: ESCALATE
* Reason: one frontmatter value cannot hold four washes. Choosing the replacement value is a design call. Same issue as 1-56.
* Edit: none

### L3-design-1-3 [A1] Severity: Major
* Target: DESIGN.md lines 158-161
* Finding: `button-ghost` text is `slate-light`. Code is `.btn-ghost { color: var(--gray-700) }` (`inkwell-components.css:123`; `components/ui/button.tsx:9`).
* Decision: PROPOSE FIX
* Reason: confirmed in both files.
* Edit: `textColor` now references `{colors.neutral-700-light}`.

### L3-design-1-4 [A1] Severity: Major
* Target: DESIGN.md lines 146, 164
* Finding: button text is hard-coded `#FFFFFF` and the palette lists no on-color tokens. Code uses `--on-accent` and `--on-danger`, which are `#17150F` in dark (`inkwell-tokens.css:42,57,196,210,265,279`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added `on-accent-light`, `on-danger-light`, `on-accent-dark`, `on-danger-dark` to `colors`. `button-primary` and `button-danger` now reference the light on-color entries.

### L3-design-1-5 [A1] Severity: Nit
* Target: DESIGN.md lines 76-121 (serif and sans stacks)
* Finding: both stacks are shortened forms of `inkwell-tokens.css:93-94`.
* Decision: DECLINE
* Reason: the leading families match. The full fallback list belongs to the CSS.
* Edit: none

### L3-design-1-6 [A1] Severity: Nit
* Target: DESIGN.md lines 114-119
* Finding: `label` is sans, but a mono `.eyebrow` class also exists (`inkwell-components.css:65-69`), and the frontmatter has no mono family.
* Decision: DECLINE
* Reason: call sites use `text-eyebrow`, which is sans. The vendored `.eyebrow` class has no call site.
* Edit: none

### L3-design-1-7 [A1] Severity: Nit
* Target: DESIGN.md lines 120-125
* Finding: `numeral` omits its `-0.02em` tracking (`app/globals.css:109`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added `letterSpacing: "-0.02em"` to the frontmatter and the tracking to the Numeral line in section 3.

### L3-design-1-8 [A1] Severity: Nit
* Target: DESIGN.md lines 78-96
* Finding: heading weight 600 matches the `text-*` utilities, but the vendored `.t-*` classes use 500.
* Decision: DECLINE
* Reason: the document matches the path the app uses, and `tests/data/type-ramp.test.ts` pins 600.
* Edit: none

### L3-design-1-9 [A1] Severity: Nit
* Target: DESIGN.md lines 149, 157, 171
* Finding: `height: 38px` is `min-height: 38px` in code, 44px on coarse pointers.
* Decision: DECLINE
* Reason: section 5 already states the coarse-pointer rule.
* Edit: none

### L3-design-1-10 [A1] Severity: Nit
* Target: DESIGN.md lines 152-157, 166-171
* Finding: `button-secondary` and `input` omit their `--control-border` boundary.
* Decision: DECLINE
* Reason: section 5 states both boundaries in prose.
* Edit: none

### L3-design-1-11 [A1] Severity: Nit
* Target: DESIGN.md line 39
* Finding: `pane-border-light` has no dark partner. Code has `--pane-border: #322D24` in both dark branches (`inkwell-tokens.css:229,298`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added `pane-border-dark: "#322D24"`.

### L3-design-1-12 [A1] Severity: Nit
* Target: DESIGN.md frontmatter
* Finding: several code tokens have no frontmatter entry (`--ink-3`, `--ink-hint`, `--rail`, `--topbar`, `--sky`, `--info`, `--danger-fill-hover`, terminal tokens).
* Decision: DECLINE
* Reason: a full token inventory would drift. `.ui-craft/tokens.md` and the CSS own the detail.
* Edit: none

### L3-design-1-13 [A1] Severity: Nit
* Target: code, not the document
* Finding: `inkwell-components.css:3` and `app/globals.css:147` say Inkwell 1.3.1. `inkwell-tokens.css:3` says 1.4.0.
* Decision: DECLINE
* Reason: no document claim is wrong. Listed in the batch summary as a stale code comment.
* Edit: none

### L3-design-1-14 [A2] Severity: Major
* Target: DESIGN.md lines 222-223, 297-300
* Finding: the document says quadrant families are matrix-only and describe priority only. `app/globals.css:212` sets `--status-blocking-ink: var(--q4-ink)` in light. `components/task-card/swipeable-task-card.tsx:32` fills the Snooze swipe action with `QUADRANT_ACCENT.q4`.
* Decision: ESCALATE
* Reason: the document states a rule and the code breaks it. Listed under possible code defects.
* Edit: none

### L3-design-1-15 [A2] Severity: Nit
* Target: DESIGN.md line 244
* Finding: primary ink on paper is stated as 15.87:1. `#211E1A` on `#FFFFFF` computes to 16.60:1.
* Decision: PROPOSE FIX
* Reason: recomputed by hand (L = 0.01326).
* Edit: 15.87 changed to 16.60.

### L3-design-1-16 [A2] Severity: Nit
* Target: DESIGN.md lines 243-244
* Finding: muted text on paper is stated as 5.63:1. `#6E6760` on `#FFFFFF` computes to 5.57:1. The CSS comment says 5.6:1 (`inkwell-tokens.css:80`).
* Decision: PROPOSE FIX
* Reason: recomputed by hand (L = 0.1386).
* Edit: 5.63 changed to 5.57.

### L3-design-1-17 [A2] Severity: Nit
* Target: DESIGN.md line 243
* Finding: "Muted text uses `#6E6760` or darker" sits beside `--ink-3`, which is lighter.
* Decision: DECLINE
* Reason: the same paragraph scopes `--ink-3` to tertiary text and sends body text on ivory to `--gray-500`.
* Edit: none

### L3-design-1-18 [A2] Severity: Nit
* Target: DESIGN.md lines 227-240, 272-274
* Finding: tokens exist that the color section does not list.
* Decision: DECLINE
* Reason: same as 1-12.
* Edit: none

### L3-design-1-19 [A3] Severity: Major
* Target: DESIGN.md lines 389, 454
* Finding: the document warns against extending `.rd-*`. No `.rd-` class exists in any CSS or TSX file.
* Decision: PROPOSE FIX
* Reason: confirmed by search across `*.css`, `*.tsx`, `*.ts`.
* Edit: both lines now say the `.rd-*` system is retired and must not return. Removed the claim that it is a live deprecated system.

### L3-design-1-20 [A3] Severity: Major
* Target: DESIGN.md lines 389, 454
* Finding: `.matrix-card` still exists (`app/globals.css:461-482`), has no deprecation mark in code, and no component uses it. `.matrix-grid` (457-459) is also unused.
* Decision: ESCALATE
* Reason: "deprecated, do not extend" is policy and stays. Whether to delete the dead CSS is the owner's call. Listed under possible code defects.
* Edit: none

### L3-design-1-21 [A3] Severity: Major
* Target: DESIGN.md lines 345-353
* Finding: the document says each Tailwind spelling maps its step's token, line height and weight, pinned by `tests/data/type-ramp.test.ts`. `--text-2xl` has a size and line height only (`app/globals.css:102-103`). The test covers `sm`, `xs`, `base` only (lines 33-41).
* Decision: ESCALATE
* Reason: the document and the CSS comment at `globals.css:91-92` state the rule. The code and the test fall short of it. Same issue as 1-58.
* Edit: none

### L3-design-1-22 [A3] Severity: Major
* Target: DESIGN.md line 374
* Finding: "Expressive overlays: 20px". `components/ui/dialog.tsx:44,46` uses `md:rounded-2xl` and `rounded-t-3xl`, which `app/globals.css:114-120` does not remap (Tailwind defaults, 16px and 24px, inferred). Other 16px uses sit outside the ladder.
* Decision: ESCALATE
* Reason: the ladder is a stated rule. Rendered values were not measured. Listed under possible code defects.
* Edit: none

### L3-design-1-23 [A3] Severity: Major
* Target: DESIGN.md lines 372, 409
* Finding: "Default card radius is 12px" holds for task cards only. `.card` and several shipped cards use 14px.
* Decision: ESCALATE
* Reason: same as 1-1.
* Edit: none

### L3-design-1-24 [A3] Severity: Major
* Target: DESIGN.md lines 329, 372, 411
* Finding: the Review page's stats are not cards. `components/dashboard/stats-card.tsx:18-25` is borderless by design. The 12px radius and 20-22px padding exist only on the vendored `.stat-card` class (`inkwell-components.css:308-313`), which no component uses.
* Decision: PROPOSE FIX
* Reason: confirmed in `stats-card.tsx`.
* Edit: line 372 now names "the `.stat-card` primitive". Line 411 says the primitive uses 20-22px and the Review stats are borderless.

### L3-design-1-25 [A3] Severity: Major
* Target: DESIGN.md line 403
* Finding: "Status badges use complete semantic background/ink/border triples". `.badge-*` sets background and color only (`inkwell-components.css:284-288`). Task-card status chips set no border.
* Decision: ESCALATE
* Reason: the border tokens exist and `.alert` uses full triples (`inkwell-components.css:479-483`). The line may state the intended design. Listed under possible code defects.
* Edit: none

### L3-design-1-26 [A3] Severity: Major
* Target: DESIGN.md line 401
* Finding: "Default height is 22px with a 12px/500 label". `.badge` matches. `components/ui/badge.tsx:20` adds `py-1 uppercase tracking-wide`, and blocked and blocking chips use weight 600 (`task-card-metadata.tsx:93,102`). The rendered height is inferred.
* Decision: ESCALATE
* Reason: the primitive matches the document. The rendered result needs a browser. Listed under possible code defects.
* Edit: none

### L3-design-1-27 [A3] Severity: Major
* Target: DESIGN.md line 416
* Finding: "a tide boundary plus a 3px focus halo". `.input:focus` does that. `components/ui/input.tsx:18` adds `focus-visible:ring-2 ... ring-offset-2`, which likely replaces the halo's `box-shadow` (inferred).
* Decision: ESCALATE
* Reason: needs a rendered check. Listed under possible code defects.
* Edit: none

### L3-design-1-28 [A3] Severity: Major
* Target: DESIGN.md lines 379-381
* Finding: the motion vocabulary lists 120, 150 and 300ms. Components often use `duration-200`. `app/globals.css` also holds 0.16s, 0.28s, 0.32s, 0.35s and 0.6s. `--duration-normal` aliases `--t-slow` (`globals.css:232`).
* Decision: ESCALATE
* Reason: the vocabulary is a stated rule and the tokens match it. The call sites drift. Listed under possible code defects.
* Edit: none

### L3-design-1-29 [A3] Severity: Nit
* Target: DESIGN.md line 382
* Finding: "avoid bounce", but `--ease-pop`, `check-pop` and `capture-pop` overshoot.
* Decision: DECLINE
* Reason: design intent. Section 1 reserves delight for task completion.
* Edit: none

### L3-design-1-30 [A3] Severity: Nit
* Target: DESIGN.md line 335
* Finding: "The serif's one weight is 600", but Newsreader loads at 400, 500 and 600.
* Decision: PROPOSE FIX
* Reason: the sentence was true for the ramp only. Same issue as 1-50.
* Edit: now reads "Every serif step on the ramp uses weight 600".

### L3-design-1-31 [A3] Severity: Nit
* Target: DESIGN.md line 396
* Finding: destructive buttons have white text in light only. Dark `--on-danger` is `#17150F`.
* Decision: PROPOSE FIX
* Reason: confirmed (`inkwell-tokens.css:210,279`).
* Edit: added the dark-mode text value.

### L3-design-1-32 [A3] Severity: Nit
* Target: DESIGN.md line 411
* Finding: 24px padding is true for `.card` and `p-6` cards. Task cards use 12px and sweep and saved cards use 20/28px.
* Decision: DECLINE
* Reason: "standard" allows the exceptions. The radius and padding ladder is escalated under 1-1.
* Edit: none

### L3-design-1-33 [A3] Severity: Nit
* Target: DESIGN.md line 429
* Finding: the two-column switch is a container query at 696px, not a device breakpoint.
* Decision: DECLINE
* Reason: the sentence stays true for desktop and mobile layouts.
* Edit: none

### L3-design-1-34 [A3] Severity: Nit
* Target: DESIGN.md line 422
* Finding: below `md` a fixed bottom tab bar replaces the rail (`components/matrix-simplified/icon-rail.tsx:73,125-153`).
* Decision: PROPOSE FIX
* Reason: confirmed (`hidden md:flex` rail, `md:hidden` tab bar).
* Edit: added one sentence. Also added the ADR path for "v9 shell" (see 1-66).

### L3-design-1-35 [A3] Severity: Nit
* Target: DESIGN.md lines 357-359
* Finding: the document says the detector misses fractional and named sizes. `tests/data/type-ramp-usage.test.ts` now catches both in `components/` and `app/`.
* Decision: PROPOSE FIX
* Reason: confirmed in the test file (lines 14-17, 38-53).
* Edit: added two sentences naming the test and its CSS blind spot.

### L3-design-1-36 [A3] Severity: Nit
* Target: DESIGN.md line 387
* Finding: `.btn` has no `:active` or `:disabled` rule in CSS. Those states come from `components/ui/button.tsx`.
* Decision: DECLINE
* Reason: the canonical layer is `components/ui/*`, which carries all five states.
* Edit: none

### L3-design-1-37 [A3] Severity: Nit
* Target: code, not the document
* Finding: stale code comments: `app/globals.css:265-268` (mentions `text-title`, `text-label`), `matrix-grid.tsx:148-150` ("10px").
* Decision: DECLINE
* Reason: the document is right. Listed in the batch summary.
* Edit: none

### L3-design-1-38 [A4] Severity: Major
* Target: .ui-craft/tokens.md lines 148-151
* Finding: heading weights are given as 500. The `text-display` to `text-h3` utilities use 600 (`app/globals.css:64,68,72,76`), pinned by `tests/data/type-ramp.test.ts`. The `--t-*` tokens hold a size only.
* Decision: PROPOSE FIX
* Reason: confirmed. Same issue as 1-50.
* Edit: weights changed to 600. Added a short paragraph: the tokens hold size only, in rem, and the vendored `.t-*` classes still use 500.

### L3-design-1-39 [A4] Severity: Major
* Target: .ui-craft/tokens.md line 93
* Finding: Blocking aliases are said to map to the "slate family". Code maps pigment and tint to `--sky`, light ink to `--q4-ink`, dark ink to `--sky` (`app/globals.css:210-212,247,260`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: the line now states the real mapping. The Q4 borrow itself is escalated under 1-14.

### L3-design-1-40 [A4] Severity: Major
* Target: .ui-craft/tokens.md line 203
* Finding: "Every animation honors `prefers-reduced-motion`". `.animate-spin` is exempt on purpose and keeps a 1600ms rotation (`app/globals.css:684-694`).
* Decision: PROPOSE FIX
* Reason: confirmed.
* Edit: added the exception.

### L3-design-1-41 [A4] Severity: Nit
* Target: .ui-craft/tokens.md lines 148-155
* Finding: sizes are rem in code. The px values hold at a 16px root.
* Decision: PROPOSE FIX
* Reason: confirmed (`inkwell-tokens.css:97-107`).
* Edit: covered by the paragraph added for 1-38.

### L3-design-1-42 [A4] Severity: Nit
* Target: .ui-craft/tokens.md line 155
* Finding: eyebrow weight "500-600 by component". Code is 600 (`app/globals.css:89`).
* Decision: PROPOSE FIX
* Reason: confirmed. Same issue as 1-51.
* Edit: changed to 600.

### L3-design-1-43 [A4] Severity: Nit
* Target: .ui-craft/tokens.md lines 65, 71-72
* Finding: `--ink-3` is described as not for text, with scoped rebinding to `--gray-500`. The code comment calls it tertiary text, 4.55:1 on paper (`inkwell-tokens.css:68-74`). No rebinding exists in `app/`, `components/` or `lib/`.
* Decision: PROPOSE FIX
* Reason: confirmed by search. Same issue as 1-53.
* Edit: role cell and sentence rewritten to match the token file. Removed the rebinding claim.

### L3-design-1-44 [A4] Severity: Nit
* Target: .ui-craft/tokens.md line 143
* Finding: `.kicker` lives in `app/globals.css`, not `inkwell-components.css`.
* Decision: DECLINE
* Reason: the document does not name a file, and the rule sits in `@layer components`.
* Edit: none

### L3-design-1-45 [A4] Severity: Nit
* Target: .ui-craft/tokens.md
* Finding: many code tokens are not mentioned.
* Decision: DECLINE
* Reason: same as 1-12.
* Edit: none

### L3-design-1-46 [A5] Severity: Major
* Target: .ui-craft/brief.md line 77
* Finding: "all components are client components". Route files such as `app/saved/page.tsx` export `metadata` and carry no `"use client"`.
* Decision: PROPOSE FIX
* Reason: confirmed in `app/saved/page.tsx:1-5`.
* Edit: sentence rewritten.

### L3-design-1-47 [A5] Severity: Major
* Target: .ui-craft/brief.md lines 84-85
* Finding: learned constraint 1 says status pills read neutral. The overdue chip is rust tinted, and `tests/ui/task-card-anatomy.test.tsx:159-160` asserts it. `--status-overdue` shares the Q1 hex.
* Decision: ESCALATE
* Reason: a learned constraint is the owner's rule. A test pins the opposite behavior. The owner must say which one holds. Same issue as 1-52.
* Edit: none

### L3-design-1-48 [A5] Severity: Nit
* Target: .ui-craft/brief.md line 94
* Finding: "at 15px". The quadrant title uses `text-h3`, 19px (`quadrant-pane.tsx:160`).
* Decision: PROPOSE FIX
* Reason: confirmed. Same issue as 1-54.
* Edit: now reads "at the title's 19px (`text-h3`)".

### L3-design-1-49 [A5] Severity: Nit
* Target: brief.md lines 14, 46, 90; decisions.md lines 7-13, 52; saved.md lines 13-16
* Finding: six small points: the 1.3.1 comments in code; the count pill and palette badge also carry quadrant ink; the example entry in decisions.md; the "newest first" comment; Saved's placeholder omits subtasks; the Delete action is not a listed verb.
* Decision: DECLINE
* Reason: none misleads a reader about the code. The decisions.md points are escalated under 1-61.
* Edit: none

### L3-design-1-50 [S1] Severity: Blocker
* Target: DESIGN.md 78-96, 321-324, 335 against tokens.md 148-151
* Finding: serif heading weight is 600 in one file and 500 in the other.
* Decision: PROPOSE FIX
* Reason: code and test say 600.
* Edit: see 1-38 and 1-30.

### L3-design-1-51 [S1] Severity: Major
* Target: DESIGN.md 117, 328 against tokens.md 155
* Finding: eyebrow weight differs between the files.
* Decision: PROPOSE FIX
* Reason: code says 600.
* Edit: see 1-42.

### L3-design-1-52 [S1] Severity: Major
* Target: brief.md 84-85 against DESIGN.md 297-298, 403 and tokens.md 91-94
* Finding: one file says status pills are neutral. The others give status its own colored families.
* Decision: ESCALATE
* Reason: same as 1-47.
* Edit: none

### L3-design-1-53 [S1] Severity: Major
* Target: DESIGN.md 245-248 against tokens.md 65, 71
* Finding: `--ink-3` carries text in one file and is banned from text in the other.
* Decision: PROPOSE FIX
* Reason: the token file sides with DESIGN.md.
* Edit: see 1-43.

### L3-design-1-54 [S1] Severity: Major
* Target: brief.md 93-94
* Finding: "15px" matches no step on the ramp.
* Decision: PROPOSE FIX
* Reason: the title is 19px.
* Edit: see 1-48.

### L3-design-1-55 [S1] Severity: Major
* Target: DESIGN.md 305-306, 329-331, 455 against tokens.md 139-140
* Finding: the files disagree on what the serif carries. DESIGN.md also bans the serif from dense UI while card titles sit in the matrix.
* Decision: PROPOSE FIX
* Reason: `app/globals.css:375-396` wires the serif to the heading steps and the numeral.
* Edit: tokens.md now says the serif carries the display and heading steps and stat numerals. The "dense working UI" wording is intent and stays.

### L3-design-1-56 [S1] Severity: Major
* Target: DESIGN.md 176-178, 408, 427
* Finding: "pane" means a raised surface in one place and a quadrant wash in another.
* Decision: ESCALATE
* Reason: same as 1-2.
* Edit: none

### L3-design-1-57 [S1] Severity: Major
* Target: DESIGN.md 200-201 against brief.md 97-100
* Finding: Editorial was restored in August 2026, yet a constraint dated 2026-07-31 speaks of tide and Editorial.
* Decision: CONTEST
* Reason: `git log -- .ui-craft/brief.md` shows the file was rewritten by "restore the gsd editorial design system (#502)" on 2026-08-15. The dates mark when each rule was learned.
* Edit: none

### L3-design-1-58 [S1] Severity: Major
* Target: DESIGN.md 347-353
* Finding: "A spelling carries size only" sits beside "maps each spelling onto its step's token, line height, and weight".
* Decision: ESCALATE
* Reason: same as 1-21. The fix depends on whether `text-2xl` should carry the H2 weight.
* Edit: none

### L3-design-1-59 [S1] Severity: Major
* Target: DESIGN.md 329-331 against 345
* Finding: Numeral sits off a ramp that is called the whole type scale.
* Decision: CONTEST
* Reason: line 330 names Numeral as "the one role off the eight-step reading ramp". `app/globals.css:105-106` says the same. The exception is declared, not hidden.
* Edit: none

### L3-design-1-60 [S1] Severity: Major
* Target: DESIGN.md 193, 212, 229, 269, 394; tokens.md 52-53
* Finding: "paper" names the `--paper` token and also the canvas. "Dark paper ink `#17150F`" is the dark canvas value.
* Decision: PROPOSE FIX
* Reason: dark `--on-accent` is `#17150F`, equal to dark `--ivory` (`inkwell-tokens.css:189,196`).
* Edit: three places now give the hex and call it the dark canvas value. "Warm paper canvas" is descriptive and stays.

### L3-design-1-61 [S1] Severity: Major
* Target: decisions.md lines 4, 7-13, 37-38, 52
* Finding: a template entry sits in the log as an accepted decision. The header says append-only and the footer says newest first. "page < pane < card" does not name what it orders.
* Decision: ESCALATE
* Reason: the log is append-only by its own rule ("Never delete entries"). Removing or rewording entries is the owner's call.
* Edit: none

### L3-design-1-62 [S1] Severity: Major
* Target: patterns.md lines 8-22
* Finding: the file holds only the unfilled template. A5 raised the same point as a Major.
* Decision: ESCALATE
* Reason: a whole-file question. Nothing in it is checkable against code.
* Edit: none

### L3-design-1-63 [S1] Severity: Major
* Target: saved.md lines 13-16
* Finding: "Return reviews quadrant and optional due date" has no actor. "Removal" is undefined. "The short 600-character description" has no referent.
* Decision: PROPOSE FIX
* Reason: confirmed in `components/saved/saved-item-editor.tsx:39-56`, `components/saved/use-saved-actions.ts:37,48`, `components/matrix-simplified/task-actions.ts:137`, `lib/constants/schema.ts:20`.
* Edit: three sentences rewritten. The Undo sentence now also covers returning to the matrix.

### L3-design-1-64 [S1] Severity: Major
* Target: saved.md lines 3, 5, 10
* Finding: "Mode: Operate" is undefined. "A single reading list" narrows "reading material, ideas, and reference".
* Decision: ESCALATE
* Reason: "Mode" is ui-craft skill vocabulary that is not in this repository. The list wording is design intent.
* Edit: none

### L3-design-1-65 [S1] Severity: Major
* Target: DESIGN.md 193, 355, 388; brief.md 14, 71
* Finding: "Inkwell" is never defined.
* Decision: PROPOSE FIX
* Reason: `inkwell-tokens.css:1-13` defines it as the token system with "Brand palette: GSD Editorial".
* Edit: added two sentences to DESIGN.md section 1.

### L3-design-1-66 [S1] Severity: Major
* Target: DESIGN.md line 422
* Finding: "The v9 shell" has no referent.
* Decision: PROPOSE FIX
* Reason: `docs/adr/0011-v9-single-matrix-refactor.md` exists.
* Edit: added the ADR path.

### L3-design-1-67 [S1] Severity: Major
* Target: tokens.md lines 80, 82, 87, 93
* Finding: rows name no token ("the paired semantic ink", "Alternate information"). The `*-d`, `*-dark` pattern would wrongly include `--accent-d`. "Slate" names both `--slate` and the Q4 pigment.
* Decision: PROPOSE FIX
* Reason: `--info` and `--sky` are the tokens (`inkwell-tokens.css:65-66`). `--accent-d` is the hover color (line 41 area of the same file).
* Edit: added `--info` and `--sky` to the role cells. The tint-text sentence now lists the ink tokens by name. Line 93 is fixed under 1-39. No `--on-warning` token exists, so the Warning cell stays.

### L3-design-1-68 [S1] Severity: Major
* Target: DESIGN.md 333; tokens.md 148-155, 200
* Finding: `--t-*` names both type steps and durations.
* Decision: PROPOSE FIX
* Reason: both families exist in `inkwell-tokens.css` (100-107, 155-157).
* Edit: DESIGN.md now says "`--t-display` through `--t-eyebrow`".

### L3-design-1-69 [S1] Severity: Major
* Target: DESIGN.md 114, 312-313, 328; tokens.md 142-144, 155
* Finding: "eyebrow", "label" and "kicker" overlap. Frontmatter role names differ from the body's H1 and H2.
* Decision: CONTEST
* Reason: the code draws the same line: `app/globals.css:445-447` calls `.kicker` "the uppercase mono eyebrow voice" beside "the sans eyebrow". Frontmatter keys are format role names, not class names.
* Edit: none

### L3-design-1-70 [S1] Severity: Major
* Target: DESIGN.md 213, 311-314, 338-340, 455
* Finding: the Two-Voice Rule bans a third family, yet mono has an editorial kicker role.
* Decision: ESCALATE
* Reason: a statement of design intent. The document names the kicker as its one exception.
* Edit: none

### L3-design-1-71 [S1] Severity: Major
* Target: DESIGN.md line 222
* Finding: "more than 90% neutral surface and ink" has no measurement basis.
* Decision: ESCALATE
* Reason: a statement of intent. Not checkable from code.
* Edit: none
