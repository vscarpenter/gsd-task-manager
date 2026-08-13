# GSD Task Manager — Action Checklist

Derived from the review of **web app v11.2.1** on **12 Aug 2026**. Full findings and repro steps: `/home/user/gsd-review/index.html`

Effort estimates assume you're working solo in a codebase you know. Phases are ordered by risk retired per hour spent — Phase 0 is a single afternoon and clears everything that can cost a user data or trust.

---

## Phase 0 — Ship this week (an afternoon)

Three fixes, no new surface area, all of them close a hole where the app either loses data or misrepresents itself.

- [ ] **Stop sync toasts from preempting the Undo toast.** Give actionable toasts their own lane and queue status toasts instead of replacing them. *Today a delete during a pending sync becomes permanent while the UI still shows Undo — verified gone from both `tasks` and `archivedTasks`.* · **P0** · hours
- [ ] **Include every store in JSON export** — archived tasks, preferences, smart views, archive + notification settings, behind a version field. *Export currently writes 59 of 291 records.* · **P0** · hours
- [ ] **Make import handle archived records** on both merge and replace paths. · **P0** · hours
- [ ] **Fix the "Local storage · 59 tasks" figure** in Settings → Data & Storage to include archived tasks. *Understates the real footprint ~4×, two rows above "Reset everything".* · **P1** · <1 hour
- [ ] **Reconcile the About page with what ships.** Cut or badge the **Recurring Tasks** and **Subtasks** feature cards. · **P1** · <1 hour
- [ ] **Hide the Review page's Time Tracking panel** until estimates and timers have inputs. *Currently renders Total Tracked / Total Estimated / Estimation Accuracy / Running Timers with no way to enter any of it.* · **P1** · <1 hour
- [ ] **Hide the "Recurring Tasks" smart view** while recurrence has no UI. *It can only ever be empty.* · **P1** · <1 hour
- [ ] **Correct the Help drawer:** `Shift+N` is documented as opening "the full composer" but focuses the capture bar, and the drawer claims recurring tasks spawn next instances. · **P2** · <1 hour

---

## Phase 1 — Broken things (2–3 days)

- [ ] **Fix the keyboard drag drop handler.** Space lifts the card, an arrow previews it over the target quadrant, drop fails with "Failed to move task. Please try again." — reproducible in every direction, on blocked and unblocked tasks. · **P1** · half day
- [ ] **Log real error objects.** `[TASK_CRUD] [object Object]` and `[GSD Error] [object Object]` gave me nothing to diagnose the above with. Serialize name/message/stack/context. · **P2** · 1 hour
- [ ] **Gate the dnd-kit success announcement on the write resolving.** A screen-reader user is currently told "dropped over droppable area…" when the move silently failed. · **P1** · 1 hour
- [ ] **Manually verify pointer drag** on trackpad and touch. I could not complete a cross-quadrant pointer drag in automated testing (8px activation threshold + pointer sensor); drag is the headline interaction on the landing page, so confirm it by hand. · **P1** · 1 hour
- [ ] **Fix the stale `Blocking N` badge.** It counts all dependency edges, not open ones, so a blocker keeps its badge after the dependent task is completed — which also skews the "Ready to Work" view. · **P1** · 2 hours
- [ ] **Add complete-undo** ("Task completed · Undo"), reusing the delete toast pattern. *Highest relief-per-line-of-code item in the review: completion is the most frequent action, its checkbox sits inches from delete, and recovery today means enabling Show-completed and scrolling an 8,000px board.* · **P1** · 2 hours
- [ ] **Portal the Depends-on dropdown** with collision detection, and add arrow-key selection. *At 1280×720 the suggestion list renders behind the sticky Save footer and is un-clickable — the field is unusable until you zoom out.* · **P1** · half day
- [ ] **Audit other in-drawer popovers** for the same footer clipping. · **P2** · 1 hour
- [ ] **Lock body scroll while the edit drawer is open** (`overscroll-behavior: contain`), and check the drawer doesn't re-derive form state on scroll — I lost an in-progress title edit once during that interaction. · **P1** · 2 hours
- [ ] **Add a filtered-empty state.** Zero search results currently shows each quadrant's default empty copy ("Nothing on fire. / Stay sharp.") while the header still reads "5 active" — it looks like the board vanished. Add "No tasks match X", a result count, and a Clear chip. · **P1** · half day
- [ ] **Reflect the active filter in the header counts.** · **P2** · 1 hour

---

## Phase 2 — Polish (2–3 days)

- [ ] **Fix the palette quadrant badges** rendering as `UI` and `NUNI`. Use the quadrant name or Q1–Q4 with its colour dot. · **P2** · 1 hour
- [ ] **Make palette actions act.** "Export tasks as JSON" / "Import tasks from JSON" currently just open Settings at the Appearance tab — not the export, not even the `#data` anchor. · **P2** · 2 hours
- [ ] **Strip a leading `#` in search** so `#qa` matches the `qa` tag. Users type the syntax the capture bar taught them. · **P2** · 1 hour
- [ ] **Make tag chips on cards clickable** to filter by that tag. · **P2** · 2 hours
- [ ] **Stop the drag handle clipping the title's first character** on hover ("QA TEST 3" → "A TEST 3"). Reserve the gutter in the card grid. · **P2** · 1 hour
- [ ] **Collapse completed tasks** into a per-quadrant "12 done this week ▸" disclosure, default to the last 7 days. *Show-completed currently injects 51 cards and grows the page to ~8,000px, while quadrant counts still show active only.* · **P2** · half day
- [ ] **Strike or dim completed titles in the matrix**, consistent with the archive. In dark mode a completed card is nearly indistinguishable from an active one. · **P2** · 1 hour
- [ ] **Fix the mobile capture bar** covering task cards. Either let it scroll away behind a floating "+", or pin it with the header and add matching scroll padding. · **P2** · half day
- [ ] **Reconcile the Review streak.** "Streak 0 days" sits above a dot strip showing five of the last seven days filled. Either label it or fix the calculation. · **P2** · 2 hours
- [ ] **Wire up notification permission.** Settings shows "Push notifications · on" and a 15-minute default while "Browser permission · Not set" — reminders are silently off. Add an inline "Enable in browser" trigger and mark the toggle inactive until granted. · **P2** · half day
- [ ] **Enrich the task detail panel.** It shows title, tags and an Edit button; add created/completed dates, due date, dependency list, and complete/move actions so it isn't just a stop on the way to Edit. · **P2** · half day
- [ ] **Fix the Share modal's buttons** falling below the fold at 720px viewport height. · **P2** · 1 hour
- [ ] **Align version numbers** across surfaces (app footer v11.2.1 vs README 11.3.0). · **P2** · <1 hour

---

## Phase 3 — Structural safety (3–4 days)

- [ ] **Build a trash with 30-day retention.** Soft-delete instead of depending on a toast — the archive store already proves the pattern. This is what makes deletion structurally safe rather than timing-dependent. · **P0-adjacent** · 2–3 days
- [ ] **Add a backup nudge** — "your last export was N days ago" — given that clearing browser data erases everything. · half day
- [ ] **Add Settings → "Copy diagnostics"** dumping recent errors, version, and store counts, so bug reports from a no-analytics app are actionable. · half day
- [ ] **Test JSON import properly** — merge and replace paths, plus a deliberately malformed file. *I skipped this to avoid risking your live data; it's the other half of the backup story.* · half day
- [ ] **Test true offline behaviour** with the network severed, not just service-worker presence. · 2 hours

---

## Phase 4 — Close the claimed-vs-shipped gap (1–2 weeks)

Nearly half the task schema has no user-facing control. These are the fields already modelled and, in two cases, already advertised.

- [ ] **Recurrence UI** — daily / weekly / monthly. Already claimed on the About page, already in the schema, already has a smart view waiting for it. · 3–4 days
- [ ] **Subtasks / checklist UI** with progress shown on the card. Also already claimed on About. · 3–4 days
- [ ] **Estimate + timer controls**, so the Review page's Time Tracking panel has real data. · 3–4 days
- [ ] **Due times, not just dates.** "file taxes tomorrow at 3pm" currently keeps the words and drops the time. · 1–2 days
- [ ] **Snooze UI** (`snoozedUntil` already exists). · 1 day
- [ ] **Per-task reminders** in the composer (`notifyBefore`, `notificationEnabled` already exist). · 1–2 days

---

## Phase 5 — Workflow depth (2–3 weeks)

- [ ] **Multi-select and bulk actions.** The README notes batch ops were retired in v11; re-tagging or triaging 232 archived items is impossible today. · 3–4 days
- [ ] **Archive overhaul:** search, tag filter, "archived on" grouping, virtualised scrolling, and a single control set — the card controls (drag handle, mark-incomplete, edit, delete) currently overlap the archive's own Restore/Delete in the same corner. Promote Archive into the sidebar under Review. · 2–3 days
- [ ] **Deduplicate archived tasks** (the same Medium article appears twice) or at least surface likely duplicates. · 1 day
- [ ] **Natural-language dates in capture** — "tomorrow 3pm", "every Monday". The parser already handles `!`, `*` and `#`; dates are the obvious next token. · 3–4 days
- [ ] **Manual ordering within a quadrant.** There's no answer to "what first?" inside Do First. · 2 days
- [ ] **WIP limits / overload nudge** — "Do First has 12 items" is exactly the coaching this framework exists to give. · 2 days
- [ ] **User-defined smart views.** The `smartViews` store exists and is empty; there's no create-view UI. · 3–4 days
- [ ] **Tag management** — rename, merge, delete, colour. Your data already has `todo` (4/7) alongside `todos` (8/8). · 2–3 days
- [ ] **Task templates** for repeating checklists like the weekly review. · 2–3 days
- [ ] **Reconsider the unmarked-capture default.** A bare task previews as **Eliminate — "Noise. Stop doing these."** It's philosophically consistent, but it means the fastest path through the app files work into the quadrant that means "don't do this". Consider defaulting to Schedule, or an "Unsorted" inbox strip that must be triaged. *Product decision, but the one default I'd change.* · 1–2 days

---

## Phase 6 — Differentiators worth exploring

Where GSD could become the only app of its kind rather than the nicest Eisenhower app.

- [ ] **Make the Review page actionable.** It asks "What can leave the list?" and then offers no way to drop, reschedule, or delegate anything. A guided weekly triage — step through overdue, stale and Eliminate items and act inline — would be the strongest feature in the product, and no competitor does it well. · **Top pick** · 1–2 weeks
- [ ] **A time surface for Schedule.** An entire quadrant is about protecting time with no calendar view or ICS feed. Even a read-only week strip would land the promise. · 1–2 weeks
- [ ] **Staleness detection** — "created 74 days ago, never touched" is the most honest Eliminate signal available, and `createdAt` is already there. · 3–4 days
- [ ] **Deep links to tasks.** Share only copies text; a URL would make tasks referenceable from notes and email. · 2–3 days
- [ ] **Lean into link triage.** Most of your 287 tasks carry a URL and tags like `readme`, `todo`, `video` — in practice GSD is being used as much as a read-it-later tool as a task manager. Auto-fetch page title / favicon / reading time, a reading view, and a browser extension or share-target would fit the observed behaviour better than another priority field. · 1–2 weeks
- [ ] **Sync conflict resolution UI**, already listed as future work in the MCP README. · 1 week
- [ ] **Markdown rendering in descriptions.** The field is a multiline textarea labelled "details, links, context" and URLs autolink, so people will write markdown — `**bold**` currently renders literally on cards and in palette snippets. · 1–2 days

---

## Phase 7 — Landing page (1–2 days)

gsdtaskmanager.com is well built and undersells the product. Every link tested resolved; nothing is broken.

- [ ] **Name the depth that already ships.** Dependencies with cycle prevention, ten smart views, the Review analytics, keyboard-first navigation and the self-managing archive are all live and all absent from the page. Dependencies in a free personal task app is genuinely uncommon and isn't mentioned once.
- [ ] **Show the first 60 seconds.** A short captioned walkthrough of typing `!!` and watching it route would convert better than another privacy paragraph — the capture bar is the best demo you have.
- [ ] **Move MCP's prerequisite next to its CTA.** It requires sync plus OAuth, a constraint that only appears in the FAQ.
- [ ] **Add proof.** No testimonials, counts, or comparison against other Eisenhower or local-first apps. Even "built and used daily by its author since 2025" is proof.
- [ ] **State the local-data risk plainly.** The README warns that clearing browser data erases tasks; the page frames export as freedom, never as insurance. (Do this *after* export is complete — Phase 0.)
- [ ] **Disambiguate the Mac badge**, which points at the universal App Store listing rather than a distinct Mac storefront URL.
- [ ] **Decide what to do about recurrence and subtasks in marketing** once Phase 4 lands — right now the landing page is narrower than the product and the About page is broader than it.

---

## Suggested sequence

| Order | Phase | Elapsed | Why here |
|---|---|---|---|
| 1 | Phase 0 | An afternoon | Retires every finding that can cost data or trust |
| 2 | Phase 1 | 2–3 days | Fixes things that are simply broken |
| 3 | Phase 3 | 3–4 days | Makes deletion structurally safe, not timing-dependent |
| 4 | Phase 2 | 2–3 days | Removes the "is this broken?" moments |
| 5 | Phase 4 | 1–2 weeks | Closes the claimed-vs-shipped gap |
| 6 | Phase 7 | 1–2 days | Market the product you now actually have |
| 7 | Phase 5 | 2–3 weeks | Workflow depth |
| 8 | Phase 6 | Ongoing | Pick one — the actionable Review is the strongest |

**Totals:** 8 items in Phase 0, 11 in Phase 1, 13 in Phase 2, 5 in Phase 3, 6 in Phase 4, 10 in Phase 5, 7 in Phase 6, 7 in Phase 7 — **67 items**.
