# GSD Task Manager

**Get Stuff Done** (or Get Shit Done, if you're feeling snarky) — A privacy-first task manager based on the Eisenhower Matrix.

Live running app at [gsd.vinny.dev](https://gsd.vinny.dev)

## What is the Eisenhower Matrix?

The Eisenhower Matrix is a productivity framework that helps you prioritize tasks by urgency and importance. It's named after President Dwight D. Eisenhower, who famously said: *"What is important is seldom urgent, and what is urgent is seldom important."*

The matrix divides tasks into four quadrants:

![Eisenhower Matrix](public/gsd-matrix.png)

### The Four Quadrants

- **Do First (Urgent + Important)** — Crises, deadlines, emergencies. Handle these immediately.
- **Schedule (Not Urgent + Important)** — Strategic planning, learning, relationship building. This is where you should spend most of your time.
- **Delegate (Urgent + Not Important)** — Interruptions, some emails, other people's priorities. Delegate these when possible.
- **Eliminate (Not Urgent + Not Important)** — Time-wasters, busy work, mindless scrolling. Minimize or eliminate these.

## How GSD Works

GSD Task Manager is a **completely private** task manager that runs entirely in your browser. Your tasks never leave your device — everything is stored locally using IndexedDB.

### Features

✅ **Privacy-first** — All data stays on your device
✅ **Works offline** — Install as a PWA (Progressive Web App)
✅ **Eisenhower Matrix** — Organize tasks by urgency and importance
✅ **Drag & drop** — Move tasks between quadrants
✅ **Export/Import** — Back up your tasks as JSON
✅ **Keyboard shortcuts** — Fast task entry and navigation
✅ **Dark mode** — Easy on the eyes

## How to Use

### Creating Tasks

1. Click **"New Task"** or press `n`
2. Enter a task title
3. Optionally add a description
4. Mark the task as **Urgent** and/or **Important**
5. Click **"Add Task"**

Your task will automatically appear in the correct quadrant based on your selections.

### Managing Tasks

- **Complete a task** — Click the checkmark icon
- **Edit a task** — Click the edit icon (pencil)
- **Delete a task** — Click the delete icon (trash)
- **Move between quadrants** — Drag and drop tasks, or edit to change urgency/importance

### Keyboard Shortcuts

- `n` — Create a new task
- `/` — Focus the search bar
- `?` — Show help dialog

### Backing Up Your Data

Since all your tasks are stored locally in your browser:

1. Click **"Export Tasks"** in the footer to download a JSON backup
2. Click **"Import Tasks"** to restore from a backup file

**Important:** Clearing your browser data will delete your tasks. Export regularly to avoid data loss!

### Installing as a PWA

GSD can be installed on your desktop or mobile device for offline access:

- **Desktop (Chrome/Edge):** Click the install icon in the address bar
- **Mobile (iOS Safari):** Tap Share → "Add to Home Screen"
- **Mobile (Android Chrome):** Tap the three-dot menu → "Install app"

Visit the [Install page](https://gsd.vinny.dev/install.html) for detailed instructions.

## Tips for Success

1. **Start your day in Quadrant 2** — Focus on important, non-urgent tasks before firefighting begins
2. **Review weekly** — Move tasks between quadrants as priorities shift
3. **Be honest about urgency** — Not everything is urgent, even if it feels that way
4. **Eliminate ruthlessly** — If a task stays in Q4 for weeks, delete it
5. **Export regularly** — Keep backups of your task data

---

For developers interested in contributing or self-hosting, see [TECHNICAL.md](./TECHNICAL.md).
