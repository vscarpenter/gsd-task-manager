"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background-muted p-1",
        className
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "touch-target inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-small font-medium transition-colors duration-200",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1",
              isSelected
                ? "border-control-border bg-card text-foreground shadow-sm"
                : "border-transparent text-foreground-muted hover:text-foreground"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {isSelected ? (
                <CheckIcon data-testid="selected-segment-indicator" className="h-3.5 w-3.5" />
              ) : null}
            </span>
            <span>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
