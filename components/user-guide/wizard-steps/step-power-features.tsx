/* eslint-disable react/no-unescaped-entities */
"use client";

import { ZapIcon, CommandIcon, KeyboardIcon, SettingsIcon, UsersIcon } from "lucide-react";

/**
 * Step 4: Power Features
 * Command palette, smart views, batch operations
 */
export function StepPowerFeatures() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
          <ZapIcon className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Power Features</h2>
        <p className="text-sm text-foreground-muted">Navigate like a pro with keyboard shortcuts</p>
      </div>

      {/* Command Palette - Hero */}
      <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CommandIcon className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Command Palette</h3>
          <kbd className="ml-auto px-2 py-1 bg-accent/20 border border-accent/30 rounded text-xs font-mono text-accent">
            ⌘K
          </kbd>
        </div>
        <p className="text-sm text-foreground-muted mb-3">
          Your gateway to everything in GSD. Press <strong>⌘K</strong> (or Ctrl+K) to:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-accent">🔍</span>
            <span className="text-foreground-muted">Search any task</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-accent">⚡</span>
            <span className="text-foreground-muted">Quick actions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-accent">🧭</span>
            <span className="text-foreground-muted">Navigate views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-accent">⚙️</span>
            <span className="text-foreground-muted">Open settings</span>
          </div>
        </div>
      </div>

      {/* Smart Views & Batch Ops */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-card-border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <KeyboardIcon className="h-4 w-4 text-accent" />
            <h4 className="font-semibold text-foreground text-sm">Smart Views</h4>
          </div>
          <ul className="text-xs text-foreground-muted space-y-1">
            <li>• Pin views to header</li>
            <li>• Press <kbd className="px-1 bg-background-muted rounded">1-9</kbd> to activate</li>
            <li>• Press <kbd className="px-1 bg-background-muted rounded">0</kbd> to clear</li>
          </ul>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="h-4 w-4 text-accent" />
            <h4 className="font-semibold text-foreground text-sm">Batch Operations</h4>
          </div>
          <ul className="text-xs text-foreground-muted space-y-1">
            <li>• Click tasks to select</li>
            <li>• Complete, move, or tag</li>
            <li>• Delete multiple at once</li>
          </ul>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="rounded-lg border border-card-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="h-4 w-4 text-accent" />
          <h4 className="font-semibold text-foreground text-sm">Quick Settings Panel</h4>
        </div>
        <p className="text-xs text-foreground-muted">
          Click the gear icon for fast access to: theme toggle, show/hide completed,
          notifications, and sync interval.
        </p>
      </div>

      {/* Workflow example */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800 p-3">
        <p className="text-xs text-foreground">
          <strong>Pro Workflow:</strong> Press <kbd className="px-1 bg-white/50 dark:bg-black/30 rounded">1</kbd> (Today's Focus)
          → <kbd className="px-1 bg-white/50 dark:bg-black/30 rounded">n</kbd> (new task)
          → <kbd className="px-1 bg-white/50 dark:bg-black/30 rounded">⌘K</kbd> "dashboard"
          — all in seconds!
        </p>
      </div>
    </div>
  );
}
