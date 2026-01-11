/* eslint-disable react/no-unescaped-entities */
"use client";

import { GridIcon, AlertTriangleIcon } from "lucide-react";

/**
 * Step 2: The Eisenhower Matrix
 * Explains the 4 quadrants and their purpose
 */
export function StepMatrix() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-1">
          <GridIcon className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground">The Eisenhower Matrix</h2>
        <p className="text-sm text-foreground-muted max-w-lg mx-auto">
          <em>"What is important is seldom urgent, and what is urgent is seldom important."</em>
          <span className="block mt-1">— President Eisenhower</span>
        </p>
      </div>

      {/* 4 Quadrants Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Q1 - Do First */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Q1: Do First</h3>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">Urgent + Important</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Crises, deadlines, emergencies. Target: 15-20%
          </p>
        </div>

        {/* Q2 - Schedule */}
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">Q2: Schedule</h3>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">Not Urgent + Important</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            YOUR GOAL! Strategic work, growth. Target: 60-70%
          </p>
        </div>

        {/* Q3 - Delegate */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm">Q3: Delegate</h3>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">Urgent + Not Important</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Interruptions, busywork. Target: 15-20%
          </p>
        </div>

        {/* Q4 - Eliminate */}
        <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <h3 className="font-semibold text-purple-900 dark:text-purple-300 text-sm">Q4: Eliminate</h3>
          </div>
          <p className="text-xs text-purple-700 dark:text-purple-400 mb-2">Not Urgent + Not Important</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Time-wasters, distractions. Target: 0-5%
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-red-600 dark:text-red-400 mb-1">
              Common Mistake: Living in Q1
            </h4>
            <p className="text-xs text-red-600 dark:text-red-400">
              Many people spend 80% in Q1, firefighting constantly. This leads to burnout.
              <strong> Schedule Q2 time daily</strong> (even 30 min) to prevent future crises.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
