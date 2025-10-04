"use client";

import { cn } from "@/lib/utils";

interface TogglePillProps {
  active: boolean;
  label: string;
  onToggle: () => void;
  accentClass: string;
}

export function TogglePill({ active, label, onToggle, accentClass }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "button-reset rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
        active ? cn(accentClass, "border-transparent") : "border-white/10 text-slate-300 hover:border-white/30"
      )}
    >
      {label}
    </button>
  );
}
