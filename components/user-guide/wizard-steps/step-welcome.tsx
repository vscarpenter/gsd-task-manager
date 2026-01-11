/* eslint-disable react/no-unescaped-entities */
"use client";

import { RocketIcon, SparklesIcon } from "lucide-react";

/**
 * Step 1: Welcome & Getting Started
 * Introduces GSD and the Eisenhower Matrix concept
 */
export function StepWelcome() {
  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-2">
          <RocketIcon className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome to GSD Task Manager!
        </h2>
        <p className="text-foreground-muted max-w-md mx-auto">
          <span className="font-semibold">Get Stuff Done</span> helps you prioritize what matters
          using the Eisenhower Matrix — a proven productivity framework.
        </p>
      </div>

      {/* Quick intro */}
      <div className="rounded-xl border border-card-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Creating Your First Task</h3>
        </div>

        <ol className="text-sm text-foreground-muted space-y-2 list-decimal list-inside ml-1">
          <li>
            Click the <strong>New Task</strong> button (or press{" "}
            <kbd className="px-2 py-1 bg-background-muted rounded text-xs font-mono">N</kbd>)
          </li>
          <li>Enter a clear, actionable title (e.g., "Review Q4 budget proposal")</li>
          <li>
            Categorize: Is it <strong>Urgent</strong>? Is it <strong>Important</strong>?
          </li>
          <li>Optionally set a due date, add tags, or create subtasks</li>
          <li>
            Click <strong>Add Task</strong>
          </li>
        </ol>
      </div>

      {/* Pro tip */}
      <div className="rounded-xl bg-accent/10 border border-accent/20 p-4">
        <p className="text-sm text-foreground">
          <strong>Pro Tip:</strong> Start with 5-10 tasks to get familiar with the matrix.
          Don't worry about perfect categorization — you can always move tasks later!
        </p>
      </div>

      {/* What you'll learn */}
      <div className="text-center text-sm text-foreground-muted">
        <p>In this guide, you'll learn:</p>
        <p className="font-medium text-foreground mt-1">
          The Matrix • Task Management • Power Features • Workflows
        </p>
      </div>
    </div>
  );
}
