"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
}

/**
 * Simple progress bar component for wizard flows
 * Shows visual progress with filled/empty segments
 */
export function Progress({ value, max = 100, className, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-background-muted", className)}
      {...props}
    >
      <div
        className="h-full bg-accent transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

/**
 * Step indicator showing current position in a wizard flow
 * Displays step dots and a text label
 */
export function StepIndicator({ currentStep, totalSteps, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i < currentStep ? "bg-accent" : "bg-background-muted"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-foreground-muted">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      <Progress value={currentStep} max={totalSteps} />
    </div>
  );
}
