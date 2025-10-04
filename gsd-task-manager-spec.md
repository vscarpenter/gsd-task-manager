# GSD Task Manager

Tagline - Prioritize what matters. GSD!
GSD can be 'Get Stuff Done' or 'Get Shit Done'

Stop juggling, start finishing. GSD Task Manager makes it easy to sort your to-dos into what’s urgent and what’s important, so you can finally get stuff done without burning out. It’s simple, visual, and works entirely offline.


**Goal**\
Build a privacy-first task manager that implements the Eisenhower
matrix. Users create tasks, classify them by urgency and importance, and
view them in a 2×2 grid. All data stays on device in IndexedDB. Include
a tiny PWA for offline and install, plus export and import of data to
JSON.

## Tech Stack

-   Next.js 15 App Router, static export only\
-   TypeScript\
-   Tailwind CSS\
-   shadcn/ui with Radix Primitives\
-   IndexedDB (Dexie)\
-   zod, nanoid, lucide-react, next-themes\
-   Static export for AWS S3 + CloudFront

## Eisenhower Model

Quadrants: 1. Urgent + Important (Do first)\
2. Not Urgent + Important (Schedule)\
3. Urgent + Not Important (Delegate)\
4. Not Urgent + Not Important (Eliminate)

Quadrant is derived from urgent and important flags.

## Core Features

-   Create and edit tasks in shadcn Dialog\
-   2×2 matrix view with task cards\
-   Move tasks between quadrants\
-   Complete/uncomplete tasks\
-   Search and filter\
-   Export to JSON / Import from JSON\
-   Tiny PWA for install + offline\
-   Keyboard shortcuts: n=new task, /=search, ?=help

## UI Layout

-   Header: title, theme toggle, search, new task\
-   2×2 grid with quadrant headers\
-   Footer: Export / Import JSON\
-   Task cards: title, urgency/importance badges, due date,
    complete/edit/delete actions

## IndexedDB Persistence

-   Dexie wrapper with a tasks table\
-   CRUD API for tasks\
-   Export to JSON and Import from JSON

## Tiny PWA

-   manifest.json with name, icons, theme color\
-   Service worker sw.js caches app shell\
-   Register SW in client component\
-   App can be installed and works offline

## Deployment

-   Export with `next export`\
-   Upload to S3 and serve via CloudFront\
-   Default root = index.html, error pages map to index.html\
-   CSP headers applied at CloudFront

## Acceptance Criteria

-   Tasks can be created, edited, moved, and completed\
-   Matrix updates instantly\
-   Tasks persist across reloads\
-   Export/import JSON works\
-   App installs as PWA and runs offline\
-   Lighthouse score ≥95 in performance, accessibility, best practices
