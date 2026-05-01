# GSD Simplified v9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-view redesign matrix (Focus/Editorial/Canvas) with a single simplified Matrix view, 60px icon rail, and persistent capture bar with smart syntax — per `handoff_gsd_simplified_v9/README.md`.

**Architecture:** New `components/matrix-simplified/` module set replaces `components/redesign/`. Global `AppShell` (icon rail + per-route topbar) wraps Matrix, Dashboard, Settings, About, Archive, Sync-history. Capture bar is the only path to create tasks; composer drawer becomes edit-only. Smart syntax (`!`/`!!`/`*`/`#tag`) lives in `lib/capture-parser.ts`. Due-date presets resolve to ISO via `lib/due-date-presets.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind, dnd-kit, Dexie/IndexedDB, Vitest + React Testing Library. PocketBase sync stays untouched.

**Scope decisions (confirmed with user 2026-04-26):**
- A. Keep ⌘K command palette + smart views + filters. About goes in the left rail (Matrix / Dashboard / Settings / About + Help).
- B. Ship Matrix only — delete `view-focus.tsx`, `view-editorial.tsx`, `view-canvas.tsx`. No Layout preference in Settings.
- C. Big-bang replace on `feat/gsd-simplified-v9` — no flag.
- D. Due-date preset resolution: Today = today, This week = upcoming Friday, Next week = next Monday. Computed at submit time using `Date.now()`.
- E. Dashboard page content unchanged; only the shell around it changes.

**Out of scope:** Sync engine, MCP server, schema migrations, dependency/subtask UI, share/snooze/timer features (kept in code, hidden from card chrome where v9 simplifies the card). Bulk-select stays accessible via existing toolbar entry points but is removed from primary chrome.

**Verification contract (from README §Verification checklist — copy verbatim into Task 22):**
1. All four quadrant panes show their correct wash color (no stray paper/white panes).
2. Logo in rail does not exceed 32px wide. Lockup with wordmark only used outside the rail.
3. Page header on `/` reads "GSD Matrix" — not "Matrix".
4. Capture bar smart-syntax: `!!` → sienna dot; `!` → forest; `*` → indigo.
5. Clicking a task opens the edit drawer; no other path to the drawer exists.
6. `n` from anywhere focuses the capture bar.
7. Drag a task from one quadrant to another → urgent/important flags update and persist.
8. Dark mode: wash tokens render correctly (~10–12% opacity in dark).

---

## File structure (new + modified)

**New files:**
- `lib/capture-parser.ts` — smart-syntax parser (pure, testable)
- `lib/due-date-presets.ts` — preset → ISO date resolver
- `components/matrix-simplified/index.tsx` — top-level container (replaces `RedesignMatrix`)
- `components/matrix-simplified/icon-rail.tsx` — 60px nav rail
- `components/matrix-simplified/topbar.tsx` — slim sticky topbar with counts + search
- `components/matrix-simplified/app-shell.tsx` — rail + topbar wrapper used by all main routes
- `components/matrix-simplified/capture-bar.tsx` — persistent capture w/ smart syntax
- `components/matrix-simplified/quadrant-pane.tsx` — washed quadrant with drop zone
- `components/matrix-simplified/matrix-grid.tsx` — 2×2 layout
- `components/matrix-simplified/edit-drawer.tsx` — edit-only composer
- `tests/data/capture-parser.test.ts`
- `tests/data/due-date-presets.test.ts`
- `tests/ui/capture-bar.test.tsx`
- `tests/ui/edit-drawer.test.tsx`
- `tests/ui/matrix-simplified.test.tsx`

**Modified:**
- `app/globals.css` — add `--qN-wash` light + dark tokens
- `components/gsd-logo.tsx` — four-cell mark + add `<GsdLogoLockup>` export
- `app/(matrix)/page.tsx` — render `MatrixSimplified` instead of `RedesignMatrix`
- `app/(dashboard)/page.tsx`, `app/settings/page.tsx`, `app/about/page.tsx`, `app/(archive)/page.tsx`, `app/(sync)/sync-history/page.tsx` — wrap in `<AppShell>`

**Deleted (Task 19):**
- `components/redesign/` (entire folder)
- `components/view-toggle.tsx`
- `components/app-header.tsx`, `components/app-header/`
- `components/matrix-board.tsx`, `components/matrix-board/`, `components/matrix-column.tsx`
- `lib/redesign/`
- Tests covering the above (`tests/ui/matrix-board.test.tsx`, `tests/ui/matrix-page.test.tsx` updated to target new component)

---

## Task 1: Add quadrant wash tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add light-mode wash tokens to `:root`**

After the `--quadrant-eliminate` line (around line 29), append:

```css
  /* Quadrant washes — ~5% accent for pane backgrounds (v9 simplified) */
  --q1-wash: 194 65 12;        /* #c2410c at 4.5% via rgb(/0.045) at use-site */
  --q2-wash: 29 78 216;        /* #1d4ed8 at 4.5% */
  --q3-wash: 21 128 61;        /* #15803d at 5.0% */
  --q4-wash: 133 77 14;        /* #854d0e at 5.5% */
```

- [ ] **Step 2: Add dark-mode wash tokens to `.dark`**

Inside the `.dark { ... }` block, after `--quadrant-eliminate`:

```css
  /* Wash channels reused; opacity bumped at use-site for dark legibility */
  --q1-wash: 194 65 12;
  --q2-wash: 29 78 216;
  --q3-wash: 21 128 61;
  --q4-wash: 133 77 14;
```

- [ ] **Step 3: Add wash utility classes in `@layer components`**

Append inside `@layer components { ... }`:

```css
  .quadrant-wash-q1 { background-color: rgb(var(--q1-wash) / 0.045); }
  .quadrant-wash-q2 { background-color: rgb(var(--q2-wash) / 0.045); }
  .quadrant-wash-q3 { background-color: rgb(var(--q3-wash) / 0.05); }
  .quadrant-wash-q4 { background-color: rgb(var(--q4-wash) / 0.055); }

  .dark .quadrant-wash-q1 { background-color: rgb(var(--q1-wash) / 0.10); }
  .dark .quadrant-wash-q2 { background-color: rgb(var(--q2-wash) / 0.10); }
  .dark .quadrant-wash-q3 { background-color: rgb(var(--q3-wash) / 0.11); }
  .dark .quadrant-wash-q4 { background-color: rgb(var(--q4-wash) / 0.12); }
```

- [ ] **Step 4: Verify with bun**

```bash
bun run typecheck && bun run build 2>&1 | tail -20
```

Expected: build succeeds, no token errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(tokens): add q1-q4 wash tokens for v9 quadrant panes"
```

---

## Task 2: Replace logo with four-cell mark

**Files:**
- Modify: `components/gsd-logo.tsx`

- [ ] **Step 1: Rewrite `components/gsd-logo.tsx`**

Replace entire file content:

```tsx
interface GsdLogoProps {
  className?: string;
  size?: number;
}

export function GsdLogo({ className, size = 28 }: GsdLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="7" height="7" rx="1.6" fill="#1d4ed8" opacity="0.32" />
      <rect x="11" y="2" width="7" height="7" rx="1.6" fill="#c2410c" />
      <rect x="2" y="11" width="7" height="7" rx="1.6" fill="#15803d" opacity="0.32" />
      <rect x="11" y="11" width="7" height="7" rx="1.6" fill="#854d0e" opacity="0.32" />
    </svg>
  );
}

export function GsdLogoLockup({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <GsdLogo size={28} />
      <span
        className="font-semibold text-foreground"
        style={{ letterSpacing: "-0.02em" }}
      >
        GSD
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
bun typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/gsd-logo.tsx
git commit -m "feat(logo): replace mark with four-cell Q1-emphasis grid + add lockup"
```

---

## Task 3: Smart-syntax capture parser (TDD)

**Files:**
- Create: `lib/capture-parser.ts`
- Test: `tests/data/capture-parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/data/capture-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCapture } from "@/lib/capture-parser";

describe("parseCapture", () => {
  it("returns plain title with no flags when input has no markers", () => {
    expect(parseCapture("buy milk")).toEqual({
      title: "buy milk",
      urgent: false,
      important: false,
      tags: [],
    });
  });

  it("treats !! as urgent + important and strips the marker", () => {
    expect(parseCapture("ship release !! tomorrow")).toEqual({
      title: "ship release tomorrow",
      urgent: true,
      important: true,
      tags: [],
    });
  });

  it("treats single ! at word boundary as urgent only", () => {
    expect(parseCapture("call dentist !")).toEqual({
      title: "call dentist",
      urgent: true,
      important: false,
      tags: [],
    });
  });

  it("treats * at word boundary as important only", () => {
    expect(parseCapture("draft Q3 plan *")).toEqual({
      title: "draft Q3 plan",
      urgent: false,
      important: true,
      tags: [],
    });
  });

  it("does not treat ! inside a word as urgent", () => {
    expect(parseCapture("halt!stop")).toEqual({
      title: "halt!stop",
      urgent: false,
      important: false,
      tags: [],
    });
  });

  it("collects #tags and lowercases them", () => {
    expect(parseCapture("review PR #Work #Code-Review")).toEqual({
      title: "review PR",
      urgent: false,
      important: false,
      tags: ["work", "code-review"],
    });
  });

  it("handles all markers together", () => {
    expect(parseCapture("incident !! #ops #urgent")).toEqual({
      title: "incident",
      urgent: true,
      important: true,
      tags: ["ops", "urgent"],
    });
  });

  it("collapses whitespace after stripping markers", () => {
    expect(parseCapture("foo  !  bar")).toEqual({
      title: "foo bar",
      urgent: true,
      important: false,
      tags: [],
    });
  });

  it("returns empty title when input is whitespace only", () => {
    expect(parseCapture("   ")).toEqual({
      title: "",
      urgent: false,
      important: false,
      tags: [],
    });
  });
});
```

- [ ] **Step 2: Run test, confirm RED**

```bash
bun run test tests/data/capture-parser.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '@/lib/capture-parser'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/capture-parser.ts`:

```typescript
export interface ParsedCapture {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

const TAG_PATTERN = /(^|\s)#([a-z0-9_-]+)/gi;
const DOUBLE_BANG = /(^|\s)!!(\s|$)/g;
const SINGLE_BANG = /(^|\s)!(\s|$)/g;
const STAR = /(^|\s)\*(\s|$)/g;

export function parseCapture(input: string): ParsedCapture {
  let working = input;
  const tags: string[] = [];

  working = working.replace(TAG_PATTERN, (_match, lead: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return lead;
  });

  let urgent = false;
  let important = false;

  if (DOUBLE_BANG.test(working)) {
    urgent = true;
    important = true;
    working = working.replace(DOUBLE_BANG, "$1$2");
  }
  if (SINGLE_BANG.test(working)) {
    urgent = true;
    working = working.replace(SINGLE_BANG, "$1$2");
  }
  if (STAR.test(working)) {
    important = true;
    working = working.replace(STAR, "$1$2");
  }

  const title = working.replace(/\s+/g, " ").trim();
  return { title, urgent, important, tags };
}
```

- [ ] **Step 4: Run tests, confirm GREEN**

```bash
bun run test tests/data/capture-parser.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/capture-parser.ts tests/data/capture-parser.test.ts
git commit -m "feat(capture): add smart-syntax parser for v9 capture bar"
```

---

## Task 4: Due-date preset resolver (TDD)

**Files:**
- Create: `lib/due-date-presets.ts`
- Test: `tests/data/due-date-presets.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resolveDuePreset, DUE_PRESETS } from "@/lib/due-date-presets";

describe("resolveDuePreset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for 'none'", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z"));
    expect(resolveDuePreset("none")).toBeUndefined();
  });

  it("returns today's ISO date for 'today'", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z"));
    expect(resolveDuePreset("today")).toBe("2026-04-26");
  });

  it("returns the upcoming Friday for 'this-week' on a Sunday", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z")); // Sunday
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns this Friday when called on a Wednesday", () => {
    vi.setSystemTime(new Date("2026-04-29T10:00:00Z")); // Wednesday
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns next Friday when called on a Friday (after midnight)", () => {
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z")); // Friday itself
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns next Friday when called on a Saturday", () => {
    vi.setSystemTime(new Date("2026-05-02T10:00:00Z")); // Saturday
    expect(resolveDuePreset("this-week")).toBe("2026-05-08");
  });

  it("returns next Monday for 'next-week' from a Sunday", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z")); // Sunday
    expect(resolveDuePreset("next-week")).toBe("2026-04-27");
  });

  it("returns the following Monday for 'next-week' from a Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T10:00:00Z")); // Monday
    expect(resolveDuePreset("next-week")).toBe("2026-05-04");
  });

  it("exports preset list in display order", () => {
    expect(DUE_PRESETS).toEqual([
      { value: "none", label: "None" },
      { value: "today", label: "Today" },
      { value: "this-week", label: "This week" },
      { value: "next-week", label: "Next week" },
    ]);
  });
});
```

- [ ] **Step 2: Run test, confirm RED**

```bash
bun run test tests/data/due-date-presets.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Write implementation**

Create `lib/due-date-presets.ts`:

```typescript
export type DuePreset = "none" | "today" | "this-week" | "next-week";

export const DUE_PRESETS: { value: DuePreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "today", label: "Today" },
  { value: "this-week", label: "This week" },
  { value: "next-week", label: "Next week" },
];

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDuePreset(preset: DuePreset, now: Date = new Date()): string | undefined {
  if (preset === "none") return undefined;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") return toIsoDate(today);

  if (preset === "this-week") {
    const dow = today.getDay(); // 0=Sun, 5=Fri
    let daysToFri = (5 - dow + 7) % 7;
    if (dow === 6) daysToFri = 6; // Saturday → next Friday
    const fri = new Date(today);
    fri.setDate(today.getDate() + daysToFri);
    return toIsoDate(fri);
  }

  // next-week → next Monday strictly after today
  const dow = today.getDay();
  const daysToMon = ((1 - dow + 7) % 7) || 7; // 0 → 7 (next week)
  const mon = new Date(today);
  mon.setDate(today.getDate() + daysToMon);
  return toIsoDate(mon);
}
```

- [ ] **Step 4: Run tests, confirm GREEN**

```bash
bun run test tests/data/due-date-presets.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/due-date-presets.ts tests/data/due-date-presets.test.ts
git commit -m "feat(due-date): add preset resolver for v9 capture/edit"
```

---

## Task 5: IconRail component

**Files:**
- Create: `components/matrix-simplified/icon-rail.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  CircleHelpIcon,
  InfoIcon,
  LayoutGridIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import { ROUTES, isRouteActive, type RouteKey } from "@/lib/routes";
import { useViewTransition } from "@/lib/use-view-transition";
import { cn } from "@/lib/utils";

interface IconRailProps {
  onHelp: () => void;
}

interface RailItem {
  routeKey: RouteKey;
  label: string;
  icon: LucideIcon;
}

const PRIMARY: RailItem[] = [
  { routeKey: "HOME", label: "Matrix", icon: LayoutGridIcon },
  { routeKey: "DASHBOARD", label: "Dashboard", icon: BarChart3Icon },
  { routeKey: "SETTINGS", label: "Settings", icon: SettingsIcon },
  { routeKey: "ABOUT", label: "About", icon: InfoIcon },
];

export function IconRail({ onHelp }: IconRailProps) {
  const pathname = usePathname();
  const { navigateWithTransition, isPending } = useViewTransition();

  return (
    <aside
      className="hidden md:flex md:w-[60px] md:shrink-0 md:flex-col md:items-center md:border-r md:border-border/70 md:bg-background"
      aria-label="Primary navigation"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center gap-1 py-3.5">
        <div className="mb-2.5 flex h-8 w-8 items-center justify-center" title="GSD">
          <GsdLogo size={28} />
        </div>
        <div className="my-1 h-px w-6 bg-border/70" aria-hidden />
        {PRIMARY.map((item) => (
          <RailButton
            key={item.routeKey}
            label={item.label}
            icon={item.icon}
            active={isRouteActive(pathname, item.routeKey)}
            disabled={isPending}
            onClick={() => navigateWithTransition(ROUTES[item.routeKey])}
          />
        ))}
        <div className="flex-1" />
        <RailButton label="Help · Keyboard shortcuts" icon={CircleHelpIcon} onClick={onHelp} />
      </div>
    </aside>
  );
}

function RailButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        active
          ? "bg-background-muted text-foreground"
          : "text-foreground-muted hover:bg-background-muted/60 hover:text-foreground",
        disabled && "cursor-wait opacity-60"
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Verify ROUTES.ABOUT exists**

```bash
grep -n "ABOUT" lib/routes.ts
```

If absent, add `ABOUT: "/about"` and `isRouteActive(pathname, "ABOUT")` support to `lib/routes.ts` in the same task.

- [ ] **Step 3: Commit**

```bash
git add components/matrix-simplified/icon-rail.tsx lib/routes.ts
git commit -m "feat(shell): add 60px icon rail for v9"
```

---

## Task 6: SimplifiedTopbar component

**Files:**
- Create: `components/matrix-simplified/topbar.tsx`

- [ ] **Step 1: Create component**

```tsx
"use client";

import type { RefObject } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { SyncStatusDisplay } from "@/components/app-header/sync-status-display";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  caption?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  rightSlot?: React.ReactNode;
}

export function SimplifiedTopbar({
  title,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  rightSlot,
}: TopbarProps) {
  const syncStatus = useSyncStatus();
  const hasSearch = onSearchChange !== undefined;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-border/60",
        "bg-background/85 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-7"
      )}
    >
      <div className="min-w-0 flex-shrink-0">
        <h1
          className="rd-serif text-2xl leading-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
        {caption ? (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground-muted">
            {caption}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      {hasSearch ? (
        <div className="relative hidden w-72 sm:block">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search tasks…"
            className="pl-9"
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks"
          />
        </div>
      ) : null}

      <div className="hidden sm:block">
        <SyncStatusDisplay {...syncStatus} />
      </div>

      {rightSlot}
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/matrix-simplified/topbar.tsx
git commit -m "feat(shell): add slim simplified topbar component"
```

---

## Task 7: AppShell wrapper

**Files:**
- Create: `components/matrix-simplified/app-shell.tsx`

- [ ] **Step 1: Create wrapper**

```tsx
"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { IconRail } from "./icon-rail";
import { SimplifiedTopbar } from "./topbar";
import { HelpDrawer } from "@/components/redesign/help-drawer";

interface AppShellProps {
  title: string;
  caption?: ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  topbarRightSlot?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  title,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  topbarRightSlot,
  children,
}: AppShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <IconRail onHelp={() => setHelpOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SimplifiedTopbar
          title={title}
          caption={caption}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
          rightSlot={topbarRightSlot}
        />
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 sm:px-9 sm:py-6">
          {children}
        </main>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
```

> **Note:** `HelpDrawer` is reused from `components/redesign/`. In Task 19 (cleanup), move/copy it into `components/matrix-simplified/help-drawer.tsx` before deleting the redesign folder, and update this import.

- [ ] **Step 2: Commit**

```bash
git add components/matrix-simplified/app-shell.tsx
git commit -m "feat(shell): add AppShell wrapper composing rail + topbar"
```

---

## Task 8: CaptureBar component

**Files:**
- Create: `components/matrix-simplified/capture-bar.tsx`
- Test: `tests/ui/capture-bar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureBar } from "@/components/matrix-simplified/capture-bar";

describe("<CaptureBar>", () => {
  it("submits parsed title with urgent+important when '!!' is typed", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "ship release !!{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({
      title: "ship release",
      urgent: true,
      important: true,
      tags: [],
    });
  });

  it("clears input after successful submit", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");
    expect(input.value).toBe("");
  });

  it("does not submit empty input", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole("form", { hidden: true }) ?? document.querySelector("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Tab cycles destination quadrant override (q1 → q2 → q3 → q4 → auto)", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "task body");
    await userEvent.tab(); // q1
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ urgent: true, important: true }));
  });

  it("global 'n' key focuses the input when no editable field is focused", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    fireEvent.keyDown(window, { key: "n" });
    expect(document.activeElement).toBe(input);
  });
});
```

- [ ] **Step 2: Run test, confirm RED**

```bash
bun run test tests/ui/capture-bar.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Implement component**

Create `components/matrix-simplified/capture-bar.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightIcon } from "lucide-react";
import { parseCapture } from "@/lib/capture-parser";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

export interface CapturePayload {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

interface CaptureBarProps {
  onSubmit: (payload: CapturePayload) => void | Promise<void>;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}

const CYCLE: (RedesignQuadrantKey | null)[] = ["q1", "q2", "q3", "q4", null];

const ACCENT_BY_KEY: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

function deriveAutoKey(urgent: boolean, important: boolean): RedesignQuadrantKey {
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent) return "q3";
  return "q4";
}

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

export function CaptureBar({ onSubmit, inputRef: externalRef }: CaptureBarProps) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<RedesignQuadrantKey | null>(null);
  const internalRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (externalRef) externalRef.current = internalRef.current;
  }, [externalRef]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        internalRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parsed = parseCapture(text);
  const autoKey = deriveAutoKey(parsed.urgent, parsed.important);
  const effectiveKey = override ?? autoKey;
  const meta = quadrantByRdKey(effectiveKey);
  const accent = ACCENT_BY_KEY[effectiveKey];

  const cycleQuadrant = () => {
    const idx = CYCLE.indexOf(override);
    setOverride(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!parsed.title) return;
    const flags = override
      ? quadrantByRdKey(override)
      : { urgent: parsed.urgent, important: parsed.important };
    void onSubmit({
      title: parsed.title,
      urgent: flags.urgent,
      important: flags.important,
      tags: parsed.tags,
    });
    setText("");
    setOverride(null);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
    else if (e.key === "Tab" && text.trim()) {
      e.preventDefault();
      cycleQuadrant();
    } else if (e.key === "Escape") {
      setText("");
      setOverride(null);
      internalRef.current?.blur();
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5",
        "shadow-sm transition-shadow focus-within:border-foreground-muted focus-within:shadow-md"
      )}
      aria-label="Capture a task"
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: text.trim() ? accent : "rgb(var(--foreground-muted) / 0.5)" }}
        title={meta.title}
      />
      <input
        ref={internalRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onInputKey}
        placeholder="Capture a task… use ! urgent  * important  #tag"
        aria-label="Capture a task"
        className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] leading-snug text-foreground outline-none placeholder:text-foreground-muted"
      />
      {text.trim() ? (
        <button
          type="button"
          onClick={cycleQuadrant}
          title="Tab to cycle quadrant"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {meta.rdShort}
          {override ? <span className="ml-1 font-normal normal-case opacity-60">·fixed</span> : null}
        </button>
      ) : (
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground-muted">
          n
        </span>
      )}
      <button
        type="submit"
        disabled={!parsed.title}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-medium",
          "bg-foreground text-background hover:bg-foreground/90",
          "disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        Add
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests, confirm GREEN**

```bash
bun run test tests/ui/capture-bar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/matrix-simplified/capture-bar.tsx tests/ui/capture-bar.test.tsx
git commit -m "feat(capture): persistent capture bar with smart syntax + Tab cycling"
```

---

## Task 9: QuadrantPane component

**Files:**
- Create: `components/matrix-simplified/quadrant-pane.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const WASH_CLASS: Record<RedesignQuadrantKey, string> = {
  q1: "quadrant-wash-q1",
  q2: "quadrant-wash-q2",
  q3: "quadrant-wash-q3",
  q4: "quadrant-wash-q4",
};

const ACCENT: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

interface QuadrantPaneProps {
  meta: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
}

export function QuadrantPane({
  meta,
  tasks,
  allTasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onAddInQuadrant,
}: QuadrantPaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const accent = ACCENT[meta.rdKey];
  const taskIds = tasks.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[280px] flex-col rounded-2xl border p-4 transition-all",
        WASH_CLASS[meta.rdKey],
        isOver ? "border-2 shadow-md" : "border-border"
      )}
      style={isOver ? { borderColor: accent } : undefined}
      aria-label={`${meta.title} quadrant`}
    >
      <header className="mb-3 flex items-center gap-2.5">
        <span
          className="rd-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {meta.title}
        </span>
        <span className="text-[12px] text-foreground-muted">{meta.rdHint}</span>
        <span className="ml-auto rounded bg-background-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {tasks.filter((t) => !t.completed).length}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted hover:text-foreground"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.length === 0 ? (
            <p className="my-auto text-center text-sm italic text-foreground-muted">
              {meta.rdEmpty}
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/matrix-simplified/quadrant-pane.tsx
git commit -m "feat(matrix): washed quadrant pane with drop zone and minimal header"
```

---

## Task 10: MatrixGrid layout

**Files:**
- Create: `components/matrix-simplified/matrix-grid.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useMemo } from "react";
import { quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { QuadrantPane } from "./quadrant-pane";

interface MatrixGridProps {
  tasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
}

export function MatrixGrid({
  tasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onAddInQuadrant,
}: MatrixGridProps) {
  const grouped = useMemo(() => {
    const out: Record<RedesignQuadrantKey, TaskRecord[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of tasks) {
      if (t.urgent && t.important) out.q1.push(t);
      else if (!t.urgent && t.important) out.q2.push(t);
      else if (t.urgent && !t.important) out.q3.push(t);
      else out.q4.push(t);
    }
    for (const key of Object.keys(out) as RedesignQuadrantKey[]) {
      out[key].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    }
    return out;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-2">
      {quadrants.map((meta) => (
        <QuadrantPane
          key={meta.id}
          meta={meta}
          tasks={grouped[meta.rdKey]}
          allTasks={tasks}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          onAddInQuadrant={onAddInQuadrant}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/matrix-simplified/matrix-grid.tsx
git commit -m "feat(matrix): 2x2 grid composing four QuadrantPanes"
```

---

## Task 11: EditDrawer component (edit-only)

**Files:**
- Create: `components/matrix-simplified/edit-drawer.tsx`
- Test: `tests/ui/edit-drawer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const mockTask: TaskRecord = {
  id: "t1",
  title: "Original title",
  description: "",
  urgent: true,
  important: true,
  completed: false,
  tags: ["work"],
  subtasks: [],
  dependencies: [],
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

describe("<EditDrawer>", () => {
  it("submits updated title and disables save when title is empty", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("Original title");

    await userEvent.clear(titleInput);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    await userEvent.type(titleInput, "Updated title");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated title" }),
      "t1"
    );
  });

  it("Esc closes the drawer", async () => {
    const onClose = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={onClose} onSubmit={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("quadrant picker switches urgent/important flags", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /schedule/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ urgent: false, important: true }),
      "t1"
    );
  });
});
```

- [ ] **Step 2: Run test, confirm RED**

```bash
bun run test tests/ui/edit-drawer.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Implement EditDrawer**

Create `components/matrix-simplified/edit-drawer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { XIcon, CheckIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants, quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { resolveDuePreset, DUE_PRESETS, type DuePreset } from "@/lib/due-date-presets";
import { cn } from "@/lib/utils";

export interface EditDraft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
}

interface EditDrawerProps {
  open: boolean;
  task: TaskRecord | null;
  onClose: () => void;
  onSubmit: (draft: EditDraft, taskId: string) => void | Promise<void>;
}

const ACCENT: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

function classifyExistingDate(iso: string | undefined): DuePreset {
  if (!iso) return "none";
  const today = new Date();
  const target = new Date(`${iso}T00:00:00`);
  const todayIso = today.toISOString().slice(0, 10);
  if (iso === todayIso) return "today";
  const diff = (target.getTime() - new Date(todayIso + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 0 && diff <= 7) return "this-week";
  if (diff > 7 && diff <= 14) return "next-week";
  return "none";
}

export function EditDrawer({ open, task, onClose, onSubmit }: EditDrawerProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [duePreset, setDuePreset] = useState<DuePreset>("none");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setUrgent(task.urgent);
    setImportant(task.important);
    setDuePreset(classifyExistingDate(task.dueDate));
    setTags(task.tags ?? []);
    setTagInput("");
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  const activeQuadrant = quadrants.find((q) => q.urgent === urgent && q.important === important);
  const accent = activeQuadrant ? ACCENT[activeQuadrant.rdKey] : "#c2410c";

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    void onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        urgent,
        important,
        dueDate: resolveDuePreset(duePreset),
        tags,
      },
      task.id
    );
  };

  const addTag = () => {
    const v = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!v || tags.includes(v)) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex justify-end bg-black/30"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-2xl"
        aria-label="Edit task"
      >
        <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <h2 className="rd-serif text-[22px] text-foreground">Edit task</h2>
          {activeQuadrant ? (
            <span
              className="ml-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {activeQuadrant.title}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-auto px-5 py-5">
          <Field label="Title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] font-medium text-foreground outline-none focus:border-foreground-muted"
              aria-label="Title"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Optional details, links, context"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-foreground-muted"
            />
          </Field>

          <Field label="Quadrant">
            <div className="grid grid-cols-2 gap-2">
              {quadrants.map((q) => {
                const active = q.urgent === urgent && q.important === important;
                const a = ACCENT[q.rdKey];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setUrgent(q.urgent);
                      setImportant(q.important);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active ? "border-2" : "border-border hover:bg-background-muted/50"
                    )}
                    style={active ? { borderColor: a, backgroundColor: `${a}14`, color: a } : undefined}
                    aria-pressed={active}
                  >
                    <div className="text-[12px] font-bold uppercase tracking-wider">{q.title}</div>
                    <div className="mt-0.5 text-[11.5px] opacity-80">{q.rdTag}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Due date">
            <div className="inline-flex rounded-lg border border-border bg-background-muted p-1">
              {DUE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDuePreset(p.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    duePreset === p.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                  aria-pressed={duePreset === p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
                >
                  <span className="opacity-60">#</span>
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="hover:text-foreground"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === "Backspace" && !tagInput && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={addTag}
                placeholder={tags.length ? "" : "Add a tag…"}
                className="min-w-[80px] flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
              />
            </div>
          </Field>
        </div>

        <footer className="flex items-center gap-2.5 border-t border-border/60 bg-background px-5 py-3.5">
          <span className="text-[12px] text-foreground-muted">
            <kbd>Esc</kbd> to cancel
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background",
              "hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Save changes
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
```

- [ ] **Step 4: Verify GREEN**

```bash
bun run test tests/ui/edit-drawer.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/matrix-simplified/edit-drawer.tsx tests/ui/edit-drawer.test.tsx
git commit -m "feat(composer): edit-only drawer with quadrant picker, due presets, tags"
```

---

## Task 12: MatrixSimplified container

**Files:**
- Create: `components/matrix-simplified/index.tsx`

- [ ] **Step 1: Implement container — replaces RedesignMatrix**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createTask, toggleCompleted, updateTask, deleteTask } from "@/lib/tasks";
import { useTasks } from "@/lib/use-tasks";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { useAutoArchive } from "@/lib/use-auto-archive";
import { useNotificationChecker } from "@/components/matrix-board/use-event-handlers";
import { TOAST_DURATION } from "@/lib/constants";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { AppShell } from "./app-shell";
import { CaptureBar, type CapturePayload } from "./capture-bar";
import { MatrixGrid } from "./matrix-grid";
import { EditDrawer, type EditDraft } from "./edit-drawer";

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

function filterTasks(tasks: TaskRecord[], query: string): TaskRecord[] {
  if (!query.trim()) return tasks;
  const q = query.trim().toLowerCase();
  return tasks.filter((t) => {
    const hay = [
      t.title,
      t.description ?? "",
      (t.tags ?? []).join(" "),
      (t.subtasks ?? []).map((s) => s.title).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function MatrixSimplified() {
  const { all } = useTasks();
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();
  const { sensors, activeId, handleDragStart, handleDragEnd } = useDragAndDrop(handleError);

  useAutoArchive();
  useNotificationChecker();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  // PWA shortcut: ?action=new-task → focus capture bar (not drawer)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-task") {
      setTimeout(() => captureInputRef.current?.focus(), 50);
      params.delete("action");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, []);

  // Global "/" focuses search; "?" handled by AppShell help; "n" handled by CaptureBar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleTasks = useMemo(() => filterTasks(all, searchQuery), [all, searchQuery]);
  const total = all.length;
  const completed = all.filter((t) => t.completed).length;
  const overdue = all.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    return t.dueDate < new Date().toISOString().slice(0, 10);
  }).length;

  const handleCapture = useCallback(
    async ({ title, urgent, important, tags }: CapturePayload) => {
      try {
        await createTask({
          title,
          description: "",
          urgent,
          important,
          tags: tags.length > 0 ? tags : undefined,
        });
        showToast("Task added", undefined, TOAST_DURATION.SHORT);
      } catch {
        showToast("Failed to create task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleAddInQuadrant = useCallback((key: RedesignQuadrantKey) => {
    captureInputRef.current?.focus();
    // Hint via the bar's Tab cycle is left to user; we just focus.
    void key;
  }, []);

  const handleToggle = useCallback(
    async (task: TaskRecord, completedNext: boolean) => {
      try {
        await toggleCompleted(task.id, completedNext);
      } catch {
        showToast("Failed to update task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleDelete = useCallback(
    async (task: TaskRecord) => {
      try {
        await deleteTask(task.id);
      } catch {
        showToast("Failed to delete task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const handleEditOpen = useCallback((task: TaskRecord) => setEditingTask(task), []);
  const handleEditClose = useCallback(() => setEditingTask(null), []);

  const handleEditSubmit = useCallback(
    async (draft: EditDraft, taskId: string) => {
      try {
        await updateTask(taskId, draft);
        showToast("Task updated", undefined, TOAST_DURATION.SHORT);
        setEditingTask(null);
      } catch {
        showToast("Failed to update task", undefined, TOAST_DURATION.LONG);
      }
    },
    [showToast]
  );

  const activeDragTask = activeId ? all.find((t) => t.id === activeId) ?? null : null;

  const caption = (
    <>
      <span>
        <strong className="font-semibold text-foreground">{total - completed}</strong> active
      </span>
      <span className="text-foreground-muted/60">·</span>
      <span>
        <strong className="font-semibold text-foreground">{completed}</strong> done
      </span>
      {overdue > 0 ? (
        <>
          <span className="text-foreground-muted/60">·</span>
          <span style={{ color: "#c2410c" }}>{overdue} overdue</span>
        </>
      ) : null}
    </>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <AppShell
        title="GSD Matrix"
        caption={caption}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      >
        <div className="mb-4">
          <CaptureBar onSubmit={handleCapture} inputRef={captureInputRef} />
        </div>
        <MatrixGrid
          tasks={visibleTasks}
          onEdit={handleEditOpen}
          onToggleComplete={handleToggle}
          onDelete={handleDelete}
          onAddInQuadrant={handleAddInQuadrant}
        />
      </AppShell>

      <EditDrawer
        open={Boolean(editingTask)}
        task={editingTask}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
      />

      <DragOverlay dropAnimation={null}>
        {activeDragTask ? (
          <div style={{ cursor: "grabbing" }}>
            <TaskCard task={activeDragTask} allTasks={all} onEdit={() => {}} onDelete={() => {}} onToggleComplete={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/matrix-simplified/index.tsx
git commit -m "feat(matrix): MatrixSimplified container replacing RedesignMatrix"
```

---

## Task 13: Switch matrix page to new container

**Files:**
- Modify: `app/(matrix)/page.tsx`

- [ ] **Step 1: Replace import**

```tsx
import { MatrixSimplified } from "@/components/matrix-simplified";

export default function MatrixPage() {
  return <MatrixSimplified />;
}
```

- [ ] **Step 2: Run dev server, verify visually**

```bash
bun dev
```

Open http://localhost:3000 and confirm:
- 60px icon rail visible on left
- "GSD Matrix" title in serif
- Capture bar above 2×2 grid
- Each quadrant has its wash background
- Pressing `n` focuses the capture bar
- Typing `incident !!` shows sienna dot; `!` shows forest; `*` shows indigo
- Clicking a task opens the edit drawer
- Drag a task between quadrants → flags update

- [ ] **Step 3: Commit**

```bash
git add app/(matrix)/page.tsx
git commit -m "feat(matrix): wire matrix route to MatrixSimplified"
```

---

## Task 14: Wrap remaining pages in AppShell

**Files:**
- Modify: `app/(dashboard)/page.tsx`, `app/settings/page.tsx`, `app/about/page.tsx`, `app/(archive)/page.tsx`, `app/(sync)/sync-history/page.tsx`

- [ ] **Step 1: Audit each page's current shell**

```bash
for f in app/\(dashboard\)/page.tsx app/settings/page.tsx app/about/page.tsx app/\(archive\)/page.tsx app/\(sync\)/sync-history/page.tsx; do
  echo "=== $f ==="
  head -30 "$f"
done
```

- [ ] **Step 2: For each page, replace AppHeader/AppRail wrapper with AppShell**

Pattern (apply to each route — adapt page-specific titles and content):

```tsx
"use client";

import { AppShell } from "@/components/matrix-simplified/app-shell";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      {/* existing dashboard content (unchanged) */}
    </AppShell>
  );
}
```

Titles per page:
- Dashboard → `"Dashboard"`
- Settings → `"Settings"`
- About → `"About"`
- Archive → `"Archive"`
- Sync history → `"Sync history"`

If a page is a server component, keep its inner content as a separate client component and only wrap with `<AppShell>` in a small client shell file.

- [ ] **Step 3: Verify each route renders**

Visit each route in dev and confirm rail + topbar render correctly.

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(shell): wrap dashboard/settings/about/archive/sync routes in AppShell"
```

---

## Task 15: Mobile pass

**Files:**
- Modify: `components/matrix-simplified/icon-rail.tsx`, `components/matrix-simplified/capture-bar.tsx`, `components/matrix-simplified/matrix-grid.tsx`

- [ ] **Step 1: Mobile bottom-rail variant**

The 60px left rail is `hidden md:flex` already. For mobile, add a slim bottom nav rail in `icon-rail.tsx`:

After the `<aside>...</aside>` block, append:

```tsx
{/* Mobile bottom rail */}
<nav
  className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/70 bg-background/95 px-2 py-1.5 backdrop-blur md:hidden"
  aria-label="Primary navigation (mobile)"
>
  {PRIMARY.map((item) => (
    <RailButton
      key={item.routeKey}
      label={item.label}
      icon={item.icon}
      active={isRouteActive(pathname, item.routeKey)}
      disabled={isPending}
      onClick={() => navigateWithTransition(ROUTES[item.routeKey])}
    />
  ))}
  <RailButton label="Help" icon={CircleHelpIcon} onClick={onHelp} />
</nav>
```

Wrap both rails in a fragment and add bottom padding to `<main>` in `app-shell.tsx`:

```tsx
<main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 pb-20 sm:px-9 sm:py-6 md:pb-6">
```

- [ ] **Step 2: Sticky mobile capture bar**

Update the capture bar's container in `index.tsx` mobile-specific wrapping:

```tsx
<div className="sticky top-[60px] z-10 mb-4 -mx-4 bg-background px-4 py-2 sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
  <CaptureBar onSubmit={handleCapture} inputRef={captureInputRef} />
</div>
```

- [ ] **Step 3: 1-column matrix on mobile**

`matrix-grid.tsx` already uses `grid-cols-1 md:grid-cols-2 md:grid-rows-2` — single-col Q1→Q2→Q3→Q4 ordering follows from `quadrants` array order in `lib/quadrants.ts`. Verify in DevTools mobile preview.

- [ ] **Step 4: Visual smoke test in dev**

```bash
bun dev
```

Resize to 375px width, verify:
- Bottom nav visible, left rail hidden
- Capture bar sticks at top of content
- Quadrants stack Q1→Q2→Q3→Q4
- Tap targets ≥44×44px (touchscreen rule)

- [ ] **Step 5: Commit**

```bash
git add components/matrix-simplified/
git commit -m "feat(matrix): mobile pass — bottom rail, sticky capture, single-column quadrants"
```

---

## Task 16: Update PWA manifest shortcut behavior

**Files:**
- (No file changes if Task 12 already routes `?action=new-task` to `captureInputRef.focus()`.)
- Verify: open `public/manifest.json` and confirm the shortcut still points to `/?action=new-task`.

- [ ] **Step 1: Smoke-test from PWA shortcut**

```bash
grep -n "action=new-task" public/manifest.json
```

Visit `http://localhost:3000/?action=new-task`. Expected: capture bar receives focus, no drawer opens.

- [ ] **Step 2: No commit needed unless manifest changes.**

---

## Task 17: Clean up `components/redesign/` and dead code

**Files:**
- Move: `components/redesign/help-drawer.tsx` → `components/matrix-simplified/help-drawer.tsx`
- Update import in `components/matrix-simplified/app-shell.tsx`
- Delete: `components/redesign/` (entire folder), `lib/redesign/` (entire folder)
- Delete: `components/view-toggle.tsx`
- Delete: `components/app-header.tsx`, `components/app-header/` (folder)
- Delete: `components/matrix-board.tsx`, `components/matrix-board/` (folder), `components/matrix-column.tsx`
- Update or delete: `tests/ui/matrix-board.test.tsx`, `tests/ui/matrix-page.test.tsx`, `tests/ui/coverage-boost-ui.test.tsx`, `tests/ui/remaining-components.test.tsx`, `tests/ui/misc-components.test.tsx`

- [ ] **Step 1: Move help-drawer**

```bash
mv components/redesign/help-drawer.tsx components/matrix-simplified/help-drawer.tsx
```

Update its imports if it pulls from `./primitives` or `./redesign-shell`. Inline anything required so the file stands alone.

Update `components/matrix-simplified/app-shell.tsx`:

```tsx
import { HelpDrawer } from "./help-drawer";
```

- [ ] **Step 2: Confirm no remaining imports of redesign/**

```bash
grep -rn "from \"@/components/redesign" --include="*.ts" --include="*.tsx"
grep -rn "from \"@/lib/redesign" --include="*.ts" --include="*.tsx"
grep -rn "from \"@/components/app-header" --include="*.ts" --include="*.tsx"
grep -rn "from \"@/components/view-toggle" --include="*.ts" --include="*.tsx"
grep -rn "from \"@/components/matrix-board" --include="*.ts" --include="*.tsx"
grep -rn "from \"@/components/matrix-column" --include="*.ts" --include="*.tsx"
```

Each command should return zero results before proceeding. If any import remains, fix it (replace with new equivalents from `matrix-simplified/`).

- [ ] **Step 3: Migrate hooks used by `MatrixSimplified`**

`components/matrix-board/use-event-handlers` exposes `useNotificationChecker`. Move that single hook to `lib/use-notification-checker.ts` and update imports:

```bash
grep -rn "useNotificationChecker" --include="*.ts" --include="*.tsx"
```

- [ ] **Step 4: Delete dead folders/files**

```bash
git rm -r components/redesign lib/redesign
git rm components/view-toggle.tsx
git rm -r components/app-header components/app-header.tsx
git rm -r components/matrix-board components/matrix-board.tsx components/matrix-column.tsx
```

- [ ] **Step 5: Delete or rewrite tests targeting removed components**

For each test in the list above, decide:
- If it tested behavior now covered by `tests/ui/matrix-simplified.test.tsx` → delete.
- If it tested unrelated logic accidentally rendering removed components → rewrite to render `<MatrixSimplified>` or its sub-components.

```bash
git rm tests/ui/matrix-board.test.tsx
# rewrite tests/ui/matrix-page.test.tsx to render MatrixSimplified
# audit coverage-boost-ui.test.tsx, remaining-components.test.tsx, misc-components.test.tsx
```

- [ ] **Step 6: Run full suite**

```bash
bun run test 2>&1 | tail -30
```

Expected: all tests pass. Coverage may dip; restore in Task 21.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(cleanup): delete redesign/, app-header/, view-toggle, matrix-board after v9 swap"
```

---

## Task 18: Strip card chrome the v9 simplified card hides

**Files:**
- Modify: `components/task-card.tsx` (or its module index)

**Goal:** Per the handoff, the simplified card shows only checkbox, title, optional description, due pill, subtask counter, and tags. Hide snooze, share, timer, dependencies button from the main card surface. Keep these features accessible from the edit drawer or via right-click/menu (decide per feature).

- [ ] **Step 1: Audit the card's current render**

```bash
grep -n "snooze\|share\|timer\|dependencies" components/task-card.tsx components/task-card/*.tsx 2>&1
```

- [ ] **Step 2: Hide chrome**

Move snooze/share/timer/dependencies UI behind a conditional flag (default off in matrix view) or remove from the card renderer entirely. Keep underlying handlers in props for future surfacing.

- [ ] **Step 3: Run tests**

```bash
bun run test
```

- [ ] **Step 4: Commit**

```bash
git add components/
git commit -m "refactor(card): simplify task card chrome — hide snooze/share/timer per v9"
```

---

## Task 19: Restore `?` help shortcut wiring

**Files:**
- Modify: `components/matrix-simplified/index.tsx`, `components/matrix-simplified/app-shell.tsx`

Currently AppShell owns `helpOpen` state. The `?` shortcut needs to flip that. Add a controlled-help mode:

- [ ] **Step 1: Lift help state via `useImperativeHandle` or pass an opener ref**

Simplest: expose `onOpenHelp` as a prop and let pages own the state if they need it. For matrix, add:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      // dispatch a custom event AppShell listens for
      window.dispatchEvent(new CustomEvent("gsd:open-help"));
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

Inside `AppShell`:

```tsx
useEffect(() => {
  const open = () => setHelpOpen(true);
  window.addEventListener("gsd:open-help", open);
  return () => window.removeEventListener("gsd:open-help", open);
}, []);
```

- [ ] **Step 2: Manual smoke**

Press `?` from anywhere → help drawer opens.

- [ ] **Step 3: Commit**

```bash
git add components/matrix-simplified/
git commit -m "feat(shortcuts): wire ? to open help drawer via custom event"
```

---

## Task 20: Update keyboard shortcuts hook

**Files:**
- Modify: `lib/use-keyboard-shortcuts.ts`

- [ ] **Step 1: Read current hook**

```bash
cat lib/use-keyboard-shortcuts.ts
```

- [ ] **Step 2: Remove/update legacy bindings**

- Remove `n` → "open new-task drawer" (now CaptureBar owns this).
- Keep `/` → focus search.
- Keep `?` → help.
- Keep `1`–`9`, `0` → smart views.
- Keep `⌘K`/`Ctrl+K` → command palette.

If the hook is used by code that's been deleted, ensure it's no longer wired up where it duplicates the new shortcuts.

- [ ] **Step 3: Commit**

```bash
git add lib/use-keyboard-shortcuts.ts
git commit -m "refactor(shortcuts): align global keyboard hook with v9 capture-bar ownership"
```

---

## Task 21: Coverage + integration test for MatrixSimplified

**Files:**
- Create: `tests/ui/matrix-simplified.test.tsx`

- [ ] **Step 1: Write integration test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({ all: [], byQuadrant: { "urgent-important": [], "not-urgent-important": [], "urgent-not-important": [], "not-urgent-not-important": [] } }),
}));

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn().mockResolvedValue(undefined),
  toggleCompleted: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

import { MatrixSimplified } from "@/components/matrix-simplified";
import { createTask } from "@/lib/tasks";

describe("<MatrixSimplified>", () => {
  it("submitting capture bar calls createTask with parsed payload", async () => {
    render(<MatrixSimplified />);
    await userEvent.type(screen.getByLabelText("Capture a task"), "ship release !! #ops{Enter}");
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "ship release",
          urgent: true,
          important: true,
          tags: ["ops"],
        })
      )
    );
  });

  it("renders 'GSD Matrix' title", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("heading", { name: /gsd matrix/i })).toBeInTheDocument();
  });

  it("renders four quadrant panes", () => {
    render(<MatrixSimplified />);
    expect(screen.getByRole("region", { name: /do first/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /delegate/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /eliminate/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run with coverage**

```bash
bun run test -- --coverage 2>&1 | tail -20
```

Expected: targets met (≥80% statements/lines/functions on changed files).

- [ ] **Step 3: Commit**

```bash
git add tests/ui/matrix-simplified.test.tsx
git commit -m "test(matrix): integration test covering capture → create-task flow"
```

---

## Task 22: Verification checklist

- [ ] **Step 1: Static checks**

```bash
bun typecheck && bun lint && bun run test
```

Expected: clean pass on all three.

- [ ] **Step 2: Build**

```bash
bun run build 2>&1 | tail -20
```

Expected: production build succeeds.

- [ ] **Step 3: Run the verification checklist from `handoff_gsd_simplified_v9/README.md`**

Manually verify in `bun dev`:

- [ ] All four quadrant panes show their correct wash color (no stray paper/white panes).
- [ ] Logo in the rail does not exceed 32px wide. Logo lockup with wordmark is only used outside the rail.
- [ ] The page header on the matrix route reads "GSD Matrix" — not "Matrix".
- [ ] Capture bar smart-syntax: typing `!!` turns the indicator dot sienna; `!` alone turns it forest; `*` alone turns it indigo.
- [ ] Clicking a task opens the edit drawer; no other path to the drawer exists.
- [ ] `n` from anywhere focuses the capture bar.
- [ ] Drag a task from one quadrant to another → its quadrant flags update and persist.
- [ ] Dark mode: verify wash tokens render correctly.

- [ ] **Step 4: Open PR**

```bash
git push -u origin feat/gsd-simplified-v9
gh pr create --title "feat: GSD Simplified v9 — single matrix view + capture bar" --body "$(cat <<'EOF'
## Summary
- Replace 3-view redesign matrix (Focus/Editorial/Canvas) with a single simplified Matrix view per `handoff_gsd_simplified_v9/README.md`.
- 60px icon rail (Matrix / Dashboard / Settings / About + Help) replaces 232px sidebar.
- Persistent CaptureBar with smart syntax (`!`/`!!`/`*`/`#tag`) is the only path to create tasks; composer drawer becomes edit-only.
- New four-cell logo with Q1 emphasis; wash tokens for each quadrant.

## Test plan
- [ ] `bun typecheck && bun lint && bun run test` clean
- [ ] Manual verification of all 8 items in `handoff_gsd_simplified_v9/README.md` §Verification checklist
- [ ] Mobile preview at 375px: bottom rail, sticky capture, single-column quadrants
- [ ] PWA shortcut `?action=new-task` focuses capture bar (no drawer)
- [ ] Drag-drop between quadrants persists urgent/important flags
EOF
)"
```

- [ ] **Step 5: No commit needed past PR push**

---

## Self-review checklist (run before declaring plan ready)

- [ ] Spec coverage: every section of v9 README maps to at least one task. ✓ (tokens=T1, logo=T2, parser=T3, dates=T4, rail=T5, topbar=T6, shell=T7, capture=T8, quadrant=T9, grid=T10, edit=T11, container=T12, route swap=T13, other pages=T14, mobile=T15, PWA=T16, cleanup=T17, card=T18, ?-help=T19, shortcuts=T20, tests=T21, verify=T22)
- [ ] No placeholders: every code-bearing step shows the actual code.
- [ ] Type consistency: `RedesignQuadrantKey`, `QuadrantMeta`, `EditDraft`, `CapturePayload` are defined in canonical files and imported by the rest.
- [ ] Test signatures map to acceptance criteria: parser tests = smart-syntax bullet; due-presets tests = D-rule confirmation; capture-bar tests = bullets 4 & 6; edit-drawer tests = bullet 5.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-gsd-simplified-v9.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints.

Which approach?
