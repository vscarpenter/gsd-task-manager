# Review

Review is the weekly dashboard at `/dashboard`. It turns completed work into a verdict line, today's count, active tasks, completion rate, a streak, and upcoming deadlines. With no tasks it shows an empty state that points back to the matrix.

## Sub-features

- `review-empty` shows `Nothing to review yet` and returns to the matrix.
- `review-seeded` renders analytics for a known history.
- `review-completion-counts` leaves the empty state after one real completion.
- `review-alt-r` opens Review with the keyboard.
- `review-palette` opens Review from the command palette.

## How to get to it (user POV)

- Choose `Review` in the left navigation (`nav-dashboard`).
- Press `⌥R` on any page.
- Press `⌘K` and choose `View review`.

## Driving it with gsd-verify

Preconditions:

- `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`, run from the repository root.
- `gsd-verify up` printed `Ready`, and `gsd-verify doctor` exits 0.
- `review-seeded` uses `seed("dashboard")`. It writes four tasks completed on the last four local days, three open tasks, and one overdue task.

- **Empty state.** Choose `Review` with no tasks, then `Open matrix`. Run `gsd-verify drive review -g review-empty`. The heading `Nothing to review yet` shows, and the button returns to `matrix-grid`.
- **Seeded analytics.** Seed the history and choose `Review`. Run `gsd-verify drive review -g review-seeded`. `main` shows `Completed today 1`, `Streak 4 days`, and `Overdue (1)`, and the store holds four completed rows.
- **Real completion.** Add and complete a task, then choose `Review`. Run `gsd-verify drive review -g review-completion-counts`. The empty state is gone, and the row has `completedAt`.
- **`⌥R`.** Press it on the matrix. Run `gsd-verify drive review -g review-alt-r`. The URL becomes `/dashboard` and the `Review` heading shows.
- **Palette.** Press `⌘K` and choose `View review`. Run `gsd-verify drive review -g review-palette`. The URL becomes `/dashboard` and the `Review` heading shows.
- **Proof.** Run `gsd-verify drive review`. The `review-seeded/` folder in the printed evidence folder holds `seeded.png`, `seeded.aria.txt`, and `seed-rows.tasks.json`. The screenshot should read Active tasks 4 and Completion rate 50%.

## Gotchas

- Review's numbers count up in JavaScript during a view transition, so an early `page.screenshot()` shows values the page never settles on. Use `proof.capture`, which waits for identical frames.
- The verdict line (`You completed 2 tasks this week`) counts the calendar week, so with the same seed it changes with the weekday. Don't assert it. The journey asserts the day-relative numbers instead.
- Analytics bucket by `completedAt` on the local day. A run that crosses midnight can fail `Completed today` and the streak.
- `seed("dashboard")` writes completed rows straight to IndexedDB, so it proves rendering and nothing about completing a task. `review-completion-counts` is the journey that covers a real completion.
- The empty state hides the verdict, charts, and streak. An empty Review screenshot proves nothing about analytics.
