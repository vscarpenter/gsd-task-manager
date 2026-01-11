/* eslint-disable react/no-unescaped-entities */
"use client";

import {
  RocketIcon,
  ShieldCheckIcon,
  KeyboardIcon,
  SmartphoneIcon,
  CloudIcon,
} from "lucide-react";

/**
 * Step 6: Data, Privacy & Next Steps
 * Privacy info, key shortcuts, PWA, and final CTA
 */
export function StepFinal() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
          <RocketIcon className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">You're Ready!</h2>
        <p className="text-sm text-foreground-muted">A few more things to know...</p>
      </div>

      {/* Privacy & Data */}
      <div className="rounded-lg border border-card-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold text-foreground text-sm">Your Data, Your Control</h3>
        </div>
        <div className="space-y-2 text-xs text-foreground-muted">
          <p>
            <strong>Local-first:</strong> All data stored on YOUR device. Works completely offline.
          </p>
          <div className="flex items-center gap-2">
            <CloudIcon className="h-4 w-4 text-blue-500" />
            <p>
              <strong>Optional Cloud Sync:</strong> End-to-end encrypted (AES-256).
              We can't read your tasks.
            </p>
          </div>
        </div>
      </div>

      {/* Quick shortcuts */}
      <div className="rounded-lg border border-card-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyboardIcon className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground text-sm">Essential Shortcuts</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <ShortcutItem shortcut="⌘K" description="Command palette" />
          <ShortcutItem shortcut="N" description="New task" />
          <ShortcutItem shortcut="/" description="Search" />
          <ShortcutItem shortcut="?" description="This guide" />
          <ShortcutItem shortcut="1-9" description="Smart views" />
          <ShortcutItem shortcut="0" description="Clear filter" />
        </div>
      </div>

      {/* PWA */}
      <div className="rounded-lg border border-card-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <SmartphoneIcon className="h-4 w-4 text-accent" />
          <h4 className="font-semibold text-foreground text-sm">Install as App</h4>
        </div>
        <p className="text-xs text-foreground-muted">
          Add GSD to your home screen for faster access. Click the install icon in your browser
          or use Share → "Add to Home Screen" on mobile.
        </p>
      </div>

      {/* Final CTA */}
      <div className="rounded-xl bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 p-5 text-center">
        <h3 className="font-bold text-foreground text-lg mb-2">
          Now Go Get Stuff Done!
        </h3>
        <p className="text-sm text-foreground-muted mb-3">
          The matrix is a tool, not a rule. Start small, experiment, and adapt it to your life.
        </p>
        <p className="text-xs text-foreground-muted">
          Press <kbd className="px-1.5 py-0.5 bg-white/50 dark:bg-black/30 rounded font-mono">?</kbd> anytime
          to open the full reference guide.
        </p>
      </div>
    </div>
  );
}

function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-center justify-between bg-background-muted rounded px-2 py-1.5">
      <span className="text-foreground-muted">{description}</span>
      <kbd className="px-1.5 py-0.5 bg-background rounded border border-border text-xs font-mono text-foreground">
        {shortcut}
      </kbd>
    </div>
  );
}
